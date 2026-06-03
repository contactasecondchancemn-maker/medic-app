import { useState, useCallback, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { unzipSync } from 'fflate';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportPhase =
  | 'idle'
  | 'picking'
  | 'unzipping'
  | 'parsing'
  | 'enriching'
  | 'saving'
  | 'complete'
  | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  error: string | null;
  enriched: number;   // cards Claude has processed
  total: number;      // total cards to enrich
  saved: number;      // terms upserted to DB
}

interface AnkiNote {
  id: number;
  flds: string;
}

interface AnkiCard {
  nid: number;        // note id
  ivl: number;        // interval in days (negative = seconds for learning)
  factor: number;     // ease factor * 1000
  reps: number;       // total reviews
  due: number;        // due day relative to collection creation
}

interface ParsedCard {
  term: string;
  definition: string;
  anki: { ivl: number; factor: number; reps: number };
}

interface EnrichedTerm {
  term: string;
  definition: string;
  ipa?: string;
  body_system?: BodySystem;
  etymology_parts?: Record<string, unknown>;
}

// ─── HTML stripping ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// ─── Anki SRS → SM-2 mapping ──────────────────────────────────────────────────

function ankiToSm2(card: Pick<AnkiCard, 'ivl' | 'factor' | 'reps'>): {
  ease_factor: number;
  interval_days: number;
  review_count: number;
  confidence: number;
} {
  const ease_factor = Math.max(1.3, Math.min(4.0, card.factor / 1000));
  // Negative ivl = learning card (seconds), treat as day 1
  const interval_days = card.ivl > 0 ? card.ivl : 1;
  const review_count = Math.max(0, card.reps);
  // Map ease_factor 1.3–4.0 to confidence 1–5
  const confidence = Math.max(1, Math.min(5, Math.round(((ease_factor - 1.3) / 2.7) * 4) + 1));
  return { ease_factor, interval_days, review_count, confidence };
}

// ─── Claude enrichment ────────────────────────────────────────────────────────

const BATCH_SIZE = 15;
const ANTHROPIC_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) ||
  '';

async function enrichBatch(
  cards: ParsedCard[]
): Promise<EnrichedTerm[]> {
  const prompt = `You are a medical education AI. For each medical term below, return a JSON array with one object per term containing:
- "term": the original term (unchanged)
- "ipa": IPA pronunciation string (e.g. "/ˌmaɪ.oʊˌkɑːr.di.əl/")
- "body_system": one of: cardiovascular, nervous, respiratory, gastrointestinal, pharmacology, biochemistry, microbiology, pathology, endocrine, musculoskeletal, renal_urinary, hematology_oncology, immune_lymphatic, psychiatry, reproductive, dermatology, anatomy, embryology, ophthalmology, otolaryngology, general_principles — or null if unclear
- "etymology_parts": JSON object with a "parts" array, each part having: root (string), language ("Greek"|"Latin"|"Arabic"|"English"|"French"|"German"|"Other"), type ("root"|"prefix"|"suffix"), meaning (string)

Terms:
${cards.map((c, i) => `${i + 1}. ${c.term}: ${c.definition.slice(0, 200)}`).join('\n')}

Respond with ONLY a valid JSON array, no markdown, no explanation.`;

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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const json = await response.json();
  const text: string = json.content?.[0]?.text ?? '[]';
  const parsed = JSON.parse(text) as Array<Record<string, unknown>>;

  return cards.map((card, i) => {
    const enriched = parsed[i] ?? {};
    return {
      term: card.term,
      definition: card.definition,
      ipa: (enriched.ipa as string) || undefined,
      body_system: (enriched.body_system as BodySystem) || undefined,
      etymology_parts: enriched.etymology_parts
        ? (enriched.etymology_parts as Record<string, unknown>)
        : undefined,
    };
  });
}

// ─── Main hook ────────────────────────────────────────────────────────────────

const DB_NAME = 'anki_import.db';

export function useAnkiImport() {
  const [progress, setProgress] = useState<ImportProgress>({
    phase: 'idle',
    error: null,
    enriched: 0,
    total: 0,
    saved: 0,
  });

  const cancelledRef = useRef(false);

  const set = useCallback(
    (patch: Partial<ImportProgress>) =>
      setProgress((prev) => ({ ...prev, ...patch })),
    []
  );

  const runImport = useCallback(async () => {
    cancelledRef.current = false;

    // ── 1. Pick file ──────────────────────────────────────────────────────────
    set({ phase: 'picking', error: null, enriched: 0, total: 0, saved: 0 });

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      set({ phase: 'idle' });
      return;
    }

    const apkgUri = result.assets[0].uri;

    try {
      // ── 2. Unzip .apkg → extract collection.anki2 ─────────────────────────
      set({ phase: 'unzipping' });

      const b64 = await FileSystem.readAsStringAsync(apkgUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Base64 → Uint8Array
      const binaryStr = atob(b64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const unzipped = unzipSync(bytes);
      const ankiDbBytes = unzipped['collection.anki2'];
      if (!ankiDbBytes) {
        throw new Error('collection.anki2 not found in the .apkg file');
      }

      // Write SQLite file to documentDirectory/SQLite/
      const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
      const dbPath = `${sqliteDir}${DB_NAME}`;
      await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });

      // Uint8Array → base64 for FileSystem.writeAsStringAsync
      let outB64 = '';
      const chunk = 8192;
      for (let i = 0; i < ankiDbBytes.length; i += chunk) {
        outB64 += btoa(
          String.fromCharCode(...ankiDbBytes.subarray(i, i + chunk))
        );
      }
      await FileSystem.writeAsStringAsync(dbPath, outB64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (cancelledRef.current) return;

      // ── 3. Parse notes + cards from SQLite ────────────────────────────────
      set({ phase: 'parsing' });

      const db = await SQLite.openDatabaseAsync(DB_NAME);

      const notes = await db.getAllAsync<AnkiNote>(
        'SELECT id, flds FROM notes'
      );

      const cards = await db.getAllAsync<AnkiCard>(
        'SELECT nid, ivl, factor, reps FROM cards WHERE queue >= 0'
      );

      await db.closeAsync();

      // Clean up temp DB
      await FileSystem.deleteAsync(dbPath, { idempotent: true });

      if (notes.length === 0) {
        throw new Error('No notes found in the Anki collection');
      }

      // Build a map nid → card for SRS data
      const cardMap = new Map<number, AnkiCard>();
      for (const card of cards) {
        if (!cardMap.has(card.nid)) {
          cardMap.set(card.nid, card);
        }
      }

      // Parse flds (0x1f delimiter) — first field = term, second = definition
      const parsed: ParsedCard[] = [];
      for (const note of notes) {
        const fields = note.flds.split('\x1f');
        const term = stripHtml(fields[0] ?? '').trim();
        const definition = stripHtml(fields[1] ?? '').trim();
        if (!term || !definition) continue;

        const ankiCard = cardMap.get(note.id) ?? {
          ivl: 1,
          factor: 2500,
          reps: 0,
        };

        parsed.push({ term, definition, anki: ankiCard });
      }

      if (parsed.length === 0) {
        throw new Error('No valid term/definition pairs found');
      }

      if (cancelledRef.current) return;

      // ── 4. Enrich with Claude ─────────────────────────────────────────────
      set({ phase: 'enriching', total: parsed.length });

      const enriched: EnrichedTerm[] = [];

      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        if (cancelledRef.current) return;

        const batch = parsed.slice(i, i + BATCH_SIZE);
        let batchResult: EnrichedTerm[];

        if (ANTHROPIC_KEY) {
          try {
            batchResult = await enrichBatch(batch);
          } catch {
            // Graceful degradation: skip enrichment for this batch
            batchResult = batch.map((c) => ({
              term: c.term,
              definition: c.definition,
            }));
          }
        } else {
          batchResult = batch.map((c) => ({
            term: c.term,
            definition: c.definition,
          }));
        }

        enriched.push(...batchResult);
        set({ enriched: enriched.length });
      }

      if (cancelledRef.current) return;

      // ── 5. Save to Supabase ───────────────────────────────────────────────
      set({ phase: 'saving' });

      // bulk_upsert_terms needs service role — but it's security definer.
      // We call it via the anon key; however the function doesn't grant to
      // authenticated. Fall back to inserting terms directly via PostgREST.
      const termsPayload = enriched.map((e) => ({
        term: e.term,
        definition: e.definition,
        ipa: e.ipa ?? null,
        body_system: e.body_system ?? null,
        etymology_parts: e.etymology_parts ?? {},
      }));

      // Upsert terms (ignore conflicts — same term text already exists)
      const { error: termsError } = await supabase
        .from('terms')
        .upsert(termsPayload, { onConflict: 'term', ignoreDuplicates: true });

      if (termsError) throw new Error(termsError.message);

      // Fetch back the IDs for the terms we just upserted
      const termNames = enriched.map((e) => e.term);
      const { data: termRows, error: fetchError } = await supabase
        .from('terms')
        .select('id, term')
        .in('term', termNames);

      if (fetchError) throw new Error(fetchError.message);

      // Build a map term text → uuid
      const termIdMap = new Map<string, string>();
      for (const row of termRows ?? []) {
        termIdMap.set(row.term as string, row.id as string);
      }

      // Upsert user_progress with Anki SRS data
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const progressPayload = parsed
        .map((card) => {
          const termId = termIdMap.get(card.term);
          if (!termId) return null;
          const sm2 = ankiToSm2(card.anki);
          return {
            user_id: userId,
            term_id: termId,
            confidence: sm2.confidence,
            ease_factor: sm2.ease_factor,
            interval_days: sm2.interval_days,
            review_count: sm2.review_count,
            next_review_at: new Date(
              Date.now() + sm2.interval_days * 86400 * 1000
            ).toISOString(),
          };
        })
        .filter(Boolean);

      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert(progressPayload as object[], {
          onConflict: 'user_id,term_id',
          ignoreDuplicates: false,
        });

      if (progressError) throw new Error(progressError.message);

      set({ phase: 'complete', saved: progressPayload.length });
    } catch (err) {
      set({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }, [set]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    set({ phase: 'idle', error: null });
  }, [set]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    set({ phase: 'idle', error: null, enriched: 0, total: 0, saved: 0 });
  }, [set]);

  return { progress, runImport, cancel, reset };
}
