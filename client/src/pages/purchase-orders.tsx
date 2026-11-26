import Layout from "@/components/Layout";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Search, RefreshCcw, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { HOME_CURRENCY, formatMoney } from "@shared/constants";
import {
  PoStatusBadge, CurrencyTag, MoneyPair, PoEditorDialog, formatDate, errorMessage, invalidatePurchasing,
  type PoSummary,
} from "@/components/po";

const VIEWS = {
  open: { label: "Open", statuses: ["Draft", "Pending Approval", "Approved", "Rejected", "Sent", "Partially Received"] },
  approval: { label: "Awaiting approval", statuses: ["Pending Approval"] },
  delivery: { label: "Awaiting delivery", statuses: ["Sent", "Partially Received"] },
  done: { label: "Completed", statuses: ["Received", "Closed", "Cancelled"] },
  all: { label: "All", statuses: null },
} as const;
type View = keyof typeof VIEWS;

type Suggestion = {
  partId: string; name: string; unit: string; stock: number; onOrder: number; minStock: number; reorderQty: number | null;
  suggestedQty: number; supplierId: string | null; supplierName: string | null; currency: string;
  unitCostHome: number | null; unitPrice: number | null; leadTime: number | null;
};

function ReorderDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (ids: string[]) => void }) {
  const { toast } = useToast();
  const { data = [], isLoading } = useQuery<Suggestion[]>({ queryKey: ["/api/purchasing/reorder"], enabled: open, staleTime: 0 });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const chosen = data.filter((s) => selected[s.partId] ?? !!s.supplierId);
  const create = async () => {
    setSaving(true);
    try {
      const items = chosen.map((s) => ({ partId: s.partId, quantity: Math.max(1, parseInt(qty[s.partId] ?? String(s.suggestedQty), 10) || 1) }));
      const res = await apiRequest("POST", "/api/purchasing/reorder", { items });
      const { created } = await res.json();
      invalidatePurchasing();
      toast({ title: `${created.length} draft PO${created.length === 1 ? "" : "s"} created`, description: created.join(", ") });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't create POs", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of data) {
      const k = s.supplierName ? `${s.supplierName} · ${s.currency}` : "No primary supplier";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m);
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reorder suggestions</DialogTitle>
          <DialogDescription>
            Parts at or below minimum stock, after counting what's already on order. Selected lines become one draft PO per
            supplier, in that supplier's currency, priced from the part's unit cost.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : data.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Nothing needs reordering. Every part is above its minimum stock, counting what's on order.</p>
        ) : (
          <div className="space-y-4">
            {groups.map(([group, items]) => (
              <div key={group} className="border rounded-md overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-sm font-semibold">{group}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Part</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">On order</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right w-24">Order qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s) => {
                      const checked = selected[s.partId] ?? !!s.supplierId;
                      return (
                        <TableRow key={s.partId}>
                          <TableCell>
                            <Checkbox checked={checked} disabled={!s.supplierId} aria-label={`Order ${s.name}`}
                              onCheckedChange={(v) => setSelected((x) => ({ ...x, [s.partId]: !!v }))} />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{s.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{s.partId}</div>
                            {!s.supplierId && <div className="text-xs text-destructive">Set a primary supplier on the part to order it here.</div>}
                          </TableCell>
                          <TableCell className="text-right">{s.stock} {s.unit}</TableCell>
                          <TableCell className="text-right">{s.onOrder}</TableCell>
                          <TableCell className="text-right">{s.minStock}</TableCell>
                          <TableCell>
                            <Input className="h-8 text-right" type="number" min={1} value={qty[s.partId] ?? String(s.suggestedQty)}
                              onChange={(e) => setQty((x) => ({ ...x, [s.partId]: e.target.value }))} disabled={!checked} />
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">
                            {s.unitPrice === null ? <span className="text-muted-foreground">set on PO</span> : formatMoney(s.unitPrice, s.currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={create} disabled={saving || chosen.length === 0} data-testid="button-create-reorder-pos">
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create draft PO{chosen.length === 1 ? "" : "s"} ({chosen.length} line{chosen.length === 1 ? "" : "s"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseOrders() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const { data = [], isLoading } = useQuery<PoSummary[]>({ queryKey: ["/api/purchase-orders"] });

  const filtered = useMemo(() => {
    const statuses = VIEWS[view].statuses as readonly string[] | null;
    const q = search.trim().toLowerCase();
    return data
      .filter((po) => !statuses || statuses.includes(po.status))
      .filter((po) => !q || [po.id, po.vendor, po.jobId, po.requestedBy, po.currency].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [data, view, search]);

  const counts = useMemo(() => Object.fromEntries((Object.keys(VIEWS) as View[]).map((v) => {
    const st = VIEWS[v].statuses as readonly string[] | null;
    return [v, st ? data.filter((po) => st.includes(po.status)).length : data.length];
  })), [data]);

  // Totals by currency: amounts in different currencies are never added together.
  const openByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const po of data.filter((p) => (VIEWS.open.statuses as readonly string[]).includes(p.status))) {
      m.set(po.currency, (m.get(po.currency) ?? 0) + Number(po.total));
    }
    return Array.from(m);
  }, [data]);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Raise, approve, send and receive orders. Every amount shows its currency.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReorderOpen(true)} data-testid="button-reorder">
            <RefreshCcw className="mr-2 size-4" /> Reorder suggestions
          </Button>
          <Button onClick={() => setEditorOpen(true)} data-testid="button-new-po">
            <Plus className="mr-2 size-4" /> New PO
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 my-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Awaiting approval</p>
          <p className="text-2xl font-bold">{counts.approval ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          <p className="text-2xl font-bold">{counts.delivery ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Open value (ex-VAT, by currency)</p>
          {openByCurrency.length === 0 ? <p className="text-2xl font-bold">—</p> : openByCurrency.map(([cur, sum]) => (
            <p key={cur} className="text-lg font-bold leading-tight">{formatMoney(sum, cur)}</p>
          ))}
        </CardContent></Card>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList className="flex-wrap h-auto">
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <TabsTrigger key={v} value={v} data-testid={`tab-po-${v}`}>{VIEWS[v].label} ({counts[v] ?? 0})</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search PO, supplier, job…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-po" />
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Total (ex-VAT)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Delivery</TableHead>
              <TableHead className="hidden lg:table-cell">Job</TableHead>
              <TableHead className="hidden lg:table-cell">Raised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="inline size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                <ShoppingCart className="inline mr-2 size-4" /> No purchase orders here.
              </TableCell></TableRow>
            ) : filtered.map((po) => (
              <TableRow key={po.id} className="cursor-pointer" onClick={() => navigate(`/purchase-orders/${encodeURIComponent(po.id)}`)} data-testid={`row-po-${po.id}`}>
                <TableCell className="font-mono text-sm font-medium">{po.id}</TableCell>
                <TableCell className="text-sm">{po.vendor}</TableCell>
                <TableCell><CurrencyTag currency={po.currency} /></TableCell>
                <TableCell className="text-right text-sm">
                  <MoneyPair amount={po.total} currency={po.currency} homeAmount={po.currency === HOME_CURRENCY ? null : po.totalHome} />
                </TableCell>
                <TableCell><PoStatusBadge status={po.status} /></TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {po.ordered ? <>{po.received ?? 0} of {po.ordered} received</> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell font-mono text-xs">{po.jobId ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  {formatDate(po.createdAt ?? po.date)}
                  <div className="text-xs text-muted-foreground">{po.requestedBy ?? ""}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PoEditorDialog open={editorOpen} onOpenChange={setEditorOpen} onSaved={(id) => navigate(`/purchase-orders/${encodeURIComponent(id)}`)} />
      <ReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} onCreated={(ids) => { if (ids.length === 1) navigate(`/purchase-orders/${encodeURIComponent(ids[0])}`); else setView("open"); }} />
    </Layout>
  );
}
