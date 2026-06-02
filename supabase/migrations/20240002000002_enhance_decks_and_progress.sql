-- Phase 2 — enhance decks and user_progress for the Smart Flashcard System
--
-- decks:         description, is_public, tags[]
-- deck_items:    added_at timestamp
-- user_progress: SM-2 spaced-repetition fields (ease_factor, interval_days,
--                last_reviewed_at) + convenience denormalised next_review_at index

-- 1. decks ─────────────────────────────────────────────────────────────────────

alter table public.decks
  add column description   text,
  add column is_public     boolean  not null default false,
  add column tags          text[]   not null default '{}',
  add column updated_at    timestamptz not null default now();

-- Public decks are readable by all authenticated users.
create policy "decks: select public"
  on public.decks for select
  to authenticated
  using (is_public = true);

create index decks_is_public_idx on public.decks (is_public) where is_public = true;
create index decks_tags_gin_idx  on public.decks using gin (tags);

-- Auto-update updated_at on any row change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger decks_updated_at
  before update on public.decks
  for each row execute procedure public.set_updated_at();

-- 2. deck_items ────────────────────────────────────────────────────────────────

alter table public.deck_items
  add column added_at timestamptz not null default now();

-- 3. user_progress — SM-2 spaced-repetition fields ────────────────────────────
--
-- SM-2 algorithm state:
--   ease_factor    multiplier for interval growth (initial: 2.5, floor: 1.3)
--   interval_days  current review interval in days
--   last_reviewed_at  wall-clock time of most recent review session

alter table public.user_progress
  add column ease_factor      numeric(4,2) not null default 2.50
                              check (ease_factor >= 1.30),
  add column interval_days    integer      not null default 1
                              check (interval_days >= 1),
  add column last_reviewed_at timestamptz;

-- 4. Due-cards function ────────────────────────────────────────────────────────
--
-- Returns every term due for review for the calling user, ordered by urgency.
-- Usage: select * from get_due_cards();

create or replace function public.get_due_cards(
  card_limit int default 50
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
  order by up.next_review_at asc
  limit card_limit;
$$;

grant execute on function public.get_due_cards(int) to authenticated;

-- 5. SM-2 review update function ──────────────────────────────────────────────
--
-- Applies one SM-2 iteration for a given term after the user rates their recall.
-- quality: 0–5  (0–2 = failed, 3–5 = passed; mirrors the standard SM-2 scale)
--
-- Usage: select update_card_review('<term_uuid>', 4);

create or replace function public.update_card_review(
  p_term_id uuid,
  p_quality smallint   -- 0 (blackout) … 5 (perfect)
)
returns void
language plpgsql
security definer
as $$
declare
  v_ef       numeric(4,2);
  v_interval integer;
  v_count    integer;
  v_new_ef   numeric(4,2);
  v_new_int  integer;
begin
  select ease_factor, interval_days, review_count
    into v_ef, v_interval, v_count
    from public.user_progress
   where user_id = auth.uid() and term_id = p_term_id;

  if not found then
    raise exception 'No progress record for term %', p_term_id;
  end if;

  -- Update ease factor (SM-2 formula).
  v_new_ef := greatest(1.30,
    v_ef + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02))
  );

  -- Calculate next interval.
  if p_quality < 3 then
    -- Failed recall: restart from day 1.
    v_new_int := 1;
  elsif v_count = 0 then
    v_new_int := 1;
  elsif v_count = 1 then
    v_new_int := 6;
  else
    v_new_int := ceil(v_interval * v_new_ef);
  end if;

  update public.user_progress
     set ease_factor      = v_new_ef,
         interval_days    = v_new_int,
         confidence       = least(5, greatest(1, p_quality::smallint)),
         review_count     = review_count + 1,
         last_reviewed_at = now(),
         next_review_at   = now() + (v_new_int || ' days')::interval
   where user_id = auth.uid() and term_id = p_term_id;
end;
$$;

grant execute on function public.update_card_review(uuid, smallint) to authenticated;
