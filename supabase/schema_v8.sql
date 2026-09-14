-- Run in Supabase SQL Editor after schema.sql ... schema_v7.sql. Additive.
-- Place notes in the course hierarchy so they order like the official outline:
-- functional_area = the CSCP functional area, session = the individual lesson.
alter table public.notes add column if not exists functional_area text;
alter table public.notes add column if not exists session text;
