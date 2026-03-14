-- Store contract document URLs (Invoice, Agreement, Delivery Terms) for supply contracts
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS contract_document_urls TEXT[] DEFAULT NULL;

COMMENT ON COLUMN escrows.contract_document_urls IS 'URLs of uploaded contract documents (invoice, agreement, delivery terms) for supply contracts.';
