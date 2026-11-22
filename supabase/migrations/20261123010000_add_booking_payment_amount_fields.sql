-- Preserve booking value and payment state for accurate business intelligence.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('paid', 'pending', 'pay_at_venue'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_amount_nonnegative_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_amount_nonnegative_check
  CHECK (amount >= 0);
