-- Purchasing and currency (docs/asset-stock-jobs-plan.md phase P).
-- Safe to run any number of times; runs in one transaction.

-- ---------------------------------------------------------------- currency and limits
ALTER TABLE companies ADD COLUMN IF NOT EXISTS home_currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
-- Managers and Admins start with unlimited approval, set only when the column is first added
-- (so limits changed later on the Team page are never overwritten by a re-run).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'po_approval_limit') THEN
    ALTER TABLE users ADD COLUMN po_approval_limit numeric(14, 2);
    UPDATE users SET po_approval_limit = 999999999999.99 WHERE role IN ('Manager', 'Admin', 'PlatformAdmin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS exchange_rates (
  rate_date date NOT NULL,
  currency text NOT NULL,
  per_eur numeric(18, 8) NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (rate_date, currency)
);

ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS original_unit_cost numeric(12, 4);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS exchange_rate numeric(18, 8);
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS original_unit_cost numeric(12, 4);
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS exchange_rate numeric(18, 8);

-- ---------------------------------------------------------------- purchase orders
ALTER TABLE purchase_orders ALTER COLUMN total TYPE numeric(12, 2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS exchange_rate numeric(18, 8);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate_date date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate_source text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_home numeric(12, 2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_date date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by_id integer;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by_id integer;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_by_id integer;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason text;
-- Older POs: GBP, valued at face value; linked to a supplier when the name matches exactly one.
UPDATE purchase_orders SET total_home = total, exchange_rate = 1, rate_source = 'Home'
 WHERE total_home IS NULL AND currency = 'GBP' AND status <> 'Draft';
UPDATE purchase_orders po SET supplier_id = s.id
  FROM suppliers s
 WHERE po.supplier_id IS NULL AND s.company_id = po.company_id AND lower(s.name) = lower(po.vendor)
   AND (SELECT count(*) FROM suppliers s2 WHERE s2.company_id = po.company_id AND lower(s2.name) = lower(po.vendor)) = 1;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id text NOT NULL,
  line_no integer NOT NULL,
  part_id text,
  description text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(12, 4) NOT NULL,
  quantity_received integer NOT NULL DEFAULT 0,
  quantity_cancelled integer NOT NULL DEFAULT 0,
  company_id integer NOT NULL,
  CONSTRAINT purchase_order_lines_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT purchase_order_lines_po_fk FOREIGN KEY (company_id, po_id) REFERENCES purchase_orders(company_id, id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_lines_part_fk FOREIGN KEY (company_id, part_id) REFERENCES inventory(company_id, id),
  CONSTRAINT purchase_order_lines_po_line_key UNIQUE (company_id, po_id, line_no),
  CONSTRAINT purchase_order_lines_quantities_check CHECK (quantity > 0 AND quantity_received >= 0 AND quantity_cancelled >= 0 AND quantity_received + quantity_cancelled <= quantity)
);
CREATE TABLE IF NOT EXISTS goods_receipts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by text,
  delivery_note text,
  exchange_rate numeric(18, 8) NOT NULL,
  rate_date date,
  rate_source text,
  company_id integer NOT NULL,
  CONSTRAINT goods_receipts_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT goods_receipts_po_fk FOREIGN KEY (company_id, po_id) REFERENCES purchase_orders(company_id, id)
);
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id integer NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id integer NOT NULL REFERENCES purchase_order_lines(id),
  quantity integer NOT NULL,
  transaction_id text,
  company_id integer NOT NULL REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS po_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  user_name text,
  action text NOT NULL,
  note text,
  company_id integer NOT NULL,
  CONSTRAINT po_events_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT po_events_po_fk FOREIGN KEY (company_id, po_id) REFERENCES purchase_orders(company_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS po_events_po_idx ON po_events (company_id, po_id, at);

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('purchase_orders', 'purchase_orders_supplier_fk', 'FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers(company_id, id)'),
    ('purchase_orders', 'purchase_orders_job_fk', 'FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id)')
  ) AS v(tbl, name, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', c.tbl, c.name, c.def);
    END IF;
  END LOOP;
END $$;
