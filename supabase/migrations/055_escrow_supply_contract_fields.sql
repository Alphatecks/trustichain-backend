-- Supplier contract modal: contract title and delivery method (for escrows with transaction_type = 'supply')
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS contract_title TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT;

COMMENT ON COLUMN escrows.contract_title IS 'Title of the contract (e.g. Smartphone Parts Shipment); used for supply contracts.';
COMMENT ON COLUMN escrows.delivery_method IS 'Delivery method: Physical Goods, Digital Delivery, or Service; used for supply contracts.';
