import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, X, AlertTriangle } from "lucide-react";

type Issue = { tab?: string; row?: number; column?: string; message: string };
type TabSummary = { key: string; tab: string; new: number; updated: number; unchanged: number; removed?: number };
type ImportResult = {
  ok: boolean;
  summary: TabSummary[];
  errors: Issue[];
  errorCount: number;
  warnings: Issue[];
  stockAdjustments: number;
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 5 * 1024 * 1024;

async function send(url: string, file: File): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": XLSX_MIME },
    body: file,
    credentials: "include",
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body };
}

function where(i: Issue) {
  return [i.tab, i.row ? `row ${i.row}` : null].filter(Boolean).join(" ");
}

function downloadErrorsCsv(errors: Issue[]) {
  const esc = (v: unknown) => {
    let s = v === undefined || v === null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // never let a spreadsheet run a cell as a formula
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [["Tab", "Row", "Column", "Problem"], ...errors.map((e) => [e.tab, e.row, e.column, e.message])]
    .map((cols) => cols.map(esc).join(","));
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "import-errors.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** Settings → Data Import: template, upload, preview, then an all-or-nothing import. */
export default function DataImport() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const preview = async (chosen: File) => {
    setFile(chosen);
    setResult(null);
    if (chosen.size > MAX_BYTES) {
      toast({ title: "File too large", description: "The file is larger than 5 MB.", variant: "destructive" });
      return;
    }
    setBusy("preview");
    try {
      const { status, body } = await send("/api/import/preview", chosen);
      if (status === 200 || status === 422) setResult(body);
      else toast({ title: "Couldn't read the file", description: body?.message ?? `Error ${status}`, variant: "destructive" });
    } catch {
      toast({ title: "Upload failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy("commit");
    try {
      const { status, body } = await send("/api/import/commit", file);
      if (status === 200) {
        const total = (body as ImportResult).summary.reduce((n, s) => n + s.new + s.updated + (s.removed ?? 0), 0);
        toast({ title: "Import complete", description: `${total} change${total === 1 ? "" : "s"} saved.` });
        await queryClient.invalidateQueries();
        reset();
      } else if (status === 422) {
        // The data changed since the preview (or someone else imported): show the new errors.
        setResult(body);
        toast({ title: "Nothing was imported", description: "The file has errors; see the list below.", variant: "destructive" });
      } else {
        toast({ title: "Import failed", description: body?.message ?? `Error ${status}. Nothing was saved.`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Import failed", description: "Check your connection. Nothing was saved.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const changes = result ? result.summary.reduce((n, s) => n + s.new + s.updated + (s.removed ?? 0), 0) : 0;
  const canImport = !!result && result.errorCount === 0 && changes > 0 && !busy;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Upload className="size-5" /> Data Import
        </CardTitle>
        <CardDescription>
          Set up or update sites, locations, store rooms, bins, suppliers, parts, assets, spares and users from one Excel workbook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="/api/import/template" download data-testid="link-import-template">
              <Download className="size-4" /> Template
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="/api/import/example" download data-testid="link-import-example">
              <FileSpreadsheet className="size-4" /> Example (food site)
            </a>
          </Button>
        </div>

        <div className="flex items-center gap-3 p-3 border rounded-md bg-background">
          <FileSpreadsheet className="size-5 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            {file ? <span className="font-medium truncate block">{file.name}</span> : <span className="text-muted-foreground">No file chosen</span>}
          </div>
          {file && !busy && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset} aria-label="Clear file">
              <X className="size-4" />
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-testid="input-import-file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) preview(f); }}
          />
          <Button size="sm" className="gap-2" onClick={() => inputRef.current?.click()} disabled={!!busy}>
            {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy === "preview" ? "Checking…" : file ? "Choose another" : "Choose file"}
          </Button>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="border rounded-md bg-background overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tab</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Unchanged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.summary.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell className="font-medium">
                        {s.tab}
                        {!!s.removed && <span className="block text-xs text-muted-foreground">{s.removed} link{s.removed === 1 ? "" : "s"} removed</span>}
                      </TableCell>
                      <TableCell className="text-right">{s.new}</TableCell>
                      <TableCell className="text-right">{s.updated}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.unchanged}</TableCell>
                    </TableRow>
                  ))}
                  {result.summary.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No rows found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {result.stockAdjustments > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.stockAdjustments} stock level change{result.stockAdjustments === 1 ? "" : "s"} will be logged as "Import Adjustment".
              </p>
            )}

            {result.warnings.length > 0 && (
              <div className="text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="flex gap-2"><AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" /><span><b>{where(w)}</b> {w.message}</span></p>
                ))}
              </div>
            )}

            {result.errorCount > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    {result.errorCount} error{result.errorCount === 1 ? "" : "s"}: fix these and upload again. Nothing has been saved.
                  </p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadErrorsCsv(result.errors)}>
                    Download list
                  </Button>
                </div>
                <ul className="text-xs space-y-1 max-h-64 overflow-y-auto" data-testid="list-import-errors">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <b>{where(e)}</b>{e.column ? <Badge variant="outline" className="mx-1 text-[10px] py-0">{e.column}</Badge> : " "}{e.message}
                    </li>
                  ))}
                </ul>
                {result.errorCount > result.errors.length && (
                  <p className="text-xs text-muted-foreground">Showing the first {result.errors.length}.</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="size-4" />
                  {changes > 0 ? "No errors. Ready to import." : "No errors, but nothing would change."}
                </p>
                <Button onClick={commit} disabled={!canImport} className="gap-2" data-testid="button-import-commit">
                  {busy === "commit" && <Loader2 className="size-4 animate-spin" />}
                  Import {changes > 0 ? `${changes} change${changes === 1 ? "" : "s"}` : ""}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="bg-background border rounded-md p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How it works</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>One workbook, one tab per type. Leave tabs you don't need empty.</li>
            <li>Existing IDs are updated, new IDs are created; blank cells leave existing values as they are. Nothing is deleted.</li>
            <li>Everything is checked first. The import saves all rows or none.</li>
            <li>Users are added without a password: set one from the Team page.</li>
            <li>Limits: 5 MB, 5,000 rows per tab.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
