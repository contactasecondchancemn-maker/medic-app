-- Add optional filter columns to terms

alter table public.terms
  add column if not exists body_region text,
  add column if not exists organ text;

create index if not exists terms_body_region_idx
  on public.terms (body_region)
  where body_region is not null;

create index if not exists terms_organ_idx
  on public.terms (organ)
  where organ is not null;

-- get_due_cards: returns due cards with optional filters
-- All filter params are nullable text[] or smallint; null means no filter applied.

create or replace function public.get_due_cards(
  card_limit     int      default 50,
  p_body_systems text[]   default null,
  p_regions      text[]   default null,
  p_organs       text[]   default null,
  p_diff_min     smallint default null,
  p_diff_max     smallint default null
)
returns table (
  term_id        uuid,
  term           text,
  ipa            text,
  definition     text,
  body_system    text,
  confidence     smallint,
  next_review_at timestamptz,
  review_count   int,
  ease_factor    numeric,
  interval_days  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id           as term_id,
    t.term,
    t.ipa,
    t.definition,
    t.body_system::text,
    up.confidence,
    up.next_review_at,
    up.review_count,
    up.ease_factor,
    up.interval_days
  from public.user_progress up
  join public.terms t on t.id = up.term_id
  where up.user_id = auth.uid()
    and up.next_review_at <= now()
    and (p_body_systems is null or t.body_system::text = any(p_body_systems))
    and (p_regions      is null or t.body_region        = any(p_regions))
    and (p_organs       is null or t.organ              = any(p_organs))
    and (p_diff_min     is null or coalesce(t.difficulty, 3) >= p_diff_min)
    and (p_diff_max     is null or coalesce(t.difficulty, 3) <= p_diff_max)
  order by up.next_review_at asc
  limit card_limit;
$$;

grant execute on function public.get_due_cards(int, text[], text[], text[], smallint, smallint)
  to authenticated;

-- get_due_cards_count: same filters, returns only the count
-- Used by the session filter live-preview badge.

create or replace function public.get_due_cards_count(
  p_body_systems text[]   default null,
  p_regions      text[]   default null,
  p_organs       text[]   default null,
  p_diff_min     smallint default null,
  p_diff_max     smallint default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.user_progress up
  join public.terms t on t.id = up.term_id
  where up.user_id = auth.uid()
    and up.next_review_at <= now()
    and (p_body_systems is null or t.body_system::text = any(p_body_systems))
    and (p_regions      is null or t.body_region        = any(p_regions))
    and (p_organs       is null or t.organ              = any(p_organs))
    and (p_diff_min     is null or coalesce(t.difficulty, 3) >= p_diff_min)
    and (p_diff_max     is null or coalesce(t.difficulty, 3) <= p_diff_max);
$$;

grant execute on function public.get_due_cards_count(text[], text[], text[], smallint, smallint)
  to authenticated;
