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
