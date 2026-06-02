-- Shared enums used across multiple tables.
-- Created in a separate migration so tables can reference them freely.

create type public.persona as enum (
  'competitor',
  'pre_clinical',
  'clinical',
  'instructor'
);

create type public.language_origin as enum (
  'greek',
  'latin'
);

create type public.deck_source as enum (
  'manual',
  'anki_import',
  'ai_generated'
);
