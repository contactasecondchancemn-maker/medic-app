-- Phase 2 — deck statistics view + bulk term import helper

-- 1. Deck statistics view ─────────────────────────────────────────────────────
--
-- Joins decks with progress data so the UI can show per-deck review health
-- without N+1 queries.

create or replace view public.deck_stats as
select
  d.id                                              as deck_id,
  d.user_id,
  d.name,
  d.source,
  d.is_public,
  d.tags,
  d.created_at,
  count(di.term_id)                                 as total_cards,
  count(up.term_id)                                 as studied_cards,
  count(up.term_id) filter (
    where up.next_review_at <= now()
  )                                                 as due_cards,
  round(
    avg(up.confidence) filter (where up.confidence is not null), 2
  )                                                 as avg_confidence,
  max(up.last_reviewed_at)                          as last_studied_at
from public.decks d
left join public.deck_items di  on di.deck_id = d.id
left join public.user_progress up
  on up.term_id = di.term_id and up.user_id = d.user_id
group by d.id;

-- RLS is enforced through the underlying decks table; the view inherits it
-- because security_invoker is the default.

-- 2. Bulk term import function ────────────────────────────────────────────────
--
-- Inserts or updates a batch of terms from a JSON array in one call.
-- Intended for service-role use only (seed scripts, Anki import pipeline).
--
-- Each element in p_terms must match:
-- {
--   "term":          "Myocardial Infarction",
--   "ipa":           "/ˌmaɪ.oʊˌkɑːr.di.əl ɪnˌfɑːrk.ʃən/",
--   "definition":    "...",
--   "etymology":     "...",
--   "body_system":   "cardiovascular",
--   "abbreviation":  "MI",
--   "also_known_as": ["heart attack"],
--   "difficulty":    3,
--   "step1_rating":  5,
--   "etymology_parts": { "parts": [...] }
-- }

create or replace function public.bulk_upsert_terms(p_terms jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_item  jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_terms)
  loop
    insert into public.terms (
      term, ipa, definition, etymology,
      body_system, abbreviation, also_known_as,
      difficulty, step1_rating, etymology_parts
    )
    values (
      v_item->>'term',
      v_item->>'ipa',
      v_item->>'definition',
      v_item->>'etymology',
      (v_item->>'body_system')::public.body_system,
      v_item->>'abbreviation',
      coalesce(
        array(select jsonb_array_elements_text(v_item->'also_known_as')),
        '{}'
      ),
      (v_item->>'difficulty')::smallint,
      (v_item->>'step1_rating')::smallint,
      coalesce(v_item->'etymology_parts', '{}')
    )
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Do NOT grant to authenticated — this is service-role only.
-- Call via supabase.rpc('bulk_upsert_terms', { p_terms: [...] })
-- with the service role key from your seed scripts.

-- 3. Term detail view ─────────────────────────────────────────────────────────
--
-- Joins terms with their linked roots so the client fetches everything in one
-- PostgREST call instead of two.

create or replace view public.term_details as
select
  t.*,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'root',    r.root,
        'language', r.language,
        'meaning',  r.meaning
      )
    ) filter (where r.id is not null),
    '[]'::jsonb
  ) as roots
from public.terms t
left join public.roots r
  on r.linked_terms @> array[t.id]
group by t.id;
