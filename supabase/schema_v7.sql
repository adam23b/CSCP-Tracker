-- Run in Supabase SQL Editor after schema.sql ... schema_v6.sql. Additive.
-- Per-card saved context: answers from "Ask Claude about this card" that the
-- user chose to keep, shown again on the card's back on next review.
alter table public.cards add column if not exists context text;
