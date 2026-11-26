# Plan: real data model, dashboards and Excel import

Status: **agreed scope, awaiting sign-off on the details below** (26 Nov 2026).
Branch: `move-off-replit`. Live at https://mycmms.co.uk (IONOS VPS, see `deploy/README.md`).

Work is in four parts, delivered together. Excel (.xlsx) handling needs a library
(planned: `exceljs`), so it must be added with `npm install` in a session that has
package installs enabled.

## 1. Data model additions

`*` = required. All tables keep `company_id` and composite keys (see `replit.md`).

| Table | New / changed fields |
|---|---|
| sites | address, postcode |
| locations (asset locations) | type: Building / Production area / Line / Room / Other |
| **store_rooms** (new) | id*, name*, site_id* |
| **bins** (new) | id*, store_room_id*, description |
| suppliers | contact name, email, phone; lead time becomes whole days |
| inventory (parts) | unit_cost (£), reorder_qty, bin_id (replaces free-text location), manufacturer_part_no |
| assets | category, manufacturer, model, serial_number, criticality (A/B/C), install_date, parent_asset_id |
| asset_parts | quantity |
| jobs | created_at (set automatically), completed_at (set when status becomes Completed) |

## 2. Real dashboards and reports

- Tile trends: this 7 days vs the previous 7 days, from job/asset/stock data.
- 7-day chart: jobs opened vs completed per day, from `created_at` / `completed_at`.
- MTBF: average time between breakdown jobs per asset. MTTR: average breakdown
  open→completed time. Shown as "not enough data" until there is history.
- Reports: job status (unchanged), assets by status (relabelled), stock value by
  category (stock × unit cost), top 10 assets by breakdown count.
- Remove the canned "AI assistant" box.

## 3. Excel import (Settings → Data Import, Managers/Admins only)

One workbook, one tab per type. Column headers below are exactly what the template uses.
IDs are your own codes (e.g. `SITE-01`, `BIN-A01`), unique within your company.

| Tab | Columns |
|---|---|
| Sites | Site ID*, Name*, Address, Postcode |
| Asset Locations | Location ID*, Name*, Site ID*, Type |
| Store Rooms | Store Room ID*, Name*, Site ID* |
| Bins | Bin ID*, Store Room ID*, Description |
| Suppliers | Supplier ID*, Name*, Categories (separate with ;), Contact Name, Email, Phone, Lead Time (days), Rating (0–5) |
| Parts | Part ID*, Name*, Category*, Unit*, Unit Cost (£), Stock Qty, Min Stock, Reorder Qty, Bin ID, Lead Time (days), Primary Supplier ID, Secondary Supplier ID, Manufacturer Part No |
| Assets | Asset ID*, Name*, Location ID, Category, Manufacturer, Model, Serial Number, Criticality (A/B/C), Status, Install Date, Parent Asset ID |
| Asset Spares | Asset ID*, Part ID*, Quantity |
| Users | Name*, Email*, Role* (Manager/Admin/Lead/Technician) |

Behaviour:
- **Download template**: the workbook with headers, a notes row, and dropdowns for
  fixed values (Type, Criticality, Status, Role, Unit).
- **Upload** → checks every row first and shows a preview: counts of new / updated
  rows per tab, and a list of errors such as "Bins row 12: Store Room ID SR-09 not
  found". Nothing is saved while there are errors.
- **Import** → everything in one database transaction (all or nothing), in this
  order: Sites → Asset Locations → Store Rooms → Bins → Suppliers → Parts → Assets →
  Asset Spares → Users. Existing IDs are updated; new IDs are created.
- Tabs can be left empty; a reference may point at an existing record or at a row
  in the same workbook.
- Users are created without a password; a Manager sets one from Team.
- Limits: 5 MB file, 5,000 rows per tab.

## 4. Example data

A filled-in example workbook for a fictional food-manufacturing site (production
areas, lines, two store rooms with bins, ~10 suppliers, ~60 spares, ~40 assets with
spares lists) for importing into a test company to prove the import end to end.
