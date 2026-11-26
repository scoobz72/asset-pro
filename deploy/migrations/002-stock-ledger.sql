-- Stock ledger (docs/asset-stock-jobs-plan.md 1.1): FIFO lots, stock-take history and
-- costed, linked transactions. Safe to run any number of times; runs in one transaction.

-- ---------------------------------------------------------------- transactions
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS unit_cost numeric(12, 4);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS value numeric(12, 2);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS balance_after integer;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS asset_id text;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS po_id text;
-- Older rows: use their ISO "date" text where it has one, otherwise the migration time.
UPDATE stock_transactions
   SET created_at = CASE WHEN date ~ '^\d{4}-\d{2}-\d{2}([T ][0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$' THEN date::timestamptz ELSE now() END
 WHERE created_at IS NULL;
ALTER TABLE stock_transactions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE stock_transactions ALTER COLUMN created_at SET NOT NULL;
-- Older job book-outs used free text; the ledger's name for an issue to a job is "Job Issue".
UPDATE stock_transactions SET type = 'Job Issue' WHERE type = 'Job Book Out';

-- ---------------------------------------------------------------- lots and stock takes
CREATE TABLE IF NOT EXISTS stock_lots (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  quantity_received integer NOT NULL,
  quantity_remaining integer NOT NULL,
  unit_cost numeric(12, 4) NOT NULL DEFAULT 0,
  transaction_id text,
  company_id integer NOT NULL,
  CONSTRAINT stock_lots_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_lots_part_fk FOREIGN KEY (company_id, part_id) REFERENCES inventory(company_id, id)
);
CREATE TABLE IF NOT EXISTS stock_takes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_id text NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  expected integer NOT NULL,
  counted integer NOT NULL,
  user_name text,
  company_id integer NOT NULL,
  CONSTRAINT stock_takes_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_takes_part_fk FOREIGN KEY (company_id, part_id) REFERENCES inventory(company_id, id)
);
CREATE INDEX IF NOT EXISTS stock_lots_open_idx ON stock_lots (company_id, part_id, received_at);
CREATE INDEX IF NOT EXISTS stock_takes_part_idx ON stock_takes (company_id, part_id, counted_at);
CREATE INDEX IF NOT EXISTS stock_transactions_part_idx ON stock_transactions (company_id, part_id, created_at);

-- ---------------------------------------------------------------- links
-- Clear links that point at nothing before adding the keys.
UPDATE stock_transactions t SET job_id = NULL
  WHERE job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.company_id = t.company_id AND j.id = t.job_id);
UPDATE stock_transactions t SET asset_id = NULL
  WHERE asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.company_id = t.company_id AND a.id = t.asset_id);
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('stock_transactions', 'stock_transactions_job_fk', 'FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id)'),
    ('stock_transactions', 'stock_transactions_asset_fk', 'FOREIGN KEY (company_id, asset_id) REFERENCES assets(company_id, id)')
  ) AS v(tbl, name, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', c.tbl, c.name, c.def);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- opening lots
-- Stock on hand before the ledger becomes one opening lot per part at its unit cost, so FIFO
-- has something to draw from. Only parts with stock and no lots yet are touched.
INSERT INTO stock_lots (company_id, part_id, quantity_received, quantity_remaining, unit_cost, transaction_id)
SELECT i.company_id, i.id, i.stock, i.stock, coalesce(i.unit_cost, 0), NULL
  FROM inventory i
 WHERE i.stock > 0
   AND NOT EXISTS (SELECT 1 FROM stock_lots l WHERE l.company_id = i.company_id AND l.part_id = i.id);
