import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { BodySystem } from '../components/FlashCard';
import { type QueueFilters, EMPTY_FILTERS } from './useReviewQueue';

// ─── Static data ────────────────────────────────────────────────────────────────────

export const BODY_SYSTEMS: Array<{ value: BodySystem; label: string }> = [
  { value: 'cardiovascular',     label: 'Cardiovascular'  },
  { value: 'nervous',            label: 'Neurology'       },
  { value: 'respiratory',        label: 'Respiratory'     },
  { value: 'gastrointestinal',   label: 'GI'              },
  { value: 'pharmacology',       label: 'Pharmacology'    },
  { value: 'biochemistry',       label: 'Biochemistry'    },
  { value: 'microbiology',       label: 'Microbiology'    },
  { value: 'pathology',          label: 'Pathology'       },
  { value: 'endocrine',          label: 'Endocrine'       },
  { value: 'musculoskeletal',    label: 'MSK'             },
  { value: 'renal_urinary',      label: 'Renal'           },
  { value: 'hematology_oncology','label': 'Heme/Onc'      },
  { value: 'immune_lymphatic',   label: 'Immunology'      },
  { value: 'psychiatry',         label: 'Psychiatry'      },
  { value: 'reproductive',       label: 'Reproductive'    },
  { value: 'dermatology',        label: 'Dermatology'     },
  { value: 'anatomy',            label: 'Anatomy'         },
  { value: 'embryology',         label: 'Embryology'      },
  { value: 'ophthalmology',      label: 'Ophthalmology'   },
  { value: 'otolaryngology',     label: 'ENT'             },
  { value: 'general_principles', label: 'General'         },
];

export const BODY_REGIONS = [
  'Head & Neck',
  'Thorax',
  'Abdomen',
  'Pelvis',
  'Upper Limb',
  'Lower Limb',
  'Spine',
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number];

// Organs organized by body system — used to populate the organ picker
// contextually when systems are selected.
export const ORGANS_BY_SYSTEM: Partial<Record<BodySystem, string[]>> = {
  cardiovascular:   ['Heart', 'Aorta', 'Coronary Arteries', 'Veins', 'Pericardium'],
  nervous:          ['Brain', 'Spinal Cord', 'Cerebellum', 'Brainstem', 'Peripheral Nerves'],
  respiratory:      ['Lungs', 'Trachea', 'Bronchi', 'Diaphragm', 'Pleura'],
  gastrointestinal: ['Esophagus', 'Stomach', 'Small Intestine', 'Large Intestine', 'Liver', 'Pancreas', 'Gallbladder'],
  endocrine:        ['Thyroid', 'Parathyroid', 'Adrenal Glands', 'Pituitary', 'Pancreatic Islets'],
  renal_urinary:    ['Kidney', 'Ureter', 'Bladder', 'Urethra'],
  reproductive:     ['Ovaries', 'Uterus', 'Testes', 'Prostate', 'Fallopian Tubes'],
  musculoskeletal:  ['Bone', 'Cartilage', 'Tendons', 'Ligaments', 'Skeletal Muscle', 'Joints'],
  immune_lymphatic: ['Thymus', 'Spleen', 'Lymph Nodes', 'Tonsils', 'Bone Marrow'],
  hematology_oncology: ['Blood', 'Bone Marrow', 'Lymphoma Tissue'],
  dermatology:      ['Skin', 'Hair Follicles', 'Nails', 'Sebaceous Glands', 'Sweat Glands'],
  ophthalmology:    ['Retina', 'Cornea', 'Lens', 'Optic Nerve', 'Vitreous'],
  otolaryngology:   ['Ear', 'Nose', 'Sinuses', 'Pharynx', 'Larynx', 'Salivary Glands'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionFilterState {
  filters: QueueFilters;
  liveCount: number | null;   // null = loading
  countLoading: boolean;
  countError: string | null;
  availableOrgans: string[];  // derived from selected body systems
}

// ─── Debounce helper ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────────

export function useSessionFilter() {
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Debounce filter changes so the count RPC fires at most once per 400 ms.
  const debouncedFilters = useDebounce(filters, 400);

  // ── Derive available organs from selected body systems ────────────────────

  const availableOrgans: string[] = filters.bodySystems?.length
    ? [...new Set(
        filters.bodySystems.flatMap((s) => ORGANS_BY_SYSTEM[s] ?? [])
      )].sort()
    : Object.values(ORGANS_BY_SYSTEM).flat().sort();

  // ── Live count ───────────────────────────────────────────────────────────────

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setCountLoading(true);
    setCountError(null);

    supabase
      .rpc('get_due_cards_count', {
        p_body_systems: debouncedFilters.bodySystems?.length ? debouncedFilters.bodySystems : null,
        p_regions:      debouncedFilters.regions?.length     ? debouncedFilters.regions     : null,
        p_organs:       debouncedFilters.organs?.length      ? debouncedFilters.organs      : null,
        p_diff_min:     debouncedFilters.difficultyMin ?? null,
        p_diff_max:     debouncedFilters.difficultyMax ?? null,
      })
      .then(({ data, error }) => {
        if (abortRef.current?.signal.aborted) return;
        if (error) {
          setCountError(error.message);
        } else {
          setLiveCount(Number(data ?? 0));
        }
        setCountLoading(false);
      });

    return () => abortRef.current?.abort();
  }, [debouncedFilters]);

  // ── Filter mutators ────────────────────────────────────────────────────────────

  const toggleBodySystem = useCallback((system: BodySystem) => {
    setFilters((prev) => {
      const current = prev.bodySystems ?? [];
      const next = current.includes(system)
        ? current.filter((s) => s !== system)
        : [...current, system];
      return {
        ...prev,
        bodySystems: next.length > 0 ? next : null,
        // Clear organs that no longer belong to any selected system
        organs: prev.organs?.filter((o) =>
          (next.length > 0 ? next : (Object.keys(ORGANS_BY_SYSTEM) as BodySystem[]))
            .some((s) => ORGANS_BY_SYSTEM[s]?.includes(o))
        ) ?? null,
      };
    });
  }, []);

  const toggleRegion = useCallback((region: string) => {
    setFilters((prev) => {
      const current = prev.regions ?? [];
      const next = current.includes(region)
        ? current.filter((r) => r !== region)
        : [...current, region];
      return { ...prev, regions: next.length > 0 ? next : null };
    });
  }, []);

  const toggleOrgan = useCallback((organ: string) => {
    setFilters((prev) => {
      const current = prev.organs ?? [];
      const next = current.includes(organ)
        ? current.filter((o) => o !== organ)
        : [...current, organ];
      return { ...prev, organs: next.length > 0 ? next : null };
    });
  }, []);

  const setDifficultyRange = useCallback((min: number | null, max: number | null) => {
    setFilters((prev) => ({ ...prev, difficultyMin: min, difficultyMax: max }));
  }, []);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const activeFilterCount =
    (filters.bodySystems?.length ?? 0) +
    (filters.regions?.length ?? 0) +
    (filters.organs?.length ?? 0) +
    (filters.difficultyMin !== null || filters.difficultyMax !== null ? 1 : 0);

  return {
    filters,
    liveCount,
    countLoading,
    countError,
    availableOrgans,
    activeFilterCount,
    toggleBodySystem,
    toggleRegion,
    toggleOrgan,
    setDifficultyRange,
    clearFilters,
  };
}
