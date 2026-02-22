
-- Add MOT expiry date to motorcycles table
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS mot_expiry_date date;
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS last_service_type text;
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS last_service_date timestamp with time zone;

-- WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'promotion',
  message_body text NOT NULL,
  variables text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to whatsapp_templates" ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);

-- WhatsApp campaigns
CREATE TABLE public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'promotion',
  template_id uuid REFERENCES public.whatsapp_templates(id),
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  target_filter jsonb DEFAULT '{}',
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_read integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to whatsapp_campaigns" ON public.whatsapp_campaigns FOR ALL USING (true) WITH CHECK (true);

-- WhatsApp message log
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  whatsapp_message_id text,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (true) WITH CHECK (true);

-- WhatsApp automation settings
CREATE TABLE public.whatsapp_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to whatsapp_settings" ON public.whatsapp_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.whatsapp_settings (key, value) VALUES
  ('automation_enabled', 'false'),
  ('max_promo_per_week', '1'),
  ('max_messages_per_month', '2'),
  ('high_value_threshold', '500'),
  ('oil_change_interval_months', '6'),
  ('mot_reminder_30_days', 'true'),
  ('mot_reminder_7_days', 'true'),
  ('inactive_6_months', 'true'),
  ('inactive_12_months', 'true'),
  ('weekly_promotion', 'true'),
  ('soft_invitation', 'true');

-- Insert default message templates
INSERT INTO public.whatsapp_templates (name, category, message_body, variables) VALUES
  ('Free Check Offer', 'promotion', 'Hello {{FirstName}}, this is TwoWheels.\n\nThis week we are offering a free safety check for your {{VehicleModel}}.\n\nIf you''d like us to take a quick look and make sure everything is running perfectly, just reply to this message and we''ll book you in.\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('Oil Service Promotion', 'promotion', 'Hello {{FirstName}}, this is TwoWheels.\n\nWe''re running a special oil service promotion this week for scooters and motorcycles.\n\nProtect your engine and avoid costly repairs.\n\nWould you like to reserve a spot?\n\nTwoWheels', '{FirstName}'),
  ('Brake Safety Campaign', 'promotion', 'Hello {{FirstName}}, this is TwoWheels.\n\nBrakes are one of the most important safety components on your {{VehicleModel}}.\n\nThis week we are offering discounted brake inspections.\n\nLet us know if you''d like to book.\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('Soft Invitation', 'relationship', 'Hello {{FirstName}}, this is TwoWheels.\n\nIf you''re passing by this week, feel free to stop in with your {{VehicleModel}} for a quick check or just to say hello.\n\nWe''re always happy to make sure everything is running smoothly.\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('High Value Customer', 'vip', 'Hello {{FirstName}}, this is TwoWheels.\n\nAs one of our valued customers, we''d like to offer you priority booking this week.\n\nIf your {{VehicleModel}} needs anything, we''re ready to assist you.\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('MOT Reminder 30 Days', 'reminder', 'Hello {{FirstName}}, this is TwoWheels.\n\nJust a friendly reminder that the MOT for your {{VehicleModel}} ({{LicensePlate}}) expires on {{MOTDate}}.\n\nWould you like us to book it in for you?\n\nTwoWheels', '{FirstName,VehicleModel,LicensePlate,MOTDate}'),
  ('MOT Reminder 7 Days', 'reminder', 'Hello {{FirstName}}, this is TwoWheels.\n\nYour MOT for {{VehicleModel}} ({{LicensePlate}}) expires in 7 days.\n\nDon''t leave it to the last minute — reply to book your slot.\n\nTwoWheels', '{FirstName,VehicleModel,LicensePlate}'),
  ('Oil Change Due', 'reminder', 'Hello {{FirstName}}, this is TwoWheels.\n\nIt''s been a while since the last oil service on your {{VehicleModel}}.\n\nRegular oil changes protect your engine and keep everything running smoothly.\n\nWould you like to book an appointment?\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('Inactive 6 Months', 'reactivation', 'Hello {{FirstName}}, this is TwoWheels.\n\nWe noticed it''s been a while since your last visit with your {{VehicleModel}}.\n\nEverything OK? If you need anything — service, check-up, or just advice — we''re here for you.\n\nTwoWheels', '{FirstName,VehicleModel}'),
  ('Inactive 12 Months', 'reactivation', 'Hello {{FirstName}}, this is TwoWheels.\n\nIt''s been over a year since we last saw your {{VehicleModel}}.\n\nWe''d love to welcome you back. Come by for a free check-up — no obligations.\n\nTwoWheels', '{FirstName,VehicleModel}');

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
