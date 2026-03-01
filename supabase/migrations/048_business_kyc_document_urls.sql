-- Business KYC: document URLs for Identity, Address, and Enhanced Due Diligence (PDF or image).
ALTER TABLE business_suite_kyc
  ADD COLUMN IF NOT EXISTS identity_verification_document_url TEXT,
  ADD COLUMN IF NOT EXISTS address_verification_document_url TEXT,
  ADD COLUMN IF NOT EXISTS enhanced_due_diligence_document_url TEXT;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS identity_verification_document_url TEXT,
  ADD COLUMN IF NOT EXISTS address_verification_document_url TEXT,
  ADD COLUMN IF NOT EXISTS enhanced_due_diligence_document_url TEXT;

COMMENT ON COLUMN business_suite_kyc.identity_verification_document_url IS 'Stored URL for identity verification document (PDF or image)';
COMMENT ON COLUMN business_suite_kyc.address_verification_document_url IS 'Stored URL for address verification document (PDF or image)';
COMMENT ON COLUMN business_suite_kyc.enhanced_due_diligence_document_url IS 'Stored URL for enhanced due diligence document (PDF or image)';
