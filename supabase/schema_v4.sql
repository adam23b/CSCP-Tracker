-- Run this in Supabase SQL Editor AFTER schema.sql, schema_v2.sql, schema_v3.sql.
-- Additive and safe to run once.

-- Flashcards can carry the official CSCP study-guide functional area
-- (the named sub-section within a module, e.g. "Forecasting", "Inventory").
alter table public.cards add column if not exists functional_area text;
