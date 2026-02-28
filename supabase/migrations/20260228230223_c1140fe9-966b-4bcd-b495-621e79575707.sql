
-- 1. Create mechanics table
CREATE TABLE public.mechanics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  default_commission_percentage NUMERIC NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for mechanics
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to mechanics" ON public.mechanics FOR ALL USING (true) WITH CHECK (true);

-- 2. Extend repair_services with mechanic, commission, type
ALTER TABLE public.repair_services 
  ADD COLUMN mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE SET NULL,
  ADD COLUMN commission_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN commission_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN service_type TEXT NOT NULL DEFAULT 'standard';

-- 3. Extend repair_jobs with service_order_number, estimated_completion_date, locked
ALTER TABLE public.repair_jobs
  ADD COLUMN service_order_number INTEGER,
  ADD COLUMN estimated_completion_date DATE,
  ADD COLUMN locked BOOLEAN NOT NULL DEFAULT false;

-- 4. Create sequence trigger for service_order_number
CREATE OR REPLACE FUNCTION public.generate_service_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.service_order_number IS NULL THEN
    SELECT COALESCE(MAX(service_order_number), 0) + 1 INTO next_num FROM public.repair_jobs;
    NEW.service_order_number := next_num;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_service_order_number
  BEFORE INSERT ON public.repair_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_service_order_number();

-- 5. Backfill existing repair_jobs with service_order_number
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.repair_jobs
  WHERE service_order_number IS NULL
)
UPDATE public.repair_jobs SET service_order_number = numbered.rn
FROM numbered WHERE public.repair_jobs.id = numbered.id;
