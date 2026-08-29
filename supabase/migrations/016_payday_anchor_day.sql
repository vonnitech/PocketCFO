ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payday_anchor_day INTEGER
CHECK (payday_anchor_day IS NULL OR payday_anchor_day BETWEEN 1 AND 31);
