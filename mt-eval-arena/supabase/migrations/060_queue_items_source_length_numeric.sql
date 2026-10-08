-- 060_queue_items_source_length_numeric.sql (2026-07-20)
--
-- queue_items.source_length carries the registry richness `mean_source_chars`
-- (a FRACTIONAL mean, e.g. 19.0), not an integer entry count. 059 typed it int,
-- which rejects the served queue.json value ("invalid input syntax for type
-- integer: 19.0"). Widen to numeric so the DB row matches the served value
-- exactly (the parity contract). Safe: queue_items starts empty.
alter table public.queue_items
  alter column source_length type numeric using source_length::numeric;
