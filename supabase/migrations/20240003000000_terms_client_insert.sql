-- Phase 3 — allow authenticated users to insert terms (needed for AI card
-- generation and Anki import) and add a unique constraint on the term text
-- so upsert-on-conflict works from the client.

-- 1. Unique constraint ──────────────────────────────────────────────────────────────────────
--
-- Anki import and AI generation both upsert on term text.  Without this
-- constraint PostgREST cannot perform the ON CONFLICT clause.

alter table public.terms
  add constraint terms_term_unique unique (term);

-- 2. RLS — authenticated insert ───────────────────────────────────────────────────
--
-- Users may insert new terms.  No update or delete is granted — edits still
-- go through the service-role (dashboard / migrations).

create policy "terms: insert authenticated"
  on public.terms for insert
  to authenticated
  with check (true);
