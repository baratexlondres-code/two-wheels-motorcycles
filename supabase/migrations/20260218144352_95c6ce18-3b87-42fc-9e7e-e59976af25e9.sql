
-- Workshop settings key-value store
CREATE TABLE public.workshop_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to workshop_settings" ON public.workshop_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.workshop_settings (key, value) VALUES
  ('workshop_name', 'Two Wheels Motorcycles'),
  ('workshop_phone', ''),
  ('workshop_email', ''),
  ('workshop_address', ''),
  ('auto_lock_minutes', '10'),
  ('owner_password', 'twowheels2024'),
  ('staff_password', 'workshop2024'),
  ('currency', '£'),
  ('vat_rate', '20');
