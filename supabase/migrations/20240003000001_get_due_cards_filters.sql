-- Phase 3 — extend get_due_cards() with optional filter parameters
--
-- New optional parameters (all nullable — null means "no filter"):
--   p_body_systems   body_system[]   — multi-select systems
--   p_regions        text[]          — anatomical regions (Head & Neck, Thorax, …)
--   p_organs         text[]          — free-text organ names (stored in terms.organ)
--   p_diff_min       smallint        — difficulty lower bound (inclusive)
--   p_diff_max       smallint        — difficulty upper bound (inclusive)
--
-- Also adds the helper function get_due_cards_count() which returns just the
-- integer count for the live-preview badge (avoids shipping full rows to the client).
--
-- Adds terms.body_region and terms.organ columns used by the filter system.

-- 1. New columns on terms ────────────────────────────────────────────────────────────────

alter table public.terms
  add column if not exists body_region text,  -- e.g. 'Head & Neck', 'Thorax'
  add column if not exists organ       text;  -- e.g. 'Heart', 'Kidney'

create index if not exists terms_body_region_idx on public.terms (body_region)
  where body_region is not null;
create index if not exists terms_organ_idx on public.terms (organ)
  where organ is not null;

-- 2. Filtered get_due_cards ───────────────────────────────────────────────────────────────

create or replace function public.get_due_cards(
  card_limit    int              default 50,
  p_body_systems public.body_system[] default null,
  p_regions     text[]           default null,
  p_organs      text[]           default null,
  p_diff_min    smallint         default null,
  p_diff_max    smallint         default null
)
returns table (
  term_id        uuid,
  term           text,
  ipa            text,
  definition     text,
  body_system    public.body_system,
  confidence     smallint,
  next_review_at timestamptz,
  review_count   int,
  ease_factor    numeric,
  interval_days  int
)
language sql
stable
security definer
as $$
  select
    t.id,
    t.term,
    t.ipa,
    t.definition,
    t.body_system,
    up.confidence,
    up.next_review_at,
    up.review_count,
    up.ease_factor,
    up.interval_days
  from public.user_progress up
  join public.terms t on t.id = up.term_id
  where up.user_id = auth.uid()
    and up.next_review_at <= now()
    -- body system filter (null = all systems)
    and (p_body_systems is null or t.body_system = any(p_body_systems))
    -- region filter
    and (p_regions is null or t.body_region = any(p_regions))
    -- organ filter
    and (p_organs is null or t.organ = any(p_organs))
    -- difficulty range
    and (p_diff_min is null or coalesce(t.difficulty, 3) >= p_diff_min)
    and (p_diff_max is null or coalesce(t.difficulty, 3) <= p_diff_max)
  order by up.next_review_at asc
  limit card_limit;
$$;

grant execute on function public.get_due_cards(int, public.body_system[], text[], text[], smallint, smallint)
  to authenticated;

-- 3. Count helper ────────────────────────────────────────────────────────────────────
--
-- Identical WHERE clause, returns a single integer.
-- Used by the live filter badge without shipping card data.

create or replace function public.get_due_cards_count(
  p_body_systems public.body_system[] default null,
  p_regions     text[]           default null,
  p_organs      text[]           default null,
  p_diff_min    smallint         default null,
  p_diff_max    smallint         default null
)
returns bigint
language sql
stable
security definer
as $$
  select count(*)
  from public.user_progress up
  join public.terms t on t.id = up.term_id
  where up.user_id = auth.uid()
    and up.next_review_at <= now()
    and (p_body_systems is null or t.body_system = any(p_body_systems))
    and (p_regions      is null or t.body_region = any(p_regions))
    and (p_organs       is null or t.organ       = any(p_organs))
    and (p_diff_min is null or coalesce(t.difficulty, 3) >= p_diff_min)
    and (p_diff_max is null or coalesce(t.difficulty, 3) <= p_diff_max);
$$;

grant execute on function public.get_due_cards_count(public.body_system[], text[], text[], smallint, smallint)
  to authenticated;
