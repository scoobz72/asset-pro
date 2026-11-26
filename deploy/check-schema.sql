-- Fails (and stops deploy.sh) if the database is behind shared/schema.ts.
-- Selects zero rows from every table/column added since the previous release.
SELECT address, postcode FROM sites LIMIT 0;
SELECT type FROM locations LIMIT 0;
SELECT id, name, site_id FROM store_rooms LIMIT 0;
SELECT id, store_room_id, description FROM bins LIMIT 0;
SELECT contact_name, email, phone, lead_time_days FROM suppliers LIMIT 0;
SELECT unit_cost, reorder_qty, bin_id, manufacturer_part_no FROM inventory LIMIT 0;
SELECT category, manufacturer, model, serial_number, criticality, install_date, parent_asset_id FROM assets LIMIT 0;
SELECT quantity FROM asset_parts LIMIT 0;
SELECT created_at, completed_at FROM jobs LIMIT 0;
SELECT created_at, unit_cost, value, balance_after, job_id, asset_id, po_id FROM stock_transactions LIMIT 0;
SELECT id, part_id, received_at, quantity_received, quantity_remaining, unit_cost, transaction_id FROM stock_lots LIMIT 0;
SELECT id, part_id, counted_at, expected, counted, user_name FROM stock_takes LIMIT 0;
SELECT home_currency FROM companies LIMIT 0;
SELECT currency FROM suppliers LIMIT 0;
SELECT po_approval_limit FROM users LIMIT 0;
SELECT rate_date, currency, per_eur FROM exchange_rates LIMIT 0;
SELECT supplier_id, currency, exchange_rate, rate_date, rate_source, total_home, job_id, expected_date, notes, created_by_id, created_at, submitted_at, approved_by_id, approved_at, sent_by_id, sent_at, rejection_reason FROM purchase_orders LIMIT 0;
SELECT id, po_id, line_no, part_id, description, quantity, unit_price, quantity_received, quantity_cancelled FROM purchase_order_lines LIMIT 0;
SELECT id, po_id, received_at, delivery_note, exchange_rate FROM goods_receipts LIMIT 0;
SELECT id, receipt_id, po_line_id, quantity, transaction_id FROM goods_receipt_lines LIMIT 0;
SELECT id, po_id, at, action, note FROM po_events LIMIT 0;
SELECT currency, original_unit_cost, exchange_rate FROM stock_lots LIMIT 0;
SELECT currency, original_unit_cost, exchange_rate FROM stock_transactions LIMIT 0;
SELECT job_id, triaged_by, triaged_at, rejection_reason FROM maintenance_requests LIMIT 0;
