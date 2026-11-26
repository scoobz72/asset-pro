# Plan: job records, asset history and stock reports

Status: **agreed 26 Nov 2026.** Phase 1 in progress (see "Progress" at the end).
Branch: `move-off-replit`. Follows `docs/data-import-plan.md`.

## Decisions (agreed 26 Nov 2026)

| Topic | Decision |
|---|---|
| Labour | Hours per engineer per job, plus an hourly rate per engineer (set by a Manager/Admin). The rate is copied onto each time entry, so later rate changes don't rewrite history. |
| Depreciation | One company-wide method and rate (Settings), applied to every asset. Financial year April–March. |
| Documents | Stored on the VPS, max **10 MB** per file; PDF, images, Office files. Server backups must include the upload folder. |
| Missed PPM | Missed when not completed within **7 days** of its due date (the company setting `ppm_grace_days`, default 7). |
| Costing | FIFO: every receipt is a cost layer ("lot"); issues consume the oldest lots first. |

## Why the stock ledger comes first

Today the browser changes stock: it works out the new figure, `PATCH`es `inventory.stock`,
then posts a separate `stock_transactions` row (`inventory.tsx`, `stock-take.tsx`). That is
not atomic (two users can overwrite each other), records no cost, and can't be linked to a
job or asset. Every report asked for (FIFO value, transaction value by period, usage per
asset, ageing, restocking, parts replaced per asset, job parts) needs a trustworthy ledger.

---

## Phase 1: stock ledger, job records, PPM schedules

### 1.1 Stock ledger (server-side movements)

- **New table `stock_lots`** (a FIFO cost layer): `id serial`, `company_id`, `part_id`,
  `received_at timestamptz`, `quantity_received int`, `quantity_remaining int`,
  `unit_cost numeric(12,4)`, `transaction_id text`, FK `(company_id, part_id)` → `inventory`.
- **`stock_transactions` gains:** `created_at timestamptz` (real time; `date` text kept for
  old rows), `unit_cost numeric(12,4)` and `value numeric(12,2)` (signed: + in, − out),
  `balance_after int`, `job_id`, `asset_id`, `po_id`. Composite FKs to `jobs` and `assets`.
- **Movement types** (`STOCK_MOVEMENT_TYPES` in `shared/constants.ts`):
  - In: `Stock In`, `Purchase Order`, `Return to Stores`, `Transfer In`
  - Out: `Job Issue`, `Stock Out - Damaged`, `Stock Out - Missing`, `Transfer Out`
  - Either direction: `Stock Take Adjustment`, `Import Adjustment`
- **One server function `recordMovement(tx, …)`** does every stock change inside a DB
  transaction:
  - it locks the part row (`SELECT … FOR UPDATE`);
  - it refuses to take stock below 0;
  - for an **in** movement, it creates a lot at the given unit cost, or the part's `unit_cost`;
  - for an **out** movement, it consumes the oldest lots first and records the FIFO cost;
  - it updates `inventory.stock`, `last_used`, `last_replenished` and `last_stock_taken`,
    then writes the transaction.
- **Endpoints:**
  - `POST /api/stock/movements` handles a single movement.
  - `POST /api/stock/stock-take` submits a whole count; each difference becomes a
    `Stock Take Adjustment`, and every counted part gets a `stock_takes` row.
  - The old `POST /api/transactions` is removed.
  - `PATCH /api/inventory/:id` no longer accepts `stock`; changing stock always goes
    through a movement.
- **New table `stock_takes`:** `id serial`, `company_id`, `part_id`, `counted_at`,
  `expected int`, `counted int`, `user_id`. This gives each part's stock-take count.
- **Migration:** every part with stock > 0 gets one opening lot at its `unit_cost` (0 if
  blank). Old transactions stay as they are, with no cost.
- **Excel import:**
  - a new part's opening stock is recorded as a `Stock In` movement, which creates its
    first lot;
  - a stock change on an existing part is recorded as an `Import Adjustment` movement.

  Both use the same ledger function.

### 1.2 Job records

- **`users.hourly_rate numeric(8,2)`:** set on the Team page by a Manager or Admin.
- **New table `job_labour`:** `id serial`, `company_id`, `job_id`, `user_id`,
  `work_date date`, `hours numeric(5,2)`, `rate numeric(8,2)` (copied from the user at
  entry), `note`.
- **New table `job_notes`:** `id serial`, `company_id`, `job_id`, `user_id`, `created_at`,
  `kind` (`Note` | `Follow-up`), `text`, `follow_up_job_id` (set when a follow-up is turned
  into a job).
- **Parts used:** a `Job Issue` movement with `job_id` and `asset_id`. A `Return to Stores`
  movement against the job reverses it at the cost it was issued at.
- **`purchase_orders.job_id`:** a PO can be raised against a job, and the job lists its POs.
- **Job page** (`/jobs/:id`):
  - header and status;
  - labour: engineer, date, hours, cost;
  - parts used: part, quantity, FIFO cost, with "return";
  - notes and follow-ups: a follow-up can become a new job;
  - linked POs;
  - KPI strip for the asset (see 2.3).
- **Permissions:** anyone signed in can log their own labour, notes and parts. Logging
  labour for someone else, editing rates, and deleting entries are Manager/Admin only.

### 1.3 PPM schedules

- **New table `ppm_schedules`:** `id text`, `company_id`, `asset_id`, `template_id`,
  `title`, `interval_value int`, `interval_unit` (`weeks` | `months`), `next_due date`,
  `assignee_id`, `active bool`.
- **`jobs.ppm_schedule_id` and `jobs.due_on date`:** a PPM job knows its schedule and the
  date it was due.
- **Generating jobs:** the server checks hourly and creates the job for any active schedule
  due within 14 days that has no open job yet.
- **Rolling forward:** when a PPM job is completed, the schedule's `next_due` moves forward
  by one interval from the due date, not from the completion date, so the cadence holds.
- **`companies.ppm_grace_days int default 7`.** A PPM counts as **missed** when it was
  completed after `due_on + grace`, or is still open after that date.

---

## Phase 2: asset history, financials, documents

### 2.1 Location history

- **New table `asset_movements`:** `id serial`, `company_id`, `asset_id`, `from_location_id`,
  `to_location_id`, `moved_at`, `user_id`, `reason`.
- It is written automatically by the server whenever `assets.location_id` changes: from
  the Assets page, a drag on the site plan, an import, or an audit that finds the asset
  somewhere else.

### 2.2 Financials and depreciation

- **`assets` gains:** `purchase_date date`, `purchase_value numeric(12,2)`.
- **`companies` gains:**
  - `depreciation_method` (`straight_line` | `reducing_balance`);
  - `depreciation_rate numeric(5,2)` (% per year);
  - `financial_year_start_month int default 4`.

  These are set in Settings by a Manager or Admin.
- **Depreciation table:** a year-by-year table per asset (opening value, depreciation,
  closing value) by financial year. The first year is pro-rated by months owned. Book
  value never goes below 0.

### 2.3 History tab and KPIs (`/assets/:id`)

The history tab shows the following for each asset:
- Location history.
- Parts replaced: count and FIFO value, from `Job Issue` minus returns.
- Breakdown count.
- Repair hours excluding PPM: labour on non-Planned jobs.
- Labour cost.
- Missed PPMs, and PPM compliance %.
- MTBF and MTTR by month for the last 12 months, plus the trend. The same figures appear
  on the job page.

### 2.4 Documents and attributes

- **New table `asset_documents`:** `id serial`, `company_id`, `asset_id`, `filename`,
  `stored_name` (random), `mime`, `size`, `uploaded_by`, `uploaded_at`.
- **File storage:**
  - files are saved in `UPLOAD_DIR` (default `~/assetpro-uploads/<company_id>/`), outside
    the web root;
  - files can only be downloaded through an authorised route, and the company is checked
    on every download;
  - the server checks each file's content, not its extension, and allows only PDF, PNG,
    JPEG, WebP, DOCX and XLSX;
  - 10 MB per file.
- **New table `asset_attributes`:** `id serial`, `company_id`, `asset_id`, `name`, `value`,
  unique per asset and name.

---

## Phase 3: stock reports

All reports are computed in SQL for one company and shown on a new **Stock Reports** page,
with Excel export.

| Report | Definition |
|---|---|
| FIFO valuation | Σ `quantity_remaining × unit_cost` over open lots, per part, category and store room |
| Transaction value | Σ `value` grouped by day, week, month or year (Europe/London), split in/out by type |
| Usage by asset | `Job Issue` minus returns, per part × asset, over a period |
| Stock-take history | Count of `stock_takes` per part, with the last count date and variance |
| Aged stock | Days since the part's last out movement (or since first receipt if never used): 0–90, 91–180, 181–365, 365+, with FIFO value per group |
| Restock recommendations | Daily usage = issues in the last 90 days ÷ 90. Reorder point = daily usage × (lead time + 7 safety days). Recommend an order when stock ≤ reorder point (or ≤ min stock); suggested qty = max(reorder qty, 30 days of usage + reorder point − stock). Shows usage trend and supplier. |

Purchase order lines and receiving (each received line creates a lot at the PO price) are
part of this phase.

---

## Progress

| Step | State |
|---|---|
| 1.1 Stock ledger | Built: `server/stock/{fifo,ledger}.ts`, `POST /api/stock/movements`, `POST /api/stock/stock-take`, migration `002-stock-ledger.sql`; Inventory, Stock Take, Transactions pages and the Excel import use it. Tests: `npm run test:ledger` (the database part runs only with `DATABASE_URL`, always rolled back) |
| 1.2 Job records | Next |
| 1.3 PPM schedules | Not started |
| Phase 2 | Not started |
| Phase 3 | Not started |

Also done alongside: Assets page Tiles / List switch (26 Nov 2026).
