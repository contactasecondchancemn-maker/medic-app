import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';

// ─── Constants ────────────────────────────────────────────────────────────────────

export const DAILY_CAP = 150;
export const SECONDS_PER_CARD = 15;

const MAX_FETCH = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DueCard {
  termId: string;
  term: string;
  ipa?: string;
  definition: string;
  bodySystem?: BodySystem;
  confidence: number;
  nextReviewAt: string;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
}

export type QueueStatus = 'idle' | 'loading' | 'ready' | 'active' | 'complete' | 'error';

/** Filter params forwarded to get_due_cards(). null means "no filter". */
export interface QueueFilters {
  bodySystems:  BodySystem[] | null;
  regions:      string[]     | null;
  organs:       string[]     | null;
  difficultyMin: number      | null;  // 1–5
  difficultyMax: number      | null;  // 1–5
}

export const EMPTY_FILTERS: QueueFilters = {
  bodySystems:   null,
  regions:       null,
  organs:        null,
  difficultyMin: null,
  difficultyMax: null,
};

export function hasActiveFilters(f: QueueFilters): boolean {
  return (
    (f.bodySystems  !== null && f.bodySystems.length  > 0) ||
    (f.regions      !== null && f.regions.length      > 0) ||
    (f.organs       !== null && f.organs.length       > 0) ||
    f.difficultyMin !== null ||
    f.difficultyMax !== null
  );
}

export interface ReviewQueue {
  // ── State ──
  status: QueueStatus;
  error: string | null;

  // ── Pre-session metadata ──
  totalDue: number;
  sessionCards: DueCard[];
  sessionCount: number;
  estimatedMinutes: number;
  isCatchUpSession: boolean;
  catchUpRemainder: number;

  // ── Active session ──
  currentIndex: number;
  currentCard: DueCard | null;
  completedCount: number;
  progress: number;
  qualities: number[];
  averageQuality: number | null;

  // ── Actions ──
  startSession: () => void;
  markReviewed: (quality: number) => void;
  skipCard: () => void;
  endSession: () => void;
  reload: (filters?: QueueFilters) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function rowToCard(row: Record<string, unknown>): DueCard {
  return {
    termId:       row.term_id       as string,
    term:         row.term          as string,
    ipa:          (row.ipa          as string | null) ?? undefined,
    definition:   row.definition    as string,
    bodySystem:   (row.body_system  as BodySystem | null) ?? undefined,
    confidence:   row.confidence    as number,
    nextReviewAt: row.next_review_at as string,
    reviewCount:  row.review_count   as number,
    easeFactor:   Number(row.ease_factor),
    intervalDays: row.interval_days  as number,
  };
}

function compress(cards: DueCard[]): DueCard[] {
  return [...cards].sort((a, b) => a.easeFactor - b.easeFactor).slice(0, DAILY_CAP);
}

function estimateMinutes(count: number): number {
  return Math.max(1, Math.ceil((count * SECONDS_PER_CARD) / 60));
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
}

function filtersToRpcParams(f: QueueFilters) {
  return {
    p_body_systems: f.bodySystems && f.bodySystems.length > 0 ? f.bodySystems : null,
    p_regions:      f.regions     && f.regions.length     > 0 ? f.regions     : null,
    p_organs:       f.organs      && f.organs.length      > 0 ? f.organs      : null,
    p_diff_min:     f.difficultyMin ?? null,
    p_diff_max:     f.difficultyMax ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────────

export function useReviewQueue(initialFilters: QueueFilters = EMPTY_FILTERS): ReviewQueue {
  const [status, setStatus]             = useState<QueueStatus>('idle');
  const [error, setError]               = useState<string | null>(null);
  const [allDue, setAllDue]             = useState<DueCard[]>([]);
  const [sessionCards, setSessionCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qualities, setQualities]       = useState<number[]>([]);

  const currentIndexRef  = useRef(currentIndex);
  const sessionCardsRef  = useRef(sessionCards);
  const qualitiesRef     = useRef(qualities);
  currentIndexRef.current = currentIndex;
  sessionCardsRef.current = sessionCards;
  qualitiesRef.current    = qualities;

  const load = useCallback(async (filters: QueueFilters = EMPTY_FILTERS) => {
    setStatus('loading');
    setError(null);
    setCurrentIndex(0);
    setQualities([]);

    const { data, error: rpcError } = await supabase.rpc('get_due_cards', {
      card_limit: MAX_FETCH,
      ...filtersToRpcParams(filters),
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

  useEffect(() => { load(initialFilters); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = useCallback(() => {
    if (sessionCardsRef.current.length === 0) return;
    setCurrentIndex(0);
    setQualities([]);
    setStatus('active');
  }, []);

  const advance = useCallback((quality: number | null) => {
    const next = currentIndexRef.current + 1;
    if (quality !== null) setQualities((prev) => [...prev, quality]);
    if (next >= sessionCardsRef.current.length) {
      setStatus('complete');
    } else {
      setCurrentIndex(next);
    }
  }, []);

  const markReviewed = useCallback((quality: number) => advance(quality), [advance]);
  const skipCard     = useCallback(() => advance(null), [advance]);
  const endSession   = useCallback(() => setStatus('complete'), []);
  const reload       = useCallback((filters?: QueueFilters) => load(filters ?? EMPTY_FILTERS), [load]);

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
    currentIndex, currentCard, completedCount, progress, qualities, averageQuality,
    startSession, markReviewed, skipCard, endSession, reload,
  };
}
