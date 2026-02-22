
-- Table 1: motorcycle_brands
CREATE TABLE public.motorcycle_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL UNIQUE,
  country TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.motorcycle_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to motorcycle_brands" ON public.motorcycle_brands FOR ALL USING (true) WITH CHECK (true);

-- Table 2: motorcycle_models
CREATE TABLE public.motorcycle_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.motorcycle_brands(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Naked',
  engine_cc TEXT NOT NULL DEFAULT '125cc',
  vehicle_type TEXT NOT NULL DEFAULT 'Motorcycle' CHECK (vehicle_type IN ('Motorcycle', 'Scooter')),
  active_status BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.motorcycle_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to motorcycle_models" ON public.motorcycle_models FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_motorcycle_models_brand ON public.motorcycle_models(brand_id);
CREATE INDEX idx_motorcycle_models_category ON public.motorcycle_models(category);
CREATE INDEX idx_motorcycle_models_engine ON public.motorcycle_models(engine_cc);
CREATE INDEX idx_motorcycle_brands_name ON public.motorcycle_brands(brand_name);

-- Insert all UK brands
INSERT INTO public.motorcycle_brands (brand_name, country) VALUES
('Honda','Japan'),('Yamaha','Japan'),('Suzuki','Japan'),('Kawasaki','Japan'),
('BMW','Germany'),('Ducati','Italy'),('Triumph','UK'),('KTM','Austria'),
('Aprilia','Italy'),('Moto Guzzi','Italy'),('Harley-Davidson','USA'),('Indian','USA'),
('Royal Enfield','India'),('Benelli','Italy'),('CFMoto','China'),('Keeway','Hungary'),
('Lexmoto','UK'),('Sinnis','UK'),('SYM','Taiwan'),('Kymco','Taiwan'),
('Piaggio','Italy'),('Vespa','Italy'),('Peugeot','France'),('AJS','UK'),
('Brixton','Austria'),('Zontes','China'),('Mash','France'),('Mondial','Italy'),
('Zero Motorcycles','USA'),('Super Soco','China'),('Horwin','China'),('Rieju','Spain'),
('Sherco','France'),('Beta','Italy'),('GasGas','Spain'),('Husqvarna','Austria'),
('MV Agusta','Italy'),('Bimota','Italy'),('Can-Am','Canada'),('Daelim','South Korea'),
('Hyosung','South Korea'),('Lambretta','Italy'),('Malaguti','Italy'),('WK Bikes','UK'),
('Voge','China'),('Hanway','China'),('Herald Motor Co','UK'),('Mutts Motorcycles','UK');

-- Insert popular UK models
INSERT INTO public.motorcycle_models (brand_id, model_name, category, engine_cc, vehicle_type) VALUES
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Honda'),'CB125F','Naked','125cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Honda'),'CBR650R','Sport','650cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Honda'),'Africa Twin 1100','Adventure','1100cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Honda'),'PCX 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Honda'),'Forza 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Yamaha'),'R125','Sport','125cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Yamaha'),'MT-07','Naked','700cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Yamaha'),'Tenere 700','Adventure','700cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Yamaha'),'NMAX 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Yamaha'),'TMAX 560','Maxi Scooter','560cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Suzuki'),'GSX-R125','Sport','125cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Suzuki'),'V-Strom 650','Adventure','650cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Suzuki'),'Burgman 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Kawasaki'),'Ninja 650','Sport','650cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Kawasaki'),'Z900','Naked','900cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='BMW'),'R1250GS','Adventure','1250cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='BMW'),'S1000RR','Super Sport','1000cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='BMW'),'C400X','Scooter','400cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Triumph'),'Street Triple 765','Naked','765cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Triumph'),'Tiger 900','Adventure','900cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='KTM'),'Duke 390','Naked','390cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='KTM'),'Adventure 890','Adventure','890cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Royal Enfield'),'Meteor 350','Cruiser','350cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Royal Enfield'),'Interceptor 650','Retro Classic','650cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Lexmoto'),'LXR 125','Sport','125cc','Motorcycle'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Lexmoto'),'Aura 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='SYM'),'Jet 14 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Kymco'),'Agility 125','Scooter','125cc','Scooter'),
((SELECT id FROM public.motorcycle_brands WHERE brand_name='Vespa'),'Primavera 125','Scooter','125cc','Scooter');
