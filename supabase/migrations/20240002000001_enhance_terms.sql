-- Phase 2 — enhance terms table for 5 000+ medical terms
--
-- Adds:
--   body_system      typed enum column (replaces free-text system_tag)
--   abbreviation     e.g. "MI", "HTN", "COPD"
--   also_known_as    array of synonyms / alternate spellings
--   related_term_ids self-referencing uuid[] for concept linking
--   etymology_parts  structured JSONB breakdown of prefix / root / suffix
--   search_vector    weighted tsvector for full-text search
--
-- Keeps system_tag for backward compatibility; body_system is the canonical column.

-- 1. New columns ──────────────────────────────────────────────────────────────

alter table public.terms
  add column body_system      public.body_system,
  add column abbreviation     text,
  add column also_known_as    text[]    not null default '{}',
  add column related_term_ids uuid[]    not null default '{}',
  add column etymology_parts  jsonb     not null default '{}',
  add column search_vector    tsvector;

-- etymology_parts expected shape:
-- {
--   "parts": [
--     { "type": "prefix|root|suffix", "value": "cardio",
--       "meaning": "heart", "language": "greek|latin" }
--   ]
-- }

-- 2. Indexes ───────────────────────────────────────────────────────────────────

-- Primary full-text search index — GIN on the maintained tsvector.
create index terms_search_vector_idx
  on public.terms using gin (search_vector);

-- Fast lookup by typed body system.
create index terms_body_system_idx
  on public.terms (body_system);

-- Array containment: find all terms that list a given related term.
create index terms_related_term_ids_gin_idx
  on public.terms using gin (related_term_ids);

-- Abbreviation lookup (exact match is common in clinical queries).
create index terms_abbreviation_idx
  on public.terms (abbreviation)
  where abbreviation is not null;

-- 3. Search vector trigger ─────────────────────────────────────────────────────
--
-- Weights:
--   A  term name          — highest relevance
--   B  abbreviation       — near-exact clinical shorthand
--   C  also_known_as[]    — synonyms
--   D  definition         — broad prose match

create or replace function public.terms_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.term, '')),        'A') ||
    setweight(to_tsvector('english', coalesce(new.abbreviation, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(new.also_known_as, ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.definition, '')),   'D');
  return new;
end;
$$;

create trigger terms_search_vector_trigger
  before insert or update of
    term, abbreviation, also_known_as, definition
  on public.terms
  for each row execute procedure public.terms_search_vector_update();

-- 4. Full-text search helper function ─────────────────────────────────────────
--
-- Returns ranked terms matching a free-text query.
-- Usage: select * from search_terms('myocardial infarction', 20);

create or replace function public.search_terms(
  query       text,
  result_limit int default 20
)
returns table (
  id           uuid,
  term         text,
  abbreviation text,
  ipa          text,
  definition   text,
  body_system  public.body_system,
  difficulty   smallint,
  step1_rating smallint,
  rank         real
)
language sql
stable
as $$
  select
    t.id,
    t.term,
    t.abbreviation,
    t.ipa,
    t.definition,
    t.body_system,
    t.difficulty,
    t.step1_rating,
    ts_rank_cd(t.search_vector, websearch_to_tsquery('english', query)) as rank
  from public.terms t
  where t.search_vector @@ websearch_to_tsquery('english', query)
  order by rank desc
  limit result_limit;
$$;

-- Grant execute to authenticated users.
grant execute on function public.search_terms(text, int) to authenticated;
