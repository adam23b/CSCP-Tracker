-- Run this in Supabase SQL Editor AFTER schema.sql and schema_v2.sql.
-- Safe to run once on an existing project — everything here is additive.

-- Flashcards can now carry a topic label and an exam-priority flag.
-- topic:         short subject tag within the module (e.g. "EOQ", "Safety stock")
-- exam_priority: 'high' | 'medium' | 'low' — how likely/important for the exam
alter table public.cards add column if not exists topic text;
alter table public.cards add column if not exists exam_priority text;
