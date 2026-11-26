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
