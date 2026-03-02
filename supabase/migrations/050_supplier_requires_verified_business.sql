-- Only allow adding suppliers when the business (company adding the supplier) is verified.
-- If the business is not registered/verified, insert and update fail.

CREATE OR REPLACE FUNCTION check_business_supplier_business_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  biz_status TEXT;
BEGIN
  SELECT status INTO biz_status
  FROM businesses
  WHERE id = NEW.business_id;
  IF biz_status IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;
  IF biz_status <> 'Verified' THEN
    RAISE EXCEPTION 'Your business must be verified to add suppliers. Current status: %', biz_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_supplier_business_verified ON business_suppliers;
CREATE TRIGGER enforce_supplier_business_verified
  BEFORE INSERT OR UPDATE OF business_id
  ON business_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION check_business_supplier_business_verified();

COMMENT ON FUNCTION check_business_supplier_business_verified() IS 'Ensures business_suppliers rows are only created/updated when the linked business has status Verified.';
