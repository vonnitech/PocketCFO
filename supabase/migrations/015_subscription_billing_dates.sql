ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS next_billing_date DATE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_next_billing
ON public.subscriptions (user_id, next_billing_date);
