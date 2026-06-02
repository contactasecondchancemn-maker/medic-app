-- user_progress
-- Per-user spaced-repetition state for each term.

create table public.user_progress (
  user_id       uuid not null references public.users (id) on delete cascade,
  term_id       uuid not null references public.terms (id) on delete cascade,
  confidence    smallint not null default 1 check (confidence between 1 and 5),
  next_review_at timestamptz not null default now(),
  review_count  integer not null default 0,
  primary key (user_id, term_id)
);

alter table public.user_progress enable row level security;

create policy "user_progress: select own"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "user_progress: insert own"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "user_progress: update own"
  on public.user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_progress: delete own"
  on public.user_progress for delete
  using (auth.uid() = user_id);

create index user_progress_next_review_idx
  on public.user_progress (user_id, next_review_at);
