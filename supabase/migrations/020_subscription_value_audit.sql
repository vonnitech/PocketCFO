-- Value Audit context for subscriptions.
--
-- Two text columns, both nullable and both user-entered. The app has no usage
-- telemetry, so it cannot compute "2.4 hrs/day" or "$17.70 / visit" for itself.
-- Storing them as free text the user writes keeps the figures honest; deriving
-- them would mean printing measurements nothing measured.
--
-- No roi_status column on purpose: subscriptions.usage already holds
-- Active/Low Use/Idle and already drives the green/amber/red treatment. A second
-- status field would be able to disagree with the first.

alter table public.subscriptions
  add column if not exists context_metric  text,
  add column if not exists suggested_action text;

comment on column public.subscriptions.context_metric is
  'User-entered value context, e.g. "2.4 hrs/day" or "$17.70 / visit". Not computed.';
comment on column public.subscriptions.suggested_action is
  'User-entered next step, e.g. "Downgrade to Photo Plan". Not computed.';
