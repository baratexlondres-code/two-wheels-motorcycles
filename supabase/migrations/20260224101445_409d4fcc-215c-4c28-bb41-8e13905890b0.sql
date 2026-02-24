
-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true);

-- Allow anyone to read invoice PDFs (they are public)
CREATE POLICY "Invoice PDFs are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

-- Allow authenticated users to upload invoice PDFs
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to delete invoice PDFs
CREATE POLICY "Authenticated users can delete invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices');
