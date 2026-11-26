-- Nov 2026 data model (docs/data-import-plan.md, section 1).
-- Safe to run any number of times: every step checks whether it is already done.
-- Runs in one transaction (deploy.sh uses --single-transaction), so it applies fully or not at all.

-- ---------------------------------------------------------------- sites, locations
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS postcode text;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Other';

-- ---------------------------------------------------------------- store rooms, bins
CREATE TABLE IF NOT EXISTS store_rooms (
  id text NOT NULL,
  name text NOT NULL,
  site_id text NOT NULL,
  company_id integer NOT NULL,
  CONSTRAINT store_rooms_pkey PRIMARY KEY (company_id, id),
  CONSTRAINT store_rooms_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT store_rooms_site_fk FOREIGN KEY (company_id, site_id) REFERENCES sites(company_id, id)
);
CREATE TABLE IF NOT EXISTS bins (
  id text NOT NULL,
  store_room_id text NOT NULL,
  description text,
  company_id integer NOT NULL,
  CONSTRAINT bins_pkey PRIMARY KEY (company_id, id),
  CONSTRAINT bins_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT bins_store_room_fk FOREIGN KEY (company_id, store_room_id) REFERENCES store_rooms(company_id, id)
);

-- ---------------------------------------------------------------- suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days integer;
DO $$
BEGIN
  -- Copy the old free-text contact and lead time into the typed columns, then drop them.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact') THEN
    UPDATE suppliers SET email = lower(trim(contact)) WHERE email IS NULL AND contact LIKE '%@%';
    UPDATE suppliers SET contact_name = trim(contact) WHERE contact_name IS NULL AND contact IS NOT NULL AND contact NOT LIKE '%@%';
    ALTER TABLE suppliers DROP COLUMN contact;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'lead_time') THEN
    -- "2-3 days" becomes 3 (the upper figure); text with no number is left blank.
    UPDATE suppliers
      SET lead_time_days = (SELECT max(m[1]::int) FROM regexp_matches(lead_time, '(\d+)', 'g') AS m)
      WHERE lead_time_days IS NULL AND lead_time ~ '\d';
    ALTER TABLE suppliers DROP COLUMN lead_time;
  END IF;
END $$;

-- ---------------------------------------------------------------- inventory (parts)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit_cost numeric(10, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_qty integer;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bin_id text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS manufacturer_part_no text;
ALTER TABLE inventory DROP COLUMN IF EXISTS location;  -- replaced by bins
-- Old forms stored "" when no supplier was picked; the new supplier links need NULL.
UPDATE inventory i SET primary_supplier_id = NULL
  WHERE primary_supplier_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.company_id = i.company_id AND s.id = i.primary_supplier_id);
UPDATE inventory i SET secondary_supplier_id = NULL
  WHERE secondary_supplier_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.company_id = i.company_id AND s.id = i.secondary_supplier_id);

-- ---------------------------------------------------------------- assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS criticality text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS install_date date;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id text;

-- ---------------------------------------------------------------- asset spares
ALTER TABLE asset_parts ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
DELETE FROM asset_parts a USING asset_parts b
  WHERE a.id > b.id AND a.company_id = b.company_id AND a.asset_id = b.asset_id AND a.part_id = b.part_id;

-- ---------------------------------------------------------------- jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ---------------------------------------------------------------- keys
-- Added only if missing (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('inventory', 'inventory_bin_fk', 'FOREIGN KEY (company_id, bin_id) REFERENCES bins(company_id, id)'),
    ('inventory', 'inventory_primary_supplier_fk', 'FOREIGN KEY (company_id, primary_supplier_id) REFERENCES suppliers(company_id, id)'),
    ('inventory', 'inventory_secondary_supplier_fk', 'FOREIGN KEY (company_id, secondary_supplier_id) REFERENCES suppliers(company_id, id)'),
    ('assets', 'assets_parent_fk', 'FOREIGN KEY (company_id, parent_asset_id) REFERENCES assets(company_id, id)'),
    ('asset_parts', 'asset_parts_company_asset_part_key', 'UNIQUE (company_id, asset_id, part_id)')
  ) AS v(tbl, name, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', c.tbl, c.name, c.def);
    END IF;
  END LOOP;
END $$;
