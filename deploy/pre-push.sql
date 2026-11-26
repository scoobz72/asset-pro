-- Runs before `drizzle-kit push` on every deploy (see deploy.sh). Every statement is
-- safe to repeat. It prepares existing rows so the push can add new keys without
-- failing, and carries data from columns the push is about to drop.

-- Nov 2026 data model (docs/data-import-plan.md, section 1)
DO $$
BEGIN
  -- Old forms stored "" when no supplier was picked; the new supplier links need NULL.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    UPDATE inventory SET primary_supplier_id = NULL
      WHERE primary_supplier_id = ''
         OR primary_supplier_id NOT IN (SELECT id FROM suppliers s WHERE s.company_id = inventory.company_id);
    UPDATE inventory SET secondary_supplier_id = NULL
      WHERE secondary_supplier_id = ''
         OR secondary_supplier_id NOT IN (SELECT id FROM suppliers s WHERE s.company_id = inventory.company_id);
  END IF;

  -- The new unique (company, asset, part) key: drop duplicate spares rows first.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_parts') THEN
    DELETE FROM asset_parts a USING asset_parts b
      WHERE a.id > b.id AND a.company_id = b.company_id AND a.asset_id = b.asset_id AND a.part_id = b.part_id;
  END IF;

  -- Suppliers: copy the old free-text contact and lead time into the new typed columns
  -- before the push drops the old ones.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact') THEN
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email text;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name text;
    UPDATE suppliers SET email = lower(trim(contact)) WHERE email IS NULL AND contact LIKE '%@%';
    UPDATE suppliers SET contact_name = trim(contact) WHERE contact_name IS NULL AND contact IS NOT NULL AND contact NOT LIKE '%@%';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'lead_time') THEN
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days integer;
    -- "2-3 days" becomes 3 (the upper figure); text with no number is left blank.
    UPDATE suppliers
      SET lead_time_days = (SELECT max(m[1]::int) FROM regexp_matches(lead_time, '(\d+)', 'g') AS m)
      WHERE lead_time_days IS NULL AND lead_time ~ '\d';
  END IF;
END $$;
