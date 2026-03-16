-- Supplier proof-of-completion documents (uploaded by supplier for supply contracts)
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS supplier_completion_document_urls TEXT[] DEFAULT NULL;

COMMENT ON COLUMN escrows.supplier_completion_document_urls IS 'URLs of proof-of-completion documents uploaded by the supplier (supply escrows).';
