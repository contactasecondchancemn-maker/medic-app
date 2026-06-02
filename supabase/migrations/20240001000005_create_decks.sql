-- decks and deck_items
-- User-owned flashcard collections with ordered term membership.

create table public.decks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  name       text not null,
  source     public.deck_source not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "decks: select own"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "decks: insert own"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "decks: update own"
  on public.decks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decks: delete own"
  on public.decks for delete
  using (auth.uid() = user_id);

-- deck_items ──────────────────────────────────────────────────────────────────

create table public.deck_items (
  deck_id  uuid not null references public.decks (id) on delete cascade,
  term_id  uuid not null references public.terms (id) on delete cascade,
  "order"  integer not null default 0,
  primary key (deck_id, term_id)
);

alter table public.deck_items enable row level security;

-- Inherit access from the parent deck via a subquery so no extra joins are needed.
create policy "deck_items: select own"
  on public.deck_items for select
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_items.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_items: insert own"
  on public.deck_items for insert
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_items.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_items: update own"
  on public.deck_items for update
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_items.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy "deck_items: delete own"
  on public.deck_items for delete
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_items.deck_id
        and decks.user_id = auth.uid()
    )
  );

create index deck_items_order_idx on public.deck_items (deck_id, "order");
