
-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- Motorcycles table (linked to customers)
CREATE TABLE public.motorcycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  registration TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  vin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to motorcycles" ON public.motorcycles FOR ALL USING (true) WITH CHECK (true);

-- Stock items table
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  location TEXT,
  is_accessory BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to stock_items" ON public.stock_items FOR ALL USING (true) WITH CHECK (true);

-- Stock movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

-- Repair jobs
CREATE TABLE public.repair_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'diagnosing', 'waiting_parts', 'in_repair', 'ready', 'delivered', 'cancelled')),
  description TEXT NOT NULL,
  diagnosis TEXT,
  estimated_cost NUMERIC(10,2),
  final_cost NUMERIC(10,2),
  notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repair_jobs" ON public.repair_jobs FOR ALL USING (true) WITH CHECK (true);

-- Repair parts (parts used in a repair job)
CREATE TABLE public.repair_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_job_id UUID NOT NULL REFERENCES public.repair_jobs(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repair_parts" ON public.repair_parts FOR ALL USING (true) WITH CHECK (true);

-- Accessory sales
CREATE TABLE public.accessory_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accessory_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to accessory_sales" ON public.accessory_sales FOR ALL USING (true) WITH CHECK (true);

-- Accessory sale items
CREATE TABLE public.accessory_sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.accessory_sales(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accessory_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to accessory_sale_items" ON public.accessory_sale_items FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_repair_jobs_updated_at BEFORE UPDATE ON public.repair_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate job number
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_number FROM 4) AS INTEGER)), 0) + 1 INTO next_num FROM public.repair_jobs;
  NEW.job_number := 'TW-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_job_number BEFORE INSERT ON public.repair_jobs FOR EACH ROW EXECUTE FUNCTION public.generate_job_number();

-- Stock movement trigger to update quantities
CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE public.stock_items SET quantity = quantity + NEW.quantity WHERE id = NEW.stock_item_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE public.stock_items SET quantity = quantity - NEW.quantity WHERE id = NEW.stock_item_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.stock_items SET quantity = NEW.quantity WHERE id = NEW.stock_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER stock_movement_trigger AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_movement();
