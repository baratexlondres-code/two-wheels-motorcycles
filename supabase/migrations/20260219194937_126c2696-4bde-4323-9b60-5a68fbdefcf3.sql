
CREATE TABLE public.service_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  labor_category TEXT DEFAULT 'Small',
  default_price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to service_catalog" ON public.service_catalog FOR ALL USING (true) WITH CHECK (true);
