/**
 * Shared purchasing UI: status badges, money that always shows its currency, the PO
 * editor, and helpers. docs/asset-stock-jobs-plan.md phase P.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSuppliers, useInventory, useJobs } from "@/hooks/use-data";
import { CURRENCIES, HOME_CURRENCY, currencySymbol, formatMoney } from "@shared/constants";

export type PoLine = {
  id: number; lineNo: number; partId: string | null; description: string; quantity: number; unitPrice: string;
  quantityReceived: number; quantityCancelled: number; outstanding: number; deliveryStatus: string;
};
export type PoEvent = { id: number; at: string; userName: string | null; action: string; note: string | null };
export type PoReceipt = {
  id: number; receivedAt: string; receivedBy: string | null; deliveryNote: string | null; exchangeRate: string;
  rateDate: string | null; rateSource: string | null; lines: { poLineId: number; quantity: number; transactionId: string | null }[];
};
export type PoSummary = {
  id: string; vendor: string; supplierId: string | null; status: string; currency: string; total: string;
  totalHome: string | null; exchangeRate: string | null; rateDate: string | null; rateSource: string | null;
  homeCurrency: string; jobId: string | null; expectedDate: string | null; notes: string | null;
  requestedBy: string | null; createdById: number | null; createdAt: string | null; submittedAt: string | null;
  approvedById: number | null; approvedAt: string | null; sentAt: string | null; rejectionReason: string | null;
  ordered?: number; received?: number; cancelled?: number; date: string | null;
};
export type PoDetail = PoSummary & {
  createdByName: string | null; approvedByName: string | null; sentByName: string | null;
  lines: PoLine[]; receipts: PoReceipt[]; events: PoEvent[];
};

/** "409: {"message":"..."}" from apiRequest -> just the message. */
export function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const json = text.indexOf("{");
  if (json >= 0) {
    try { return JSON.parse(text.slice(json)).message ?? text; } catch { /* not JSON */ }
  }
  return text.replace(/^\d{3}:\s*/, "");
}

const STATUS_TONE: Record<string, string> = {
  "Draft": "bg-slate-100 text-slate-700 border-slate-200",
  "Pending Approval": "bg-amber-50 text-amber-800 border-amber-200",
  "Approved": "bg-blue-50 text-blue-700 border-blue-200",
  "Rejected": "bg-red-50 text-red-700 border-red-200",
  "Sent": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Partially Received": "bg-teal-50 text-teal-700 border-teal-200",
  "Received": "bg-green-50 text-green-700 border-green-200",
  "Closed": "bg-zinc-100 text-zinc-700 border-zinc-200",
  "Cancelled": "bg-zinc-100 text-zinc-500 border-zinc-200 line-through",
};

export function PoStatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATUS_TONE[status])}>{status}</Badge>;
}

/** The PO's currency, always shown: "GBP (£)" or "EUR (€)". */
export function CurrencyTag({ currency, className }: { currency: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] whitespace-nowrap", currency !== HOME_CURRENCY && "border-amber-300 bg-amber-50 text-amber-800", className)}
      title={currency === HOME_CURRENCY ? "Home currency" : "Foreign currency"}>
      {currency} ({currencySymbol(currency).trim()})
    </Badge>
  );
}

/** Amount in the PO currency, plus its GBP equivalent for foreign currencies. */
export function MoneyPair({ amount, currency, homeAmount, rate, rateDate, rateSource, className }: {
  amount: string | number; currency: string; homeAmount?: string | number | null; rate?: string | number | null;
  rateDate?: string | null; rateSource?: string | null; className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-medium">{formatMoney(amount, currency)}</div>
      {currency !== HOME_CURRENCY && homeAmount !== null && homeAmount !== undefined && (
        <div className="text-xs text-muted-foreground">
          ≈ {formatMoney(homeAmount, HOME_CURRENCY)}
          {rate ? <> at {Number(rate).toFixed(4)}{rateSource ? ` (${rateSource}${rateDate ? ` ${formatDate(rateDate)}` : ""})` : ""}</> : null}
        </div>
      )}
    </div>
  );
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Today's ECB rate for a currency (home-currency units per 1 unit), if one is stored. */
export function useLatestRate(currency: string) {
  return useQuery<{ rate: number; rateDate: string; source: string } | null>({
    queryKey: ["/api/exchange-rates/latest", currency],
    queryFn: async () => {
      if (currency === HOME_CURRENCY) return { rate: 1, rateDate: "", source: "Home" };
      const res = await fetch(`/api/exchange-rates/latest?currency=${encodeURIComponent(currency)}`, { credentials: "include" });
      return res.ok ? res.json() : null;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function invalidatePurchasing(id?: string) {
  for (const key of ["/api/purchase-orders", "/api/purchasing/reorder", "/api/purchasing/on-order", "/api/inventory", "/api/transactions", "/api/dashboard/summary"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
  if (id) queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", id] });
}

// ------------------------------------------------------------------ editor

type EditLine = { key: number; partId: string; description: string; quantity: string; unitPrice: string };
const NO_PART = "__nonstock__";
let lineKey = 1;

export function PoEditorDialog({ open, onOpenChange, po, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; po?: PoDetail | null; onSaved: (id: string) => void;
}) {
  const { data: suppliersData = [] } = useSuppliers();
  const { data: partsData = [] } = useInventory();
  const { data: jobsData = [] } = useJobs();
  const suppliers = suppliersData as any[];
  const parts = partsData as any[];
  const [supplierId, setSupplierId] = useState("");
  const [currency, setCurrency] = useState<string>(HOME_CURRENCY);
  const [jobId, setJobId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: rate } = useLatestRate(currency);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSupplierId(po?.supplierId ?? "");
    setCurrency(po?.currency ?? HOME_CURRENCY);
    setJobId(po?.jobId ?? "");
    setExpectedDate(po?.expectedDate ?? "");
    setNotes(po?.notes ?? "");
    setLines(po?.lines?.length
      ? po.lines.map((l) => ({ key: lineKey++, partId: l.partId ?? "", description: l.description, quantity: String(l.quantity), unitPrice: Number(l.unitPrice).toFixed(2) }))
      : [{ key: lineKey++, partId: "", description: "", quantity: "1", unitPrice: "" }]);
  }, [open, po]);

  const chooseSupplier = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (s?.currency) setCurrency(s.currency);
  };
  const setLine = (key: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const choosePart = (key: number, partId: string) => {
    if (partId === NO_PART) return setLine(key, { partId: "" });
    const p = parts.find((x) => x.id === partId);
    const homeCost = p?.unitCost ? Number(p.unitCost) : null;
    const price = homeCost === null ? "" : currency === HOME_CURRENCY ? homeCost.toFixed(2) : rate?.rate ? (homeCost / rate.rate).toFixed(2) : "";
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, partId, description: p?.name ?? l.description, unitPrice: l.unitPrice || price } : l)));
  };

  const total = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice.replace(/[,\s]/g, "")) || 0), 0), [lines]);
  const symbol = currencySymbol(currency).trim();

  const save = async () => {
    setError(null);
    if (!supplierId) return setError("Choose a supplier.");
    const body = {
      supplierId, currency, jobId: jobId || null, expectedDate: expectedDate || null, notes: notes.trim() || null,
      lines: lines.map((l) => ({
        partId: l.partId || null, description: l.description.trim() || null,
        quantity: parseInt(l.quantity, 10) || 0, unitPrice: l.unitPrice.replace(/[,\s]/g, "") || "0",
      })),
    };
    setSaving(true);
    try {
      const res = await apiRequest(po ? "PUT" : "POST", po ? `/api/purchase-orders/${po.id}` : "/api/purchase-orders", body);
      const saved = await res.json();
      invalidatePurchasing(saved.id);
      onSaved(saved.id);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{po ? `Edit ${po.id}` : "New purchase order"}</DialogTitle>
          <DialogDescription>Prices are ex-VAT, in the PO currency shown.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={chooseSupplier}>
              <SelectTrigger data-testid="select-po-supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.currency ?? HOME_CURRENCY}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PO currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger data-testid="select-po-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c} ({currencySymbol(c).trim()}){c === HOME_CURRENCY ? " · home currency" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {currency !== HOME_CURRENCY && (
              <p className="text-xs text-muted-foreground">
                {rate?.rate ? `Today: 1 ${currency} = ${formatMoney(rate.rate, HOME_CURRENCY, 4)} (ECB ${formatDate(rate.rateDate)}). The rate is fixed when submitted for approval.` : `No ECB rate for ${currency} yet; a Manager can enter one when submitting.`}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>For job (optional)</Label>
            <Select value={jobId || "__none__"} onValueChange={(v) => setJobId(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="select-po-job"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No job</SelectItem>
                {(jobsData as any[]).filter((j) => j.status !== "Completed" || j.id === jobId).map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.id} – {j.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected delivery</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} data-testid="input-po-expected" />
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Part</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-36 text-right">Unit price ({currency})</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitPrice.replace(/[,\s]/g, "")) || 0);
                return (
                  <TableRow key={l.key}>
                    <TableCell>
                      <Select value={l.partId || NO_PART} onValueChange={(v) => choosePart(l.key, v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PART}>Non-stock item / service</SelectItem>
                          {parts.map((p) => <SelectItem key={p.id} value={p.id}>{p.id} – {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input className="h-9" value={l.description} placeholder={l.partId ? "Part name" : "What is being bought"} onChange={(e) => setLine(l.key, { description: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-9 text-right" type="number" min={1} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-sm text-muted-foreground">{symbol}</span>
                        <Input className="h-9 text-right pl-7" inputMode="decimal" value={l.unitPrice} placeholder="0.00" onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{formatMoney(lineTotal, currency)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove line" disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { key: lineKey++, partId: "", description: "", quantity: "1", unitPrice: "" }])}>
            <Plus className="mr-1 size-4" /> Add line
          </Button>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total (ex-VAT)</div>
            <div className="text-xl font-bold" data-testid="text-po-editor-total">{formatMoney(total, currency)}</div>
            {currency !== HOME_CURRENCY && rate?.rate ? (
              <div className="text-xs text-muted-foreground">≈ {formatMoney(total * rate.rate, HOME_CURRENCY)} at today's ECB rate</div>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes for the supplier</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-po">
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
