
-- Table for service line items on repair jobs (like repair_parts but for labor/services)
CREATE TABLE public.repair_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_job_id UUID NOT NULL REFERENCES public.repair_jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to repair_services" ON public.repair_services FOR ALL USING (true) WITH CHECK (true);
