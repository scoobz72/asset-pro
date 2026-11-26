/**
 * Builds the import template (and the filled-in example) from spec.ts, so the headers,
 * notes and dropdowns always match what the parser expects.
 */
import ExcelJS from "exceljs";
import { TABS, type TabKey, FIRST_DATA_ROW, HEADER_ROW, NOTES_ROW, MAX_ROWS_PER_TAB } from "./spec";

const NAVY = "FF102A45";
const AMBER = "FFF59E0B";
const NOTE_FILL = "FFF1F5F9";
/** Dropdowns and text formatting are applied to this many rows below the header. */
const TEMPLATE_ROWS = 1000;

export type ExampleCell = string | number | Date | null | undefined;
export type ExampleRows = Partial<Record<TabKey, Record<string, ExampleCell>[]>>;

const READ_ME = [
  "How to use this workbook",
  "",
  "1. Fill in the tabs you need. Leave the others empty: empty tabs are skipped. Navy headers are required columns.",
  "2. Keep row 1 (headers) as it is. Row 2 (grey) is a note and is ignored. Start your data on row 3.",
  "3. IDs are your own codes, e.g. SITE-01 or BIN-A01. They must be unique within each tab.",
  "4. A reference (e.g. Site ID on Asset Locations) can point at a record that already exists in myCMMS, or at a row in this workbook.",
  "5. Existing IDs are updated; new IDs are created. A blank cell leaves an existing value unchanged. Nothing is ever deleted.",
  "6. Asset Spares: every asset you list gets exactly the parts listed for it here.",
  "7. Stock Qty changes are recorded as 'Import Adjustment' transactions.",
  "8. Users are created without a password: set one from the Team page.",
  "9. Dates: DD/MM/YYYY. Money: plain numbers, e.g. 12.50.",
  "",
  "Upload the file in Settings → Data Import. You'll see a preview with any errors before anything is saved.",
  `Limits: 5 MB file, ${MAX_ROWS_PER_TAB.toLocaleString("en-GB")} rows per tab.`,
];

function addValidation(ws: ExcelJS.Worksheet, col: number, from: number, to: number, list: readonly string[]) {
  const letter = ws.getColumn(col).letter;
  const validation: ExcelJS.DataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`"${list.join(",")}"`],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Not in the list",
    error: `Choose one of: ${list.join(", ")}`,
  };
  const dv = (ws as any).dataValidations;
  if (dv && typeof dv.add === "function") {
    dv.add(`${letter}${from}:${letter}${to}`, validation);
  } else {
    for (let r = from; r <= to; r++) ws.getCell(`${letter}${r}`).dataValidation = validation;
  }
}

export async function buildWorkbook(rows: ExampleRows = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "myCMMS";
  wb.created = new Date();

  const readMe = wb.addWorksheet("Read Me", { properties: { tabColor: { argb: AMBER } } });
  readMe.getColumn(1).width = 120;
  READ_ME.forEach((line, i) => {
    const cell = readMe.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14, color: { argb: NAVY } };
  });

  for (const tab of TABS) {
    const ws = wb.addWorksheet(tab.sheet, { views: [{ state: "frozen", ySplit: NOTES_ROW }] });
    const data = rows[tab.key] ?? [];
    const lastRow = FIRST_DATA_ROW + Math.max(TEMPLATE_ROWS, data.length) - 1;

    tab.columns.forEach((col, i) => {
      const c = i + 1;
      const column = ws.getColumn(c);
      column.width = col.width ?? Math.max(12, col.header.length + 2);

      const head = ws.getCell(HEADER_ROW, c);
      // Required columns are shown in navy rather than with "*", so headers match the parser exactly.
      head.value = col.header;
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.required ? NAVY : "FF475569" } };
      head.alignment = { vertical: "middle", wrapText: true };

      const note = ws.getCell(NOTES_ROW, c);
      note.value = col.note;
      note.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
      note.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NOTE_FILL } };
      note.alignment = { wrapText: true, vertical: "top" };

      // IDs and other text stay as typed (no "007" -> 7); dates show as DD/MM/YYYY.
      if (col.kind === "id" || col.kind === "text" || col.kind === "email") column.numFmt = "@";
      if (col.kind === "date") column.numFmt = "dd/mm/yyyy";
      if (col.kind === "money") column.numFmt = "£#,##0.00";
      if (col.list) addValidation(ws, c, FIRST_DATA_ROW, lastRow, col.list);
    });
    ws.getRow(HEADER_ROW).height = 30;
    ws.getRow(NOTES_ROW).height = 30;

    data.forEach((record, i) => {
      const row = ws.getRow(FIRST_DATA_ROW + i);
      tab.columns.forEach((col, c) => {
        const v = record[col.key];
        if (v !== undefined && v !== null && v !== "") row.getCell(c + 1).value = v;
      });
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
