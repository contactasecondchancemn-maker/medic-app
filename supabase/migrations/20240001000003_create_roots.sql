-- roots
-- Greek and Latin word roots with their linked term IDs.

create table public.roots (
  id           uuid primary key default gen_random_uuid(),
  root         text not null,
  language     public.language_origin not null,
  meaning      text not null,
  linked_terms uuid[] not null default '{}'
);

alter table public.roots enable row level security;

-- All authenticated users may read roots.
create policy "roots: select authenticated"
  on public.roots for select
  to authenticated
  using (true);

create index roots_language_idx on public.roots (language);
-- GIN index enables efficient array containment queries: WHERE linked_terms @> ARRAY[term_id]
create index roots_linked_terms_gin_idx on public.roots using gin (linked_terms);
