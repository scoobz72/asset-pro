/**
 * Excel import tests: parsing, validation and planning (no database needed).
 * Run with: npm run test:import
 */
import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseWorkbook, normaliseCell, checkZipContainer, ImportFileError, type ParsedWorkbook } from "../server/import/parse";
import { buildPlan, RECORD_TABS, type Existing } from "../server/import/plan";
import { buildWorkbook, type ExampleRows } from "../server/import/template";
import { exampleRows } from "../server/import/example";
import { TAB_BY_KEY, MAX_ROWS_PER_TAB } from "../server/import/spec";

const IMPORTER = { id: 1, name: "Test Admin", role: "Admin" };

function emptyExisting(): Existing {
  const records = {} as Existing["records"];
  for (const t of RECORD_TABS) records[t] = new Map();
  return {
    records,
    spares: new Map(),
    users: [{ id: 1, name: "Test Manager", email: "manager@example.invalid", role: "Manager" }],
    emailsElsewhere: new Set(),
  };
}

async function parse(rows: ExampleRows): Promise<ParsedWorkbook> {
  return parseWorkbook(await buildWorkbook(rows));
}

const col = (tab: keyof typeof TAB_BY_KEY, key: string) => TAB_BY_KEY[tab].columns.find((c) => c.key === key)!;

test("the blank template parses with no rows and no errors", async () => {
  const parsed = await parse({});
  assert.equal(parsed.errors.length, 0);
  for (const key of Object.keys(TAB_BY_KEY)) assert.deepEqual(parsed.tabs[key as keyof typeof TAB_BY_KEY], []);
});

test("the example workbook imports cleanly into an empty company", async () => {
  const parsed = await parse(exampleRows(7));
  const plan = buildPlan(parsed, emptyExisting(), IMPORTER);
  assert.deepEqual(plan.errors, []);
  const count = (key: string) => plan.summary.find((s) => s.key === key)!.new;
  assert.equal(count("sites"), 1);
  assert.equal(count("storeRooms"), 2);
  assert.equal(count("bins"), 20);
  assert.equal(count("suppliers"), 10);
  assert.equal(count("parts"), 60);
  assert.equal(count("assets"), 42);
  assert.equal(count("users"), 4);
  assert.ok(plan.stockChanges.length > 50, "opening stock is logged");
  assert.ok(plan.users.every((u) => u.email.endsWith("+c7@example.invalid")));
});

test("re-importing the same data changes nothing", async () => {
  const parsed = await parse(exampleRows(7));
  const existing = emptyExisting();
  for (const t of RECORD_TABS) {
    for (const r of parsed.tabs[t] ?? []) existing.records[t].set(String(r.values.id), { ...r.values });
  }
  for (const r of parsed.tabs.assetSpares ?? []) {
    const a = String(r.values.assetId);
    if (!existing.spares.has(a)) existing.spares.set(a, new Map());
    existing.spares.get(a)!.set(String(r.values.partId), Number(r.values.quantity ?? 1));
  }
  for (const [i, r] of Array.from((parsed.tabs.users ?? []).entries())) {
    existing.users.push({ id: 100 + i, name: String(r.values.name), email: String(r.values.email), role: String(r.values.role) });
  }
  const plan = buildPlan(parsed, existing, IMPORTER);
  assert.deepEqual(plan.errors, []);
  for (const s of plan.summary) {
    assert.equal(s.new + s.updated + (s.removed ?? 0), 0, `${s.tab} should be unchanged`);
  }
  assert.equal(plan.stockChanges.length, 0);
});

test("cell rules: dates, money, whole numbers, lists, emails", () => {
  const date = col("assets", "installDate");
  assert.deepEqual(normaliseCell(date, "31/12/2020"), { value: "2020-12-31" });
  assert.deepEqual(normaliseCell(date, new Date(Date.UTC(2021, 0, 5))), { value: "2021-01-05" });
  assert.ok("error" in normaliseCell(date, "13/31/2020"), "US-style dates are rejected");
  assert.ok("error" in normaliseCell(date, "31/12/2999"), "future dates are rejected");

  const money = col("parts", "unitCost");
  assert.deepEqual(normaliseCell(money, "£1,234.5"), { value: "1234.50" });
  assert.ok("error" in normaliseCell(money, "-3"));

  const int = col("parts", "stock");
  assert.deepEqual(normaliseCell(int, "12"), { value: 12 });
  assert.ok("error" in normaliseCell(int, "12.5"));
  assert.ok("error" in normaliseCell(int, 2.5));

  assert.deepEqual(normaliseCell(col("assets", "status"), "down"), { value: "Down" });
  assert.ok("error" in normaliseCell(col("users", "role"), "PlatformAdmin"), "PlatformAdmin can never be imported");
  assert.deepEqual(normaliseCell(col("users", "email"), " Sam@Example.INVALID "), { value: "sam@example.invalid" });
  assert.ok("error" in normaliseCell(col("sites", "name"), "  "), "required text can't be blank");
  assert.deepEqual(normaliseCell(col("suppliers", "categories"), "Belts; Bearings ;; Belts"), { value: ["Belts", "Bearings"] });
  assert.ok("error" in normaliseCell(col("parts", "name"), { error: "#REF!" }));
});

test("references must exist in the company or the workbook", async () => {
  const parsed = await parse({
    storeRooms: [{ id: "STORE-A", name: "Stores", siteId: "SITE-OLD" }],
    bins: [
      { id: "BIN-1", storeRoomId: "STORE-A" },
      { id: "BIN-2", storeRoomId: "STORE-X" },
    ],
  });
  const existing = emptyExisting();
  existing.records.sites.set("SITE-OLD", { id: "SITE-OLD", name: "Old site" });
  const plan = buildPlan(parsed, existing, IMPORTER);
  assert.equal(plan.errorCount, 1);
  assert.match(plan.errors[0].message, /STORE-X/);
  assert.equal(plan.errors[0].tab, "Bins");
});

test("duplicate IDs, self-parents and parent loops are errors", async () => {
  const parsed = await parse({
    assets: [
      { id: "A", name: "A", parentAssetId: "B" },
      { id: "B", name: "B", parentAssetId: "A" },
      { id: "C", name: "C", parentAssetId: "C" },
      { id: "A", name: "A again" },
    ],
  });
  const plan = buildPlan(parsed, emptyExisting(), IMPORTER);
  const messages = plan.errors.map((e) => e.message).join("\n");
  assert.match(messages, /also appears on row 3/);
  assert.match(messages, /loops back to 'A'/);
  assert.match(messages, /loops back to 'B'/);
  assert.match(messages, /can't be its own parent/);
});

test("user rules: other companies' emails, own role, last manager", async () => {
  const parsed = await parse({
    users: [
      { name: "Elsewhere", email: "taken@example.invalid", role: "Technician" },
      { name: "Test Manager", email: "manager@example.invalid", role: "Technician" },
    ],
  });
  const existing = emptyExisting();
  existing.emailsElsewhere.add("taken@example.invalid");
  const plan = buildPlan(parsed, existing, IMPORTER);
  const messages = plan.errors.map((e) => e.message);
  assert.ok(messages.includes("This email can't be used"), "neutral message, no company named");
  assert.ok(messages.includes("You can't change your own role"));

  // Another manager demoting the only manager is caught too.
  const plan2 = buildPlan(parsed, existing, { id: 99, name: "Other Admin", role: "Admin" });
  assert.ok(plan2.errors.some((e) => /without a Manager or Admin/.test(e.message)));
});

test("blank cells leave existing values unchanged; stock changes are logged as differences", async () => {
  const parsed = await parse({ parts: [{ id: "P1", name: "Bearing", category: "Bearings", unit: "pcs", stock: 7 }] });
  const existing = emptyExisting();
  existing.records.parts.set("P1", { id: "P1", name: "Bearing", category: "Bearings", unit: "pcs", stock: 10, unitCost: "4.20", binId: "BIN-1" });
  const plan = buildPlan(parsed, existing, IMPORTER);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.records.parts[0].changed, { stock: 7 });
  assert.deepEqual(plan.stockChanges, [{ partId: "P1", partName: "Bearing", quantity: -3 }]);
});

test("asset spares replace the listed asset's list", async () => {
  const parsed = await parse({ assetSpares: [{ assetId: "A1", partId: "P2", quantity: 2 }] });
  const existing = emptyExisting();
  existing.records.assets.set("A1", { id: "A1", name: "Press" });
  existing.records.parts.set("P1", { id: "P1" });
  existing.records.parts.set("P2", { id: "P2" });
  existing.spares.set("A1", new Map([["P1", 1]]));
  const plan = buildPlan(parsed, existing, IMPORTER);
  const s = plan.summary.find((x) => x.key === "assetSpares")!;
  assert.equal(s.new, 1);
  assert.equal(s.removed, 1);
  assert.deepEqual(plan.spares, [{ assetId: "A1", parts: [{ partId: "P2", quantity: 2 }], changed: true }]);
});

test("files that aren't xlsx are rejected before parsing", () => {
  assert.throws(() => checkZipContainer(Buffer.from("Site ID,Name\nS1,Site\n")), ImportFileError);
  assert.throws(() => checkZipContainer(Buffer.alloc(6 * 1024 * 1024, 0x50)), /larger than 5 MB/);
});

test("too many rows are rejected before the workbook is fully loaded", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sites");
  ws.addRow(["Site ID", "Name"]);
  for (let i = 0; i < MAX_ROWS_PER_TAB + 5; i++) ws.addRow([`S${i}`, `Site ${i}`]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  await assert.rejects(parseWorkbook(buf), /more than 5,000 rows/);
});

test("columns can be in any order, data can start on row 2, unknown columns are a warning", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("sites");
  ws.addRow(["Name", "Comments", "site id"]);
  ws.addRow(["Main site", "hello", "S1"]);
  const parsed = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.tabs.sites, [{ row: 2, values: { id: "S1", name: "Main site" } }]);
  assert.match(parsed.warnings[0].message, /Comments/);
});

test("a tab missing a required header is reported", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Parts").addRow(["Part ID", "Name"]);
  const parsed = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer));
  assert.match(parsed.errors[0].message, /Missing columns: Category, Unit/);
});

test("a name in an ID column is matched when exactly one record has that name", async () => {
  const parsed = await parse({
    locations: [
      { id: "L1", name: "Line 1", siteId: "hfc production" },
      { id: "L2", name: "Line 2", siteId: "Twin" },
    ],
    assets: [{ id: "A1", name: "Press", locationId: "Line 1" }],
  });
  const existing = emptyExisting();
  existing.records.sites.set("SITE-01", { id: "SITE-01", name: "HFC Production" });
  existing.records.sites.set("S-A", { id: "S-A", name: "Twin" });
  existing.records.sites.set("S-B", { id: "S-B", name: "Twin" });
  const plan = buildPlan(parsed, existing, IMPORTER);
  assert.equal(plan.records.locations[0].values.siteId, "SITE-01");
  assert.equal(plan.records.assets[0].values.locationId, "L1", "names of rows in the same workbook match too");
  assert.equal(plan.errorCount, 1, "an ambiguous name is still an error");
  assert.match(plan.errors[0].message, /matches 2 sites \(S-A, S-B\)/);
  assert.ok(plan.warnings.some((w) => /'hfc production' matched by name to Site ID 'SITE-01'/.test(w.message)));
});

test("identical repeated rows are imported once; differing repeats are errors", async () => {
  const parsed = await parse({
    storeRooms: [{ id: "MOD1", name: "Module 1 stores", siteId: "S1" }],
    sites: [{ id: "S1", name: "Site" }],
    bins: [
      { id: "T04", storeRoomId: "MOD1" },
      { id: "T04", storeRoomId: "MOD1" },
      { id: "T05", storeRoomId: "MOD1", description: "a" },
      { id: "T05", storeRoomId: "MOD1", description: "b" },
    ],
  });
  const plan = buildPlan(parsed, emptyExisting(), IMPORTER);
  assert.equal(plan.errorCount, 1);
  assert.match(plan.errors[0].message, /T05' also appears on row 5 with different details/);
  assert.ok(plan.warnings.some((w) => w.tab === "Bins" && /1 repeated row ignored/.test(w.message)));
  assert.equal(plan.summary.find((x) => x.key === "bins")!.new, 2);
});

test("IDs in different letter case match; values from the wrong tab get a hint", async () => {
  const parsed = await parse({
    sites: [{ id: "S1", name: "HFC Production" }],
    locations: [{ id: "LINE 9", name: "Line 9", siteId: "s1" }],
    assets: [{ id: "A1", name: "Slicer", locationId: "HFC Production", parentAssetId: "LINE 9" }],
  });
  const plan = buildPlan(parsed, emptyExisting(), IMPORTER);
  assert.equal(plan.records.locations[0].values.siteId, "S1");
  assert.ok(plan.warnings.some((w) => /'s1' matched by ID to Site ID 'S1'/.test(w.message)));
  const messages = plan.errors.map((e) => e.message);
  assert.ok(messages.some((m) => /'HFC Production' not found\. It looks like a site \(Sites tab\)/.test(m)));
  assert.ok(messages.some((m) => /'LINE 9' not found\. It looks like a location \(Asset Locations tab\)/.test(m)));
});

test("only an Admin can import users", async () => {
  const parsed = await parse({ users: [{ name: "New Person", email: "new@example.invalid", role: "Technician" }] });
  const asManager = buildPlan(parsed, emptyExisting(), { id: 1, name: "Manager", role: "Manager" });
  assert.match(asManager.errors[0].message, /Only an Admin can import users/);
  const asAdmin = buildPlan(parsed, emptyExisting(), IMPORTER);
  assert.equal(asAdmin.errorCount, 0);
});
