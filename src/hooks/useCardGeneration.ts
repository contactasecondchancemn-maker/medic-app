import { useState, useCallback, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';

// ─── Constants ────────────────────────────────────────────────────────────────────

const ANTHROPIC_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) ||
  '';

// Cards generated per Claude call; large context = one shot for most documents.
const MAX_CARDS = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type GenerationPhase =
  | 'idle'
  | 'input'       // user is composing (text entered / file picked)
  | 'generating'  // Claude is running
  | 'review'      // cards ready, user can name deck + confirm
  | 'saving'
  | 'complete'
  | 'error';

export interface GeneratedCard {
  term: string;
  definition: string;
  ipa: string;
  etymology_parts: EtymologyParts;
  body_system: BodySystem | null;
  difficulty: number;       // 1–5
  step1_rating: number;     // 1–5
  also_known_as: string[];
  abbreviation: string | null;
}

interface EtymologyPart {
  root: string;
  language: string;
  type: 'root' | 'prefix' | 'suffix';
  meaning: string;
}

interface EtymologyParts {
  parts: EtymologyPart[];
}

export type InputMode = 'text' | 'pdf';

export interface GenerationState {
  phase: GenerationPhase;
  error: string | null;
  inputMode: InputMode;
  textInput: string;
  pdfName: string | null;
  pdfBase64: string | null;
  cards: GeneratedCard[];
  deckName: string;
  savedDeckId: string | null;
}

// ─── Claude prompt ──────────────────────────────────────────────────────────────

function buildPrompt(sourceText: string): string {
  return `You are a medical education expert creating USMLE Step 1 flashcards.

Analyze the following medical content and generate up to ${MAX_CARDS} high-quality flashcards. Each card must represent ONE distinct medical term, concept, drug, or disease.

For each card produce a JSON object with these exact fields:
- "term": concise medical term or concept name (string)
- "definition": clear, exam-focused definition (1–3 sentences, string)
- "ipa": IPA pronunciation (e.g. "/ˌmaɪ.oʊˌkɑːr.di.əl/", string)
- "etymology_parts": { "parts": [ { "root": string, "language": "Greek"|"Latin"|"Arabic"|"English"|"French"|"German"|"Other", "type": "root"|"prefix"|"suffix", "meaning": string } ] }
- "body_system": one of cardiovascular, nervous, respiratory, gastrointestinal, pharmacology, biochemistry, microbiology, pathology, endocrine, musculoskeletal, renal_urinary, hematology_oncology, immune_lymphatic, psychiatry, reproductive, dermatology, anatomy, embryology, ophthalmology, otolaryngology, general_principles — or null
- "difficulty": integer 1–5 (1=basic, 5=very hard)
- "step1_rating": integer 1–5 (1=rarely tested, 5=high-yield Step 1)
- "also_known_as": array of alternate names/synonyms (may be empty)
- "abbreviation": common abbreviation or null

Return ONLY a JSON array of card objects, no markdown, no explanation, no wrapper object.

Medical content to process:
---
${sourceText.slice(0, 12000)}
---`;
}

// ─── PDF text extraction via Claude vision ──────────────────────────────────────────

async function extractPdfWithClaude(base64: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract all medical text from this document. Return only the raw text content, preserving paragraph structure. No commentary.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`PDF extraction failed: ${response.status} ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  return json.content?.[0]?.text ?? '';
}

// ─── Card generation ────────────────────────────────────────────────────────────────

async function generateCards(sourceText: string): Promise<GeneratedCard[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildPrompt(sourceText) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Generation failed: ${response.status} ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const text: string = json.content?.[0]?.text ?? '[]';

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const raw = JSON.parse(cleaned) as Array<Record<string, unknown>>;

  return raw.map((r) => ({
    term:            String(r.term ?? ''),
    definition:      String(r.definition ?? ''),
    ipa:             String(r.ipa ?? ''),
    etymology_parts: (r.etymology_parts as EtymologyParts) ?? { parts: [] },
    body_system:     (r.body_system as BodySystem) || null,
    difficulty:      clamp(Number(r.difficulty ?? 3), 1, 5),
    step1_rating:    clamp(Number(r.step1_rating ?? 3), 1, 5),
    also_known_as:   Array.isArray(r.also_known_as) ? r.also_known_as.map(String) : [],
    abbreviation:    r.abbreviation ? String(r.abbreviation) : null,
  })).filter((c) => c.term && c.definition);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

// ─── Supabase save ────────────────────────────────────────────────────────────────

async function saveDeck(
  deckName: string,
  cards: GeneratedCard[]
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  // 1. Upsert terms — use direct PostgREST insert since bulk_upsert_terms
  //    is service-role only. Terms RLS allows authenticated inserts.
  const termsPayload = cards.map((c) => ({
    term:            c.term,
    definition:      c.definition,
    ipa:             c.ipa || null,
    body_system:     c.body_system,
    difficulty:      c.difficulty,
    step1_rating:    c.step1_rating,
    etymology_parts: c.etymology_parts,
    also_known_as:   c.also_known_as,
    abbreviation:    c.abbreviation,
  }));

  const { error: termsError } = await supabase
    .from('terms')
    .upsert(termsPayload, { onConflict: 'term', ignoreDuplicates: true });

  if (termsError) throw new Error(`Terms save failed: ${termsError.message}`);

  // 2. Fetch IDs back
  const { data: termRows, error: fetchError } = await supabase
    .from('terms')
    .select('id, term')
    .in('term', cards.map((c) => c.term));

  if (fetchError) throw new Error(fetchError.message);

  const termIdMap = new Map<string, string>();
  for (const row of termRows ?? []) {
    termIdMap.set(row.term as string, row.id as string);
  }

  // 3. Create deck
  const { data: deckRow, error: deckError } = await supabase
    .from('decks')
    .insert({ user_id: userId, name: deckName.trim(), source: 'ai_generated' })
    .select('id')
    .single();

  if (deckError) throw new Error(`Deck create failed: ${deckError.message}`);
  const deckId = deckRow.id as string;

  // 4. Insert deck_items
  const items = cards
    .map((c, i) => {
      const termId = termIdMap.get(c.term);
      if (!termId) return null;
      return { deck_id: deckId, term_id: termId, order: i };
    })
    .filter(Boolean);

  const { error: itemsError } = await supabase
    .from('deck_items')
    .insert(items as object[]);

  if (itemsError) throw new Error(`Deck items save failed: ${itemsError.message}`);

  // 5. Seed user_progress so cards appear in review queue
  const progressPayload = items.map((item) => ({
    user_id:        userId,
    term_id:        (item as { term_id: string }).term_id,
    confidence:     1,
    next_review_at: new Date().toISOString(),
  }));

  // ignoreDuplicates: true so re-generating the same term doesn't clobber progress
  await supabase
    .from('user_progress')
    .upsert(progressPayload, { onConflict: 'user_id,term_id', ignoreDuplicates: true });

  return deckId;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────────

const INITIAL: GenerationState = {
  phase:       'idle',
  error:       null,
  inputMode:   'text',
  textInput:   '',
  pdfName:     null,
  pdfBase64:   null,
  cards:       [],
  deckName:    '',
  savedDeckId: null,
};

export function useCardGeneration() {
  const [state, setState] = useState<GenerationState>(INITIAL);
  const cancelledRef = useRef(false);

  const patch = useCallback(
    (update: Partial<GenerationState>) =>
      setState((prev) => ({ ...prev, ...update })),
    []
  );

  // ── Input actions ──────────────────────────────────────────────────────────

  const setInputMode = useCallback(
    (mode: InputMode) => patch({ inputMode: mode, pdfName: null, pdfBase64: null, phase: 'input' }),
    [patch]
  );

  const setTextInput = useCallback(
    (text: string) => patch({ textInput: text, phase: text.trim() ? 'input' : 'idle' }),
    [patch]
  );

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    patch({
      pdfName:   asset.name,
      pdfBase64: asset.base64 ?? null,
      phase:     'input',
      inputMode: 'pdf',
    });
  }, [patch]);

  const setDeckName = useCallback(
    (name: string) => patch({ deckName: name }),
    [patch]
  );

  // ── Generate ────────────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!ANTHROPIC_KEY) {
      patch({ phase: 'error', error: 'EXPO_PUBLIC_ANTHROPIC_API_KEY is not set' });
      return;
    }

    cancelledRef.current = false;
    patch({ phase: 'generating', error: null, cards: [] });

    try {
      let sourceText: string;

      if (state.inputMode === 'pdf') {
        if (!state.pdfBase64) throw new Error('No PDF selected');
        sourceText = await extractPdfWithClaude(state.pdfBase64);
        if (!sourceText.trim()) throw new Error('Could not extract text from PDF');
      } else {
        sourceText = state.textInput;
        if (!sourceText.trim()) throw new Error('No text provided');
      }

      if (cancelledRef.current) return;

      const cards = await generateCards(sourceText);
      if (cards.length === 0) throw new Error('No cards could be generated from this content');

      // Propose a deck name from PDF filename or first term
      const suggestedName =
        state.pdfName
          ? state.pdfName.replace(/\.pdf$/i, '')
          : cards[0]?.body_system
          ? cards[0].body_system.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'AI Generated Deck';

      patch({
        phase:    'review',
        cards,
        deckName: state.deckName || suggestedName,
      });
    } catch (err) {
      if (!cancelledRef.current) {
        patch({
          phase: 'error',
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      }
    }
  }, [state.inputMode, state.pdfBase64, state.pdfName, state.textInput, state.deckName, patch]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (state.cards.length === 0) return;
    const name = state.deckName.trim() || 'AI Generated Deck';
    patch({ phase: 'saving', error: null });

    try {
      const deckId = await saveDeck(name, state.cards);
      patch({ phase: 'complete', savedDeckId: deckId });
    } catch (err) {
      patch({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Save failed',
      });
    }
  }, [state.cards, state.deckName, patch]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    patch({ phase: state.cards.length > 0 ? 'review' : 'idle' });
  }, [state.cards.length, patch]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setState(INITIAL);
  }, []);

  const backToInput = useCallback(() => {
    patch({ phase: 'input', error: null });
  }, [patch]);

  return {
    state,
    setInputMode,
    setTextInput,
    pickPdf,
    setDeckName,
    generate,
    save,
    cancel,
    reset,
    backToInput,
  };
}
