import Layout from "@/components/Layout";
import { matchesSearch } from "@/lib/search";
import { useTransactions } from "@/hooks/use-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { STOCK_IN_TYPES, STOCK_OUT_TYPES, STOCK_EITHER_TYPES } from "@shared/constants";
import type { StockTransaction } from "@shared/schema";

const FILTERS = {
  all: { label: "All movements", types: null },
  in: { label: "Stock in", types: STOCK_IN_TYPES as readonly string[] },
  out: { label: "Stock out", types: STOCK_OUT_TYPES as readonly string[] },
  issues: { label: "Job issues & returns", types: ["Job Issue", "Return to Stores", "Job Book Out"] },
  adjustments: { label: "Stock takes & imports", types: STOCK_EITHER_TYPES as readonly string[] },
} as const;
type FilterKey = keyof typeof FILTERS;

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

function when(t: StockTransaction): Date | null {
  const d = new Date((t as any).createdAt ?? t.date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function TypeBadge({ type, quantity }: { type: string; quantity: number }) {
  const isIn = (STOCK_IN_TYPES as readonly string[]).includes(type);
  const isOut = (STOCK_OUT_TYPES as readonly string[]).includes(type) || type === "Job Book Out";
  const Icon = isIn ? ArrowDownToLine : isOut ? ArrowUpFromLine : RefreshCw;
  const tone = isIn
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : type.startsWith("Stock Out")
      ? "text-red-700 bg-red-50 border-red-200"
      : isOut
        ? "text-orange-700 bg-orange-50 border-orange-200"
        : quantity >= 0 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-blue-700 bg-blue-50 border-blue-200";
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal whitespace-nowrap", tone)}>
      <Icon className="size-3" /> {type}
    </Badge>
  );
}

/** CSV with every cell quoted, and formula-like text neutralised so a spreadsheet can't run it. */
function downloadCsv(rows: StockTransaction[]) {
  const esc = (v: unknown) => {
    let s = v === undefined || v === null ? "" : String(v);
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Date", "Transaction ID", "Part ID", "Part", "Type", "Quantity", "Unit cost", "Value", "Balance after", "Job", "Asset", "Reference", "User"];
  const lines = rows.map((t) => {
    const d = when(t);
    return [
      d ? format(d, "dd/MM/yyyy HH:mm") : t.date, t.id, t.partId, t.partName, t.type, t.quantity,
      t.unitCost ?? "", t.value ?? "", t.balanceAfter ?? "", t.jobId ?? "", t.assetId ?? "", t.reference ?? "", t.userId ?? "",
    ].map(esc).join(",");
  });
  const url = URL.createObjectURL(new Blob([[header.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `stock-transactions-${format(new Date(), "yyyy-MM-dd")}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data, isLoading } = useTransactions();
  const transactions = (data as StockTransaction[] | undefined) ?? [];

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const types = FILTERS[filter].types;
    return transactions
      .filter((t) => !types || types.includes(t.type))
      .filter((t) => matchesSearch(q, t.partName, t.partId, t.reference, t.jobId, t.assetId, t.id, t.userId, t.type, t.poId))
      .sort((a, b) => (when(b)?.getTime() ?? 0) - (when(a)?.getTime() ?? 0));
  }, [transactions, searchTerm, filter]);

  const totals = useMemo(() => {
    let valueIn = 0, valueOut = 0, uncosted = 0;
    for (const t of filtered) {
      if (t.value === null || t.value === undefined) { uncosted++; continue; }
      const v = Number(t.value);
      if (v >= 0) valueIn += v; else valueOut += -v;
    }
    return { valueIn, valueOut, uncosted };
  }, [filtered]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Transactions</h1>
          <p className="text-muted-foreground mt-1">Every stock movement, with its FIFO cost.</p>
        </div>
        <Button variant="outline" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0} data-testid="button-export-transactions">
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 my-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Value in</p>
          <p className="text-2xl font-bold text-emerald-700">{gbp(totals.valueIn)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Value out</p>
          <p className="text-2xl font-bold text-orange-700">{gbp(totals.valueOut)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Movements shown</p>
          <p className="text-2xl font-bold">{filtered.length.toLocaleString("en-GB")}</p>
          {totals.uncosted > 0 && <p className="text-xs text-muted-foreground mt-1">{totals.uncosted} from before costing started</p>}
        </CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center pb-4 gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search part, job, asset, reference..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" data-testid="input-search-transactions" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="sm:w-56" data-testid="select-transaction-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTERS) as FilterKey[]).map((k) => <SelectItem key={k} value={k}>{FILTERS[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / Time</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right hidden md:table-cell">Unit cost</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right hidden lg:table-cell">Balance</TableHead>
              <TableHead className="hidden md:table-cell">Job / Asset</TableHead>
              <TableHead className="hidden lg:table-cell">Reference</TableHead>
              <TableHead className="hidden xl:table-cell">User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No transactions found.</TableCell>
              </TableRow>
            ) : filtered.slice(0, 1000).map((t) => {
              const d = when(t);
              const value = t.value === null || t.value === undefined ? null : Number(t.value);
              return (
                <TableRow key={t.id} data-testid={`row-transaction-${t.id}`}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {d ? format(d, "dd MMM yyyy") : t.date}
                    {d && <div className="text-xs text-muted-foreground">{format(d, "HH:mm")}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{t.partName ?? t.partId}</div>
                    <div className="text-xs text-muted-foreground font-mono">{t.partId}</div>
                  </TableCell>
                  <TableCell><TypeBadge type={t.type} quantity={t.quantity} /></TableCell>
                  <TableCell className={cn("text-right font-semibold", t.quantity > 0 ? "text-emerald-700" : "text-orange-700")}>
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </TableCell>
                  <TableCell className="text-right text-sm hidden md:table-cell">
                    {t.unitCost === null || t.unitCost === undefined ? "—" : gbp(Number(t.unitCost))}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-medium", value === null ? "text-muted-foreground" : value >= 0 ? "text-emerald-700" : "text-orange-700")}>
                    {value === null ? "—" : gbp(value)}
                  </TableCell>
                  <TableCell className="text-right text-sm hidden lg:table-cell">{t.balanceAfter ?? "—"}</TableCell>
                  <TableCell className="text-sm hidden md:table-cell">
                    {t.jobId && <div className="font-mono text-xs">{t.jobId}</div>}
                    {t.assetId && <div className="text-xs text-muted-foreground">{t.assetId}</div>}
                    {!t.jobId && !t.assetId && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm hidden lg:table-cell max-w-[220px] truncate" title={t.reference ?? undefined}>{t.reference || "—"}</TableCell>
                  <TableCell className="text-sm hidden xl:table-cell">{t.userId || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {filtered.length > 1000 && (
        <p className="text-xs text-muted-foreground mt-2">Showing the latest 1,000 of {filtered.length.toLocaleString("en-GB")}. Export CSV includes them all.</p>
      )}
    </Layout>
  );
}
