
-- Add invoice/payment fields to repair_jobs
ALTER TABLE public.repair_jobs 
  ADD COLUMN labor_cost NUMERIC DEFAULT 0,
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial')),
  ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN invoice_number TEXT;

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') AND NEW.invoice_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1 
    INTO next_num FROM public.repair_jobs WHERE invoice_number IS NOT NULL;
    NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_number
BEFORE UPDATE ON public.repair_jobs
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();
