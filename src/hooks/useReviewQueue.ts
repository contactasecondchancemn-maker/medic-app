import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAILY_CAP = 150;
export const SECONDS_PER_CARD = 15;

// Fetch ceiling — we pull up to this many from the DB so we have full info
// for catch-up compression before capping at DAILY_CAP.
const MAX_FETCH = 500;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DueCard {
  termId: string;
  term: string;
  ipa?: string;
  definition: string;
  bodySystem?: BodySystem;
  confidence: number;
  nextReviewAt: string;
  reviewCount: number;
  easeFactor: number;   // SM-2 multiplier; lower = harder = higher priority
  intervalDays: number;
}

export type QueueStatus = 'idle' | 'loading' | 'ready' | 'active' | 'complete' | 'error';

export interface ReviewQueue {
  // ── State ──
  status: QueueStatus;
  error: string | null;

  // ── Pre-session metadata ──
  totalDue: number;           // raw overdue count before compression
  sessionCards: DueCard[];    // compressed, capped queue
  sessionCount: number;       // sessionCards.length
  estimatedMinutes: number;   // ceil(sessionCount * SECONDS_PER_CARD / 60)
  isCatchUpSession: boolean;  // totalDue > DAILY_CAP
  catchUpRemainder: number;   // cards deferred to tomorrow

  // ── Active session ──
  currentIndex: number;
  currentCard: DueCard | null;
  completedCount: number;
  progress: number;           // 0–1 fraction of session done
  qualities: number[];        // SM-2 quality recorded per card
  averageQuality: number | null;

  // ── Actions ──
  startSession: () => void;
  markReviewed: (quality: number) => void;
  skipCard: () => void;
  endSession: () => void;
  reload: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToCard(row: Record<string, unknown>): DueCard {
  return {
    termId:        row.term_id     as string,
    term:          row.term        as string,
    ipa:           (row.ipa        as string | null) ?? undefined,
    definition:    row.definition  as string,
    bodySystem:    (row.body_system as BodySystem | null) ?? undefined,
    confidence:    row.confidence  as number,
    nextReviewAt:  row.next_review_at as string,
    reviewCount:   row.review_count   as number,
    easeFactor:    Number(row.ease_factor),
    intervalDays:  row.interval_days  as number,
  };
}

// Catch-up compression:
//   1. Sort all overdue cards by ease_factor ASC (struggling cards first).
//   2. Cap at DAILY_CAP to prevent burnout on long absences.
function compress(cards: DueCard[]): DueCard[] {
  const sorted = [...cards].sort((a, b) => a.easeFactor - b.easeFactor);
  return sorted.slice(0, DAILY_CAP);
}

function estimateMinutes(count: number): number {
  return Math.max(1, Math.ceil((count * SECONDS_PER_CARD) / 60));
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReviewQueue(): ReviewQueue {
  const [status, setStatus]           = useState<QueueStatus>('idle');
  const [error, setError]             = useState<string | null>(null);
  const [allDue, setAllDue]           = useState<DueCard[]>([]);
  const [sessionCards, setSessionCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qualities, setQualities]     = useState<number[]>([]);

  const currentIndexRef = useRef(currentIndex);
  const sessionCardsRef = useRef(sessionCards);
  const qualitiesRef    = useRef(qualities);
  currentIndexRef.current  = currentIndex;
  sessionCardsRef.current  = sessionCards;
  qualitiesRef.current     = qualities;

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setCurrentIndex(0);
    setQualities([]);

    const { data, error: rpcError } = await supabase.rpc('get_due_cards', {
      card_limit: MAX_FETCH,
    });

    if (rpcError) {
      setError(rpcError.message);
      setStatus('error');
      return;
    }

    const cards = ((data as unknown[]) ?? []).map((r) =>
      rowToCard(r as Record<string, unknown>)
    );

    setAllDue(cards);
    setSessionCards(compress(cards));
    setStatus('ready');
  }, []);

  useEffect(() => { load(); }, [load]);

  const startSession = useCallback(() => {
    if (sessionCardsRef.current.length === 0) return;
    setCurrentIndex(0);
    setQualities([]);
    setStatus('active');
  }, []);

  const advance = useCallback((quality: number | null) => {
    const next = currentIndexRef.current + 1;
    if (quality !== null) {
      setQualities((prev) => [...prev, quality]);
    }
    if (next >= sessionCardsRef.current.length) {
      setStatus('complete');
    } else {
      setCurrentIndex(next);
    }
  }, []);

  const markReviewed = useCallback((quality: number) => { advance(quality); }, [advance]);
  const skipCard     = useCallback(() => { advance(null); }, [advance]);
  const endSession   = useCallback(() => { setStatus('complete'); }, []);
  const reload       = useCallback(() => { load(); }, [load]);

  const totalDue         = allDue.length;
  const sessionCount     = sessionCards.length;
  const isCatchUpSession = totalDue > DAILY_CAP;
  const catchUpRemainder = Math.max(0, totalDue - DAILY_CAP);
  const completedCount   = status === 'complete' ? sessionCount : currentIndex;
  const progress         = sessionCount > 0 ? completedCount / sessionCount : 0;
  const currentCard      = status === 'active' ? (sessionCards[currentIndex] ?? null) : null;
  const averageQuality   = mean(qualities);

  return {
    status, error,
    totalDue, sessionCards, sessionCount,
    estimatedMinutes: estimateMinutes(sessionCount),
    isCatchUpSession, catchUpRemainder,
    currentIndex, currentCard, completedCount, progress,
    qualities, averageQuality,
    startSession, markReviewed, skipCard, endSession, reload,
  };
}
