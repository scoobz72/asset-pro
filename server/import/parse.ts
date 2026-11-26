/**
 * Reads an uploaded .xlsx into plain, normalised rows per tab (plan section 3.2).
 * Nothing here touches the database.
 */
import ExcelJS from "exceljs";
import zlib from "node:zlib";
import { describeErrorForLog } from "../errors";
import { z } from "zod";
import {
  TABS, type TabKey, type TabSpec, type ColumnSpec,
  MAX_FILE_BYTES, MAX_ROWS_PER_TAB, MAX_ROWS_TOTAL, MAX_CELL_CHARS,
  HEADER_ROW, NOTES_ROW, normaliseHeader,
} from "./spec";

export interface ImportIssue {
  tab?: string;
  row?: number;
  column?: string;
  message: string;
}

/** Normalised cell values: string, number, string[] (categories). Blank cells are absent. */
export type CellValue = string | number | string[];

export interface ParsedRow {
  row: number;
  values: Record<string, CellValue>;
}

export interface ParsedWorkbook {
  tabs: Partial<Record<TabKey, ParsedRow[]>>;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/** A problem with the file as a whole (not xlsx, too big): reported as a 400, not a row error. */
export class ImportFileError extends Error {
  status = 400;
}

// ---------------------------------------------------------------- file checks

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** Uncompressed size limits: stop "zip bomb" files before any XML is parsed. */
const MAX_UNCOMPRESSED_TOTAL = 150 * 1024 * 1024;
const MAX_UNCOMPRESSED_ENTRY = 100 * 1024 * 1024;

interface ZipEntry { name: string; method: number; compressedSize: number; localOffset: number }

/**
 * Checks the zip's central directory: every entry's declared uncompressed size must be
 * within limits. ZIP64 archives (sizes above 4 GB) are rejected outright.
 * Returns the entries so the worksheets can be row-counted without loading the workbook.
 */
export function checkZipContainer(buf: Buffer): ZipEntry[] {
  if (buf.length > MAX_FILE_BYTES) throw new ImportFileError("The file is larger than 5 MB.");
  if (buf.length < 22 || !buf.subarray(0, 4).equals(ZIP_MAGIC)) {
    throw new ImportFileError("This isn't an Excel .xlsx file. Save it as \"Excel Workbook (.xlsx)\" and try again (.xls and .csv aren't supported).");
  }
  const damaged = () => new ImportFileError("The file is damaged or isn't a valid .xlsx workbook.");
  const tooLarge = () => new ImportFileError("The workbook is too large to import.");
  // End of central directory: signature 0x06054b50 within the last 64 KB + 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw damaged();
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) throw tooLarge();
  const entries: ZipEntry[] = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) throw damaged();
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const size = buf.readUInt32LE(offset + 24);
    const nameLength = buf.readUInt16LE(offset + 28);
    const localOffset = buf.readUInt32LE(offset + 42);
    if (size === 0xffffffff || compressedSize === 0xffffffff || size > MAX_UNCOMPRESSED_ENTRY) throw tooLarge();
    total += size;
    if (total > MAX_UNCOMPRESSED_TOTAL) throw tooLarge();
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }
  return entries;
}

/**
 * Counts <row> elements in one worksheet by streaming its decompressed XML, so an
 * oversized sheet (or a zip bomb) is stopped early without building the workbook.
 * Also enforces the real decompressed size, not just the size the zip declares.
 */
async function countSheetRows(buf: Buffer, entry: ZipEntry, onRow: () => void): Promise<void> {
  const h = entry.localOffset;
  if (h + 30 > buf.length || buf.readUInt32LE(h) !== 0x04034b50) throw new ImportFileError("The file is damaged or isn't a valid .xlsx workbook.");
  const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method !== 0 && entry.method !== 8) throw new ImportFileError("The file is damaged or isn't a valid .xlsx workbook.");

  const ROW = /<(?:[A-Za-z_][\w.-]*:)?row[\s>/]/g;
  let carry = "";
  let bytes = 0;
  const scan = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_UNCOMPRESSED_ENTRY) throw new ImportFileError("The workbook is too large to import.");
    const text = carry + chunk.toString("latin1");
    ROW.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = ROW.exec(text))) { onRow(); lastEnd = m.index + m[0].length; }
    // Keep a short tail so a tag split across two chunks is still counted once.
    carry = text.slice(Math.max(lastEnd, text.length - 16));
  };
  if (entry.method === 0) { scan(data); return; }

  await new Promise<void>((resolve, reject) => {
    const inflate = zlib.createInflateRaw();
    inflate.on("data", (chunk: Buffer) => {
      try { scan(chunk); } catch (err) { inflate.destroy(); reject(err); }
    });
    inflate.on("end", () => resolve());
    inflate.on("error", () => reject(new ImportFileError("The file is damaged or isn't a valid .xlsx workbook.")));
    inflate.end(data);
  });
}

/** Rejects workbooks with too many rows before the whole workbook is loaded into memory. */
export async function checkRowCounts(buf: Buffer, entries: ZipEntry[]): Promise<void> {
  let total = 0;
  for (const entry of entries.filter((e) => /^xl\/worksheets\/[^/]+\.xml$/i.test(e.name))) {
    let rows = 0;
    await countSheetRows(buf, entry, () => {
      rows++;
      total++;
      // Allow for each sheet's header and notes rows.
      if (rows > MAX_ROWS_PER_TAB + 2) {
        throw new ImportFileError(`A sheet has more than ${MAX_ROWS_PER_TAB.toLocaleString("en-GB")} rows. Split the import into smaller files.`);
      }
      if (total > MAX_ROWS_TOTAL + 2 * TABS.length) {
        throw new ImportFileError(`The workbook has more than ${MAX_ROWS_TOTAL.toLocaleString("en-GB")} rows in total. Split the import into smaller files.`);
      }
    });
  }
}

// ---------------------------------------------------------------- cell values

type Raw = string | number | boolean | Date | { error: string } | null;
const NO_RESULT = { error: "formula has no saved value" };

/** Unwraps exceljs cell values: formulas give their saved result, rich text its text. */
export function rawCell(v: ExcelJS.CellValue | undefined): Raw {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  const o = v as any;
  if ("formula" in o || "sharedFormula" in o) {
    const r = o.result;
    if (r === undefined || r === null) return NO_RESULT;
    return rawCell(r);
  }
  if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text ?? "").join("");
  if (typeof o.text === "string") return o.text; // hyperlink
  if (typeof o.error === "string") return { error: o.error };
  return null;
}

const emailSchema = z.string().email().max(320);
const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(y: number, m: number, d: number): string | undefined {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  if (y < 1900) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Text form of a raw value, as a person would read it in the cell. */
function asText(raw: Exclude<Raw, null | { error: string }>): string {
  if (raw instanceof Date) return `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`;
  if (typeof raw === "number") return Number.isInteger(raw) ? String(raw) : String(raw);
  return String(raw).trim();
}

type Result = { value: CellValue } | { error: string } | { blank: true };

/** Applies the column's rules (plan 3.2) to one cell. */
export function normaliseCell(col: ColumnSpec, raw: Raw): Result {
  if (raw !== null && typeof raw === "object" && !(raw instanceof Date)) {
    return { error: `${col.header} contains an Excel error (${raw.error})` };
  }
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return col.required ? { error: `${col.header} is required` } : { blank: true };
  }
  const text = asText(raw);
  if (text.length > MAX_CELL_CHARS) return { error: `${col.header} is longer than ${MAX_CELL_CHARS} characters` };

  switch (col.kind) {
    case "id": {
      if (text.length > 50) return { error: `${col.header} must be 50 characters or fewer` };
      return { value: text };
    }
    case "text": {
      const max = col.max ?? 200;
      if (text.length > max) return { error: `${col.header} must be ${max} characters or fewer` };
      return { value: text };
    }
    case "int": {
      const s = typeof raw === "number" ? raw : text.replace(/,/g, "");
      const n = typeof s === "number" ? s : /^\d+$/.test(s) ? Number(s) : NaN;
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) return { error: `${col.header} must be a whole number of 0 or more` };
      return { value: n };
    }
    case "money": {
      const s = typeof raw === "number" ? raw : text.replace(/[£,\s]/g, "");
      const n = typeof s === "number" ? s : /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
      if (!Number.isFinite(n) || n < 0 || n > 99_999_999) return { error: `${col.header} must be an amount of 0 or more, e.g. 12.50` };
      return { value: (Math.round(n * 100) / 100).toFixed(2) };
    }
    case "rating": {
      const n = typeof raw === "number" ? raw : /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
      if (!Number.isFinite(n) || n < 0 || n > 5) return { error: `${col.header} must be between 0 and 5` };
      return { value: (Math.round(n * 10) / 10).toFixed(1) };
    }
    case "date": {
      let iso: string | undefined;
      if (raw instanceof Date) {
        iso = isoDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
      } else if (typeof raw === "number") {
        // An Excel date serial in a cell that isn't formatted as a date.
        const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000);
        iso = raw > 0 ? isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) : undefined;
      } else {
        let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
        if (m) iso = isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
        else if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text))) iso = isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
      }
      if (!iso) return { error: `${col.header} '${text}' is not a valid date (use DD/MM/YYYY)` };
      if (iso > todayIso()) return { error: `${col.header} can't be in the future` };
      return { value: iso };
    }
    case "email": {
      const e = text.toLowerCase();
      if (!emailSchema.safeParse(e).success) return { error: `${col.header} '${text}' is not a valid email address` };
      return { value: e };
    }
    case "list": {
      const match = col.list!.find((o) => o.toLowerCase() === text.toLowerCase());
      if (!match) return { error: `${col.header} '${text}' must be one of ${col.list!.join(", ")}` };
      return { value: match };
    }
    case "categories": {
      const parts = Array.from(new Set(text.split(";").map((p) => p.trim()).filter(Boolean)));
      if (parts.length > 20 || parts.some((p) => p.length > 50)) {
        return { error: `${col.header}: up to 20 categories of 50 characters each` };
      }
      return { value: parts };
    }
  }
}

// ---------------------------------------------------------------- sheets

function cellText(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const raw = rawCell(ws.getRow(row).getCell(col).value);
  if (raw === null || (typeof raw === "object" && !(raw instanceof Date))) return "";
  return asText(raw);
}

function findSheet(wb: ExcelJS.Workbook, tab: TabSpec): ExcelJS.Worksheet | undefined {
  const want = normaliseHeader(tab.sheet);
  return wb.worksheets.find((ws) => normaliseHeader(ws.name) === want);
}

function parseSheet(ws: ExcelJS.Worksheet, tab: TabSpec, errors: ImportIssue[], warnings: ImportIssue[]): ParsedRow[] {
  // Map headers to column numbers.
  const headerRow = ws.getRow(HEADER_ROW);
  const byHeader = new Map<string, number>();
  const unknown: string[] = [];
  const known = new Map(tab.columns.map((c) => [normaliseHeader(c.header), c]));
  for (let c = 1; c <= Math.max(headerRow.cellCount, 1); c++) {
    const text = cellText(ws, HEADER_ROW, c);
    if (!text) continue;
    const key = normaliseHeader(text);
    if (known.has(key)) byHeader.set(key, c);
    else unknown.push(text);
  }
  const missing = tab.columns.filter((c) => c.required && !byHeader.has(normaliseHeader(c.header)));
  if (missing.length > 0) {
    // A completely empty sheet is simply skipped.
    if (byHeader.size === 0 && ws.actualRowCount <= 1) return [];
    errors.push({ tab: tab.sheet, row: HEADER_ROW, message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.map((c) => c.header).join(", ")}. Use the headers from the template.` });
    return [];
  }
  if (unknown.length > 0) {
    warnings.push({ tab: tab.sheet, row: HEADER_ROW, message: `Ignored column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}` });
  }
  const cols = tab.columns
    .filter((c) => byHeader.has(normaliseHeader(c.header)))
    .map((c) => ({ spec: c, index: byHeader.get(normaliseHeader(c.header))! }));

  // Row 2 is the template's notes row when its cells match the notes; otherwise it is data.
  const notesMatch = cols.some(({ spec, index }) => cellText(ws, NOTES_ROW, index) === spec.note);
  const firstRow = notesMatch ? NOTES_ROW + 1 : NOTES_ROW;

  const rows: ParsedRow[] = [];
  for (let r = firstRow; r <= ws.rowCount; r++) {
    const raws = cols.map(({ spec, index }) => ({ spec, raw: rawCell(ws.getRow(r).getCell(index).value) }));
    const isBlank = raws.every(({ raw }) => raw === null || (typeof raw === "string" && raw.trim() === ""));
    if (isBlank) continue;
    const values: Record<string, CellValue> = {};
    for (const { spec, raw } of raws) {
      const res = normaliseCell(spec, raw);
      if ("error" in res) errors.push({ tab: tab.sheet, row: r, column: spec.header, message: res.error });
      else if ("value" in res) values[spec.key] = res.value;
    }
    rows.push({ row: r, values });
  }
  return rows;
}

/** Checks the file, then reads every known tab. Throws ImportFileError for file-level problems. */
export async function parseWorkbook(buf: Buffer): Promise<ParsedWorkbook> {
  const entries = checkZipContainer(buf);
  await checkRowCounts(buf, entries);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as any);
  } catch (err) {
    // Logged without the message, which could quote file contents.
    console.warn("[import] workbook could not be loaded:", describeErrorForLog(err));
    throw new ImportFileError("The file is damaged or isn't a valid .xlsx workbook.");
  }

  const result: ParsedWorkbook = { tabs: {}, errors: [], warnings: [] };
  let found = 0;
  for (const tab of TABS) {
    const ws = findSheet(wb, tab);
    if (!ws) continue;
    found++;
    result.tabs[tab.key] = parseSheet(ws, tab, result.errors, result.warnings);
  }
  if (found === 0) {
    throw new ImportFileError(`No import tabs found. The workbook needs tabs named like the template's: ${TABS.map((t) => t.sheet).join(", ")}.`);
  }
  const extra = wb.worksheets
    .filter((ws) => ws.state !== "hidden" && ws.state !== "veryHidden")
    .filter((ws) => !TABS.some((t) => normaliseHeader(t.sheet) === normaliseHeader(ws.name)) && normaliseHeader(ws.name) !== "read me");
  for (const ws of extra) result.warnings.push({ tab: ws.name, message: "Tab not recognised; ignored" });
  return result;
}
