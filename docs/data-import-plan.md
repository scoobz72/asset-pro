# Plan: real data model, dashboards and Excel import

Status: **agreed (26 Nov 2026), all section 7 defaults accepted. All four parts are
built; first end-to-end run on the VPS still to do.** See "Progress" at the end.
Branch: `move-off-replit`. Live at https://mycmms.co.uk (IONOS VPS, see `deploy/README.md`).

The work has four parts, all shipped together:

1. Data model additions
2. Real dashboards and reports
3. Excel import
4. Example data

This plan is written against the code as it stands on this branch: `shared/schema.ts`,
`server/routes.ts`, `server/storage.ts`, `client/src/pages/dashboard.tsx` and `settings.tsx`.

**Blocker:** reading and writing .xlsx files needs `exceljs`. It has to be installed with
`npm install exceljs` in a session (or on the VPS) that allows package installs. Nothing
else new is needed. The upload uses `express.raw` on its own route, so no multer.

---

## 0. What the current code means for this plan

| Finding (current code) | Consequence |
|---|---|
| `inventory.primarySupplierId` / `secondarySupplierId` have **no foreign key** | Add composite FKs to `suppliers`. Without them an import could point parts at suppliers that don't exist. |
| `asset_parts` has **no unique key** on (company, asset, part) | Add one, so re-importing the same spares list can't create duplicates. |
| `users.email` is unique **across all companies** (`users_email_lower_key`) | An import can fail on an email used by another company. The error must not reveal that the email belongs to another company (see 3.6). |
| Users have a numeric identity `id`, no text code | The Users tab matches on **email** within the company, not on an ID column. |
| `suppliers.lead_time` is `text`; `suppliers.contact` is one free-text field | Replace them with typed columns (1.2). |
| `inventory.location` is free text, shown on the inventory and stock-take pages | Replace it with `bin_id` and show the bin and store room in the UI instead. |
| `jobs` has no timestamps; `due_date` is text | Add `created_at` / `completed_at` as `timestamptz`. Leave `due_date` as it is (out of scope). |
| `express.json()` uses the default 100 kB limit | The import route gets its own `express.raw({ limit: "5mb" })`. The global limit stays as it is. |
| Stock-level changes elsewhere are logged in `stock_transactions` (`TXN-<ms>`) | Import-driven stock changes must be logged there too (3.5). |
| The dashboard has hard-coded trends, MTBF and a canned "Ask SmartAIss" box | Replace them with a server-computed summary (section 2). |
| Settings → "Data Import (Admin Only)" is a mock (`handleImport` just shows a toast) | Replace it with the real flow (section 3). |
| No demo data, no live users (demo data removed Nov 2026) | Destructive column changes are safe, but check the VPS database before `drizzle-kit push` (5.1). |

---

## 1. Data model additions

`*` = required. Every table keeps `company_id` and the composite keys and FKs described in
`replit.md`. Every new reference is a **composite** FK `(company_id, x_id)`.

### 1.1 Changes by table

| Table | Change | Drizzle detail |
|---|---|---|
| `sites` | + `address`, `postcode` | `text`, nullable |
| `locations` | + `type` | `text not null default 'Other'`; values in `LOCATION_TYPES` = Building / Production area / Line / Room / Other |
| **`store_rooms`** (new) | `id`*, `name`*, `site_id`* | PK `(company_id, id)`; FK → `sites` |
| **`bins`** (new) | `id`*, `store_room_id`*, `description` | PK `(company_id, id)`; FK → `store_rooms` |
| `suppliers` | + `contact_name`, `email`, `phone`; `lead_time_days integer`; drop `contact` and the text `lead_time` | Change the type by adding the new column and dropping the old one, not by `ALTER TYPE` (text → int has no safe cast) |
| `inventory` | + `unit_cost numeric(10,2)`, `reorder_qty integer`, `bin_id`, `manufacturer_part_no`; drop `location` | FK `bin_id` → `bins`; new FKs on `primary_supplier_id` and `secondary_supplier_id` → `suppliers` |
| `assets` | + `category`, `manufacturer`, `model`, `serial_number`, `criticality`, `install_date date`, `parent_asset_id` | `criticality` in `CRITICALITIES` = A/B/C, nullable; self-FK `(company_id, parent_asset_id)` → `assets` |
| `asset_parts` | + `quantity integer not null default 1`; unique `(company_id, asset_id, part_id)` | The unique key is what makes upsert possible |
| `jobs` | + `created_at timestamptz not null default now()`, `completed_at timestamptz` | Both server-set and never accepted from the client: omit them from `insertJobSchema` / `updateJobSchema` |

### 1.2 Shared constants (add to `shared/schema.ts`)

The UI dropdowns, the Zod schemas, and the template's dropdown lists all read from these:

```ts
export const LOCATION_TYPES = ["Building", "Production area", "Line", "Room", "Other"] as const;
export const ASSET_STATUSES = ["Operational", "Maintenance", "Down", "In Storage", "Loaned Out"] as const;
export const CRITICALITIES  = ["A", "B", "C"] as const;
export const PART_UNITS     = ["pcs", "m", "mm", "L", "ml", "kg", "g", "box", "pack", "set", "pair", "roll"] as const;
```

`ASSET_STATUSES` matches the values already used in `assets.tsx`.

### 1.3 Server behaviour changes

- **`storage.updateJob`**:
  - When the status changes *to* `Completed`, set `completed_at = now()`.
  - When the status changes *away from* `Completed`, set `completed_at = null`.
  - Do this in one `UPDATE … RETURNING`. It is server-side only.
- **`storage.deleteSite`**: this now also fails if the site has store rooms. `server/errors.ts`
  already turns that FK violation (23503) into a generic 400 ("…still in use"), which is
  enough for now.
- **Stock-take**: it currently groups parts by the free-text `location`. Change it to group
  by store room, then bin.
- **CRUD routes** for `store_rooms` and `bins`:
  - `GET`/`POST`/`PATCH` for any signed-in user, and `DELETE` for privileged users only.
  - This is the same pattern as `locations`.
- **UI**:
  - Inventory and stock-take pages: replace the free-text "Location" with a Bin picker grouped
    by store room.
  - Suppliers page: three contact fields and lead time in days.
  - Assets page: the new fields go in the edit dialog, with an optional "Parent asset" picker.
  - Locations page: a Store rooms & bins section under each site.

---

## 2. Real dashboards and reports

Add one endpoint, **`GET /api/dashboard/summary`**. It is computed in SQL for `companyOf(req)`,
so the browser no longer downloads every job to count them. Dates are in Europe/London, and
the "day" boundaries use `created_at AT TIME ZONE 'Europe/London'`.

| Tile / chart | Definition | Trend |
|---|---|---|
| Open jobs | status ≠ Completed | Opened this 7 days vs previous 7 |
| Completed (7 days) | `completed_at` within the last 7 days | vs previous 7 |
| Assets down | status = Down or Maintenance | No trend (no status history is stored) |
| Low stock | `stock ≤ min_stock` | No trend (no stock-level history) |
| 7-day chart | Per day: jobs opened (`created_at`) vs completed (`completed_at`) | — |
| MTBF | Per asset with **≥ 2** Breakdown jobs: (last − first `created_at`) / (n − 1). The tile shows the **median** across those assets, in days. | Show "Not enough data" if no asset qualifies |
| MTTR | Mean (`completed_at − created_at`) of Breakdown jobs completed in the last 90 days, in hours | Show "Not enough data" if there are none |

Tiles show an arrow only where a real comparison exists. No made-up trends.

Reports page (`reports.tsx`):

- Job status: unchanged.
- "Assets by status": relabel the existing chart.
- **Stock value by category**: Σ `stock × unit_cost`. Parts with no cost are counted and listed as "n parts with no cost".
- **Top 10 assets by breakdown count**: last 12 months.

Remove the "Ask SmartAIss" box and the `handleAskAI` handler from the dashboard.

Jobs created before this change get `created_at = now()` when the migration runs. Since
there is no live data, nothing is lost.

---

## 3. Excel import (Settings → Data Import, Managers/Admins only)

### 3.1 Workbook layout

There is one workbook with one tab per type. Row 1 holds the headers, exactly as below. Row 2
is a grey notes row ("Required. Your own code, e.g. SITE-01"), which the import skips. Data
starts on row 3.

IDs are the company's own codes, unique within the company. They are trimmed, and matched
**case-sensitively**. A Site ID and Location ID may share the same text, because each type
has its own ID space.

| Tab | Columns (`*` = required) | Matches existing record on |
|---|---|---|
| Sites | Site ID*, Name*, Address, Postcode | Site ID |
| Asset Locations | Location ID*, Name*, Site ID*, Type | Location ID |
| Store Rooms | Store Room ID*, Name*, Site ID* | Store Room ID |
| Bins | Bin ID*, Store Room ID*, Description | Bin ID |
| Suppliers | Supplier ID*, Name*, Categories (separate with ;), Contact Name, Email, Phone, Lead Time (days), Rating (0–5) | Supplier ID |
| Parts | Part ID*, Name*, Category*, Unit*, Unit Cost (£), Stock Qty, Min Stock, Reorder Qty, Bin ID, Lead Time (days), Primary Supplier ID, Secondary Supplier ID, Manufacturer Part No | Part ID |
| Assets | Asset ID*, Name*, Location ID, Category, Manufacturer, Model, Serial Number, Criticality (A/B/C), Status, Install Date, Parent Asset ID | Asset ID |
| Asset Spares | Asset ID*, Part ID*, Quantity | (Asset ID, Part ID) |
| Users | Name*, Email*, Role* (Manager/Admin/Lead/Technician) | Email, case-insensitive |

Columns are found by their header text, so their order doesn't matter. Unknown columns are
ignored, and a warning is shown. A missing required **header** fails the whole tab. A tab
that is missing or empty is skipped.

### 3.2 Cell rules

| Kind | Accepted | Error example |
|---|---|---|
| Text | Trimmed; an empty cell or only spaces counts as blank. Max 200 characters (IDs 50, notes 2,000). | "Parts row 14: Name is required" |
| Whole number (Stock Qty, Min Stock, Reorder Qty, Lead Time, Quantity) | Integer ≥ 0. Numeric text like "12" is accepted. "12.5" is rejected. | "Parts row 9: Stock Qty must be a whole number ≥ 0" |
| Money (Unit Cost) | ≥ 0, rounded to 2 dp. "£" and "," are stripped. | |
| Rating | 0–5, 1 dp | |
| Date (Install Date) | A real Excel date, or text written DD/MM/YYYY (UK). Never MM/DD. Not in the future. | "Assets row 3: Install Date '13/31/2020' is not a valid date (use DD/MM/YYYY)" |
| Fixed list (Type, Criticality, Status, Role, Unit) | Must match a value in 1.2 / `USER_ROLES`, case-insensitive, and is stored in canonical case | "Users row 5: Role 'Owner' must be one of Manager, Admin, Lead, Technician" |
| Email | Same Zod rule as `insertUserSchema`; lower-cased | |
| Formulas | The cached **result** value is used, never the formula. A formula cell with no cached value is an error. | |

### 3.3 Reference rules

A reference is valid if it points at **an existing record in this company** or **a row
elsewhere in the same workbook**.

| Reference | Must exist in |
|---|---|
| Location → Site ID, Store Room → Site ID | Sites |
| Bin → Store Room ID | Store Rooms |
| Part → Bin ID | Bins |
| Part → Primary / Secondary Supplier ID | Suppliers (Primary ≠ Secondary) |
| Asset → Location ID | Asset Locations |
| Asset → Parent Asset ID | Assets. It can't be the asset itself, and the parent chain can't loop. Cycles are checked over existing + imported assets together. |
| Asset Spares → Asset ID, Part ID | Assets, Parts |

Also checked:

- A **duplicate ID** within a tab is an error, and both rows are reported.
- The same Email twice in the Users tab is an error.
- The same (Asset, Part) pair twice in Asset Spares is an error.

### 3.4 Flow and endpoints

All the endpoints sit behind `requirePrivileged`, and all are scoped to `companyOf(req)`.
PlatformAdmins import into their own company only. There is no "import into company X".

| Endpoint | Does |
|---|---|
| `GET /api/import/template` | Streams `myCMMS-import-template.xlsx`: headers, notes row, Excel data-validation dropdowns for the fixed lists, and frozen header rows. It is generated from the definitions in `server/import/spec.ts`, so the template and the validator can't drift apart. |
| `POST /api/import/preview` | Body: the raw .xlsx file (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Parses and validates everything and **writes nothing**. Returns `{ tabs: [{ name, new, updated, unchanged, skipped }], errors: [{ tab, row, column, message }], warnings: [...] }`. The first 200 errors are returned in full, plus the total count. |
| `POST /api/import/commit` | Same body. The server **re-parses and re-validates** the file: it keeps no server-side copy between preview and commit. If anything fails, it returns 422 with the same error list. Otherwise it imports and returns the counts. |

Client (`settings.tsx`):

1. Download template.
2. Choose file.
3. A preview table shows counts per tab and the error list (downloadable as CSV).
4. The Import button is enabled only when there are 0 errors.
5. A success toast shows the counts and refreshes all React Query caches.

The client keeps the `File` object so it can be sent again for the commit.

### 3.5 Commit semantics

- **One `db.transaction`** wraps everything, so the import is all or nothing. At the start it
  takes `pg_advisory_xact_lock(company_id)`, so two imports for the same company can't run at
  the same time.
- The order is Sites → Asset Locations → Store Rooms → Bins → Suppliers → Parts → Assets →
  Asset Spares → Users.
- Each row is an upsert using `INSERT … ON CONFLICT (company_id, id) DO UPDATE`, sent in
  batches of 500.
- **Assets** go in two passes: first upsert with `parent_asset_id` left as is (for new assets,
  null), then set parents. Parents may therefore come later in the sheet.
- **Blank cells on an existing record leave that field unchanged** (decision 7.1). Required
  columns can never be blank.
- **Asset Spares**: for every Asset ID that appears in the tab, its spares list is
  **replaced** by the rows given, the same as `setAssetParts` today (decision 7.2). Assets not
  in the tab keep their spares.
- **Stock Qty**: every new part with stock > 0, and every existing part whose stock changes,
  also writes a `stock_transactions` row in the same transaction:
  - `type`: `"Import Adjustment"`
  - `quantity`: the difference
  - `reference`: `"Excel import"`
  - `userId`: the importer
  - `id`: `TXN-IMP-<ms>-<n>`

  This keeps the transactions log as the full history of stock movements.
- **Users**:
  - They are created with no password. A Manager sets one from Team, as today.
  - The role can be Manager, Admin, Lead or Technician only; `PlatformAdmin` is rejected
    because it isn't in `USER_ROLES`.
  - For an existing user (matched by email), only `name` and `role` are updated. `status`,
    `avatar` and `password` are never touched.
  - An import can't change the importer's **own** role.
  - An import can't leave the company without at least one Manager/Admin.
- Unchanged rows are counted as "unchanged" and not rewritten.

### 3.6 Security and limits

- **File**:
  - The file must be ≤ **5 MB**, enforced by `express.raw({ limit: "5mb" })` on these two
    routes only. Anything over gets a 413.
  - It must be a real xlsx (zip magic bytes `PK\x03\x04`). `.xls` and `.csv` are rejected
    with a clear message.
- **Row limits**:
  - The limit is ≤ **5,000 data rows per tab**, and ≤ 20,000 rows in total.
  - The rows are counted with exceljs's **streaming reader** before the full workbook is
    loaded, so a zip bomb or a huge sheet is rejected without filling memory.
  - Cells over 2,000 characters are rejected.
- **Validation**: every row goes through a Zod schema built from the same columns as the
  `insert*Schema`s. Only declared fields ever reach the database (the same allow-list
  principle as `parseBody`).
- **Emails used by another company**: the conflict is detected by catching the
  `users_email_lower_key` violation in preview (with a pre-check query) and in commit. The
  message is "Users row n: this email can't be used". It doesn't say that the email belongs
  to another company.
- **Logging**: errors are logged with tab, row and column only, never cell values, in line
  with the existing rule that request bodies aren't logged. On success, one `log()` line
  records who imported, the company id, and the counts.
- **Formula injection**: the template contains no user data. If an "export current data"
  feature is added later, prefix cell values starting with `= + - @` with `'`.

### 3.7 Code layout

```
server/import/spec.ts       column definitions per tab (header, key, kind, required, list, ref)
server/import/parse.ts      exceljs -> { tab, rowNumber, values } with cell normalisation (3.2)
server/import/validate.ts   per-row Zod + cross-tab reference/duplicate/cycle checks (3.3)
server/import/commit.ts     transaction + ordered upserts + stock transactions (3.5)
server/import/template.ts   builds the template workbook from spec.ts
server/routes.ts            the three /api/import/* routes
client/src/pages/settings.tsx  real upload / preview / import UI
```

---

## 4. Example data

Add `docs/examples/myCMMS-example-food-site.xlsx`, generated by `script/make-example.ts` from
the same `spec.ts` so it always matches the template. It describes a fictional
food-manufacturing plant, "Fenland Fine Foods – Chatteris":

- 1 site
- ~8 asset locations: production halls, packing, chillers and lines L1–L4
- 2 store rooms with ~20 bins
- ~10 suppliers (bearings, belts, pneumatics, electrical, hygiene)
- ~60 spares, with costs, min stock and bins
- ~40 assets (slicers, thermoformers, metal detectors, conveyors, compressors), with
  parent/child links (line → machine) and spares lists
- 4 users with `example.invalid` emails

To prove the import end to end, import this into a **test company** created from the
Companies page, not into MyCMMS HQ.

---

## 5. Delivery

### 5.1 Order of work (separate commits on `move-off-replit`)

1. **Schema**: 1.1 + 1.2, with `insert*`/`update*` schemas updated and the job timestamps
   omitted from them.
   - Before running `deploy.sh` on the VPS, check that no real data will be dropped:
     `psql … -c "select count(*) from suppliers; select count(*) from inventory;"`.
   - When `drizzle-kit push` asks about dropping `suppliers.contact`, `suppliers.lead_time` and
     `inventory.location`, answer yes.
2. **Server**: `completed_at` logic, store rooms and bins CRUD, error mapping.
3. **UI**: inventory, stock-take, suppliers, assets and locations pages for the new fields.
4. **Dashboard summary endpoint**, plus the dashboard and reports changes. Remove the AI box.
5. **`npm install exceljs`** (needs package installs), then `server/import/*` and the routes.
6. **Settings import UI**.
7. **Example workbook** and its script.
8. **Tests**, then `npm run check`, `npm run test:security` and `npm run test:dependencies`.

### 5.2 Tests to add (`script/import.test.ts`, run with `tsx --test`)

- **Parsing**: header lookup in any order; the notes row is skipped; UK dates, numeric text,
  `£1,234.50` and cached formula results are read correctly; `.csv` and `.xls` are rejected.
- **Validation**:
  - missing required field;
  - bad list value;
  - duplicate ID within a tab;
  - a reference to a row in the same workbook is accepted, and an unknown reference is
    rejected;
  - a parent-asset cycle is rejected (A→B→A, and A→A);
  - Primary supplier = Secondary supplier is rejected.
- **Limits**: 5,001 rows in a tab → rejected before full load; a 6 MB body → 413.
- **Commit**, against a test database:
  - all-or-nothing: an error injected in the Users step leaves Sites untouched;
  - re-importing the same file → everything is "unchanged";
  - stock changes write `Import Adjustment` transactions.
- **Security** (add to `security.test.ts`):
  - a Technician or Lead calling the `/api/import/*` routes gets 403;
  - `PlatformAdmin` in the Role column is rejected;
  - a workbook can't reference another company's records: the same ID existing in company B
    is treated as "not found" for company A;
  - an email belonging to another company gives the neutral message;
  - the importer can't change their own role.

### 5.3 Done when

- The template downloads and opens cleanly in Excel, with working dropdowns.
- The example workbook previews with 0 errors and imports into a test company. The counts in
  the success toast match the workbook.
- The dashboard shows real figures for that company, with "Not enough data" for MTBF and MTTR
  until jobs exist.
- All checks in 5.1 step 8 pass, and `deploy.sh` runs cleanly on the VPS.

---

## 6. Out of scope (for now)

- Importing jobs, templates, purchase orders, audits or job history.
- Exporting current data to Excel.
- CSV upload.
- Deleting records through import. Removed rows are ignored, never deleted.
- Per-company custom fields.

---

## 7. Decisions (agreed 26 Nov 2026: all defaults accepted)

1. **Blank cell on an existing record**: *leave the field unchanged* (recommended, safe for
   partial sheets), or clear the field.
2. **Asset Spares for an asset in the sheet**: *replace that asset's list* (recommended,
   matches the app today), or only add.
3. **Stock Qty on existing parts**: *overwrite and log an Import Adjustment* (recommended), or
   ignore Stock Qty for existing parts so stock only changes through stock-take.
4. **ID matching**: *case-sensitive* (recommended, matches how IDs work today), or
   case-insensitive (`bin-a01` = `BIN-A01`).
5. **Unit**: *fixed list in 1.2* (recommended), or free text with the list only as suggestions.

---

## Progress

| Step (5.1) | State |
|---|---|
| 1. Schema | Done: `shared/schema.ts`, fixed lists in `shared/constants.ts` (no imports, so the browser can use them) |
| 2. Server | Done: store rooms and bins CRUD, `completed_at` handling, `GET /api/asset-parts` (replaces one request per asset on the inventory page), `deploy/pre-push.sql` |
| 3. UI | Done: assets (make, model, criticality, parent…), inventory (bin picker, cost, reorder qty, MPN), stock-take by store room, suppliers (contact name, email, phone, days), locations page rebuilt with store rooms and bins |
| 4. Dashboard and reports | Done: `GET /api/dashboard/summary`; AI box, date filter and fake trends removed |
| 5. Import | Done: `server/import/` (`spec`, `parse`, `plan` (pure, unit-tested), `commit`, `template`) and `/api/import/{template,example,preview,commit}` |
| 6. Settings UI | Done: `client/src/components/DataImport.tsx`, shown to Managers/Admins only |
| 7. Example workbook | Done, generated on demand: Settings → Data Import → "Example (food site)". It is built from `server/import/example.ts` rather than kept as an .xlsx in git, so it always matches the template. Example users get a `+c<company id>` email tag, so it can be imported into several test companies |
| 8. Tests | `script/security.test.ts` (schemas) and `script/import.test.ts` (`npm run test:import`: cell rules, references, loops, user rules, limits, example round trip). Neither has been run yet: the build session had no `node_modules`. Run `npm run check`, `npm run test:security` and `npm run test:import` on the VPS first |

Differences from the plan text:
- The example workbook is generated by the server (see step 7), not stored at `docs/examples/`.
- Required columns are marked by a navy header in the template, not "*", so headers match exactly.
- A zip-size check rejects files whose contents would expand past 150 MB, before any XML is read.
