ALTER TABLE public.repair_jobs ADD COLUMN IF NOT EXISTS parts_cost numeric DEFAULT NULL;
ALTER TABLE public.repair_jobs ADD COLUMN IF NOT EXISTS services_cost numeric DEFAULT NULL;