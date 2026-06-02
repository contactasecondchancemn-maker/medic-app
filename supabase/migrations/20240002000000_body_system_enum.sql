-- Phase 2 — body_system enum
-- Replaces the free-text system_tag with a typed enum covering every
-- USMLE Step 1 / Step 2 organ system and discipline category.

create type public.body_system as enum (
  'anatomy',
  'biochemistry',
  'cardiovascular',
  'dermatology',
  'embryology',
  'endocrine',
  'gastrointestinal',
  'general_principles',
  'hematology_oncology',
  'immune_lymphatic',
  'microbiology',
  'musculoskeletal',
  'nervous',
  'ophthalmology',
  'otolaryngology',
  'pathology',
  'pharmacology',
  'psychiatry',
  'renal_urinary',
  'reproductive',
  'respiratory'
);
