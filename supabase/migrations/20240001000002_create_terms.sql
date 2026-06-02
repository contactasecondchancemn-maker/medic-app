-- terms
-- The core vocabulary content table. Publicly readable; write-protected to service role.

create table public.terms (
  id           uuid primary key default gen_random_uuid(),
  term         text not null,
  ipa          text,
  definition   text not null,
  etymology    text,
  system_tag   text,
  difficulty   smallint check (difficulty between 1 and 5),
  step1_rating smallint check (step1_rating between 1 and 5)
);

alter table public.terms enable row level security;

-- All authenticated users may read terms.
create policy "terms: select authenticated"
  on public.terms for select
  to authenticated
  using (true);

-- Content is managed via the Supabase dashboard or service-role migrations only.
-- No client-side insert / update / delete policies are granted.

create index terms_system_tag_idx on public.terms (system_tag);
create index terms_difficulty_idx  on public.terms (difficulty);
