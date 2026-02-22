
-- Add ON DELETE CASCADE to all tables referencing customers

ALTER TABLE public.motorcycles DROP CONSTRAINT motorcycles_customer_id_fkey;
ALTER TABLE public.motorcycles ADD CONSTRAINT motorcycles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.repair_jobs DROP CONSTRAINT repair_jobs_customer_id_fkey;
ALTER TABLE public.repair_jobs ADD CONSTRAINT repair_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.motorcycle_sales DROP CONSTRAINT motorcycle_sales_customer_id_fkey;
ALTER TABLE public.motorcycle_sales ADD CONSTRAINT motorcycle_sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.accessory_sales DROP CONSTRAINT accessory_sales_customer_id_fkey;
ALTER TABLE public.accessory_sales ADD CONSTRAINT accessory_sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT whatsapp_messages_customer_id_fkey;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- Also cascade repair_jobs children
ALTER TABLE public.repair_parts DROP CONSTRAINT repair_parts_repair_job_id_fkey;
ALTER TABLE public.repair_parts ADD CONSTRAINT repair_parts_repair_job_id_fkey FOREIGN KEY (repair_job_id) REFERENCES public.repair_jobs(id) ON DELETE CASCADE;

ALTER TABLE public.repair_services DROP CONSTRAINT repair_services_repair_job_id_fkey;
ALTER TABLE public.repair_services ADD CONSTRAINT repair_services_repair_job_id_fkey FOREIGN KEY (repair_job_id) REFERENCES public.repair_jobs(id) ON DELETE CASCADE;

-- Cascade motorcycles -> repair_jobs
ALTER TABLE public.repair_jobs DROP CONSTRAINT repair_jobs_motorcycle_id_fkey;
ALTER TABLE public.repair_jobs ADD CONSTRAINT repair_jobs_motorcycle_id_fkey FOREIGN KEY (motorcycle_id) REFERENCES public.motorcycles(id) ON DELETE CASCADE;
