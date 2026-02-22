
-- Motorcycle inventory (bikes available for sale)
CREATE TABLE public.motorcycle_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  registration TEXT,
  vin TEXT,
  mileage INTEGER DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'used',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.motorcycle_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to motorcycle_inventory"
ON public.motorcycle_inventory FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_motorcycle_inventory_updated_at
BEFORE UPDATE ON public.motorcycle_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Motorcycle sales records
CREATE TABLE public.motorcycle_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES public.motorcycle_inventory(id),
  customer_id UUID REFERENCES public.customers(id),
  sale_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.motorcycle_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to motorcycle_sales"
ON public.motorcycle_sales FOR ALL
USING (true) WITH CHECK (true);
