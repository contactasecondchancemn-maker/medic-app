import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';

// ─── Types ───────────────────────────────────────────────────────────────────────────────────

export interface SystemMastery {
  system: BodySystem;
  label: string;
  totalCards: number;
  masteredCards: number;
  ratio: number;
}

export interface HomeData {
  cardsDue: number;
  estimatedMinutes: number;
  streakDays: number;
  lastStudiedAt: string | null;
  systemMastery: SystemMastery[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const SYSTEM_LABELS: Partial<Record<BodySystem, string>> = {
  cardiovascular:      'Cardiovascular',
  nervous:             'Neurology',
  respiratory:         'Respiratory',
  gastrointestinal:    'GI',
  pharmacology:        'Pharmacology',
  biochemistry:        'Biochemistry',
  microbiology:        'Microbiology',
  pathology:           'Pathology',
  endocrine:           'Endocrine',
  musculoskeletal:     'MSK',
  renal_urinary:       'Renal',
  hematology_oncology: 'Heme/Onc',
  immune_lymphatic:    'Immunology',
  psychiatry:          'Psychiatry',
  reproductive:        'Reproductive',
  dermatology:         'Dermatology',
  anatomy:             'Anatomy',
  embryology:          'Embryology',
  ophthalmology:       'Ophthalmology',
  otolaryngology:      'ENT',
  general_principles:  'General',
};

const SECONDS_PER_CARD = 15;

// ─── Hook ──────────────────────────────────────────────────────────────────────────────────

export function useHomeData(): HomeData {
  const [cardsDue, setCardsDue]          = useState(0);
  const [streakDays, setStreakDays]       = useState(0);
  const [lastStudiedAt, setLastStudiedAt] = useState<string | null>(null);
  const [systemMastery, setSystemMastery] = useState<SystemMastery[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: dueData, error: dueErr } = await supabase.rpc('get_due_cards_count');
      if (dueErr) throw new Error(dueErr.message);
      setCardsDue(Number(dueData ?? 0));

      const { data: streakData, error: streakErr } = await supabase
        .from('user_progress')
        .select('next_review_at')
        .order('next_review_at', { ascending: false })
        .limit(1);
      if (streakErr) throw new Error(streakErr.message);
      setLastStudiedAt(streakData?.[0]?.next_review_at ?? null);

      const { data: logData, error: logErr } = await supabase
        .from('review_log')
        .select('reviewed_at')
        .order('reviewed_at', { ascending: false })
        .limit(365);
      if (!logErr && logData && logData.length > 0) {
        setStreakDays(computeStreak(logData.map((r) => r.reviewed_at as string)));
      } else {
        setStreakDays(0);
      }

      const { data: progressData, error: progressErr } = await supabase
        .from('user_progress')
        .select('confidence, terms!inner(system_tag)');
      if (progressErr) throw new Error(progressErr.message);

      const counts = new Map<BodySystem, { total: number; mastered: number }>();
      for (const row of (progressData ?? []) as Array<{ confidence: number; terms: { system_tag: string | null } }>) {
        const sys = row.terms?.system_tag as BodySystem | null;
        if (!sys) continue;
        const entry = counts.get(sys) ?? { total: 0, mastered: 0 };
        entry.total++;
        if (row.confidence >= 4) entry.mastered++;
        counts.set(sys, entry);
      }

      const mastery: SystemMastery[] = [...counts.entries()]
        .filter(([, v]) => v.total >= 3)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 8)
        .map(([system, { total, mastered }]) => ({
          system,
          label: SYSTEM_LABELS[system] ?? system,
          totalCards: total,
          masteredCards: mastered,
          ratio: total > 0 ? mastered / total : 0,
        }));

      setSystemMastery(mastery);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const estimatedMinutes = Math.max(1, Math.ceil((cardsDue * SECONDS_PER_CARD) / 60));

  return {
    cardsDue,
    estimatedMinutes,
    streakDays,
    lastStudiedAt,
    systemMastery,
    loading,
    error,
    refresh: load,
  };
}

function computeStreak(isoDates: string[]): number {
  const days = new Set(isoDates.map((d) => d.slice(0, 10)));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
