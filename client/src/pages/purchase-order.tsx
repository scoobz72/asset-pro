import Layout from "@/components/Layout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Printer, Send, CheckCircle2, XCircle, Undo2, PackageCheck, Pencil, Ban, Lock, Inbox } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser, PRIVILEGED_ROLES } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { HOME_CURRENCY, formatMoney } from "@shared/constants";
import {
  PoStatusBadge, CurrencyTag, MoneyPair, PoEditorDialog, formatDate, formatDateTime, errorMessage,
  invalidatePurchasing, useLatestRate, type PoDetail,
} from "@/components/po";

type Action = "submit" | "withdraw" | "approve" | "reject" | "recall" | "send" | "close" | "cancel";

const ACTIONS: Record<Action, { title: string; button: string; description: string; noteLabel?: string; noteRequired?: boolean; danger?: boolean }> = {
  submit: { title: "Submit for approval", button: "Submit", description: "The lines are locked and the exchange rate is fixed now.", noteLabel: "Note for the approver (optional)" },
  withdraw: { title: "Withdraw from approval", button: "Withdraw", description: "The PO goes back to Draft so you can change it." },
  approve: { title: "Approve purchase order", button: "Approve", description: "Approves the PO for sending to the supplier.", noteLabel: "Note (optional)" },
  reject: { title: "Reject purchase order", button: "Reject", description: "The PO goes back to the requester to change.", noteLabel: "Reason", noteRequired: true, danger: true },
  recall: { title: "Recall approved PO", button: "Recall", description: "The approval is cleared and the PO goes back to Draft. It will need approving again. This is only possible until it's sent to the supplier.", noteLabel: "Reason (optional)" },
  send: { title: "Mark as sent to supplier", button: "Mark as sent", description: "After this the PO can't be recalled. Print or save the PDF to send it.", noteLabel: "How it was sent (optional), e.g. emailed to orders@…" },
  close: { title: "Close short", button: "Close PO", description: "Cancels every quantity still outstanding and closes the PO.", noteLabel: "Reason (optional)", danger: true },
  cancel: { title: "Cancel purchase order", button: "Cancel PO", description: "Cancels the whole PO. This can't be undone.", noteLabel: "Reason", noteRequired: true, danger: true },
};

function ActionDialog({ po, action, onClose, privileged }: { po: PoDetail; action: Action | null; onClose: () => void; privileged: boolean }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: latest } = useLatestRate(po.currency);
  if (!action) return null;
  const spec = ACTIONS[action];
  const foreign = po.currency !== HOME_CURRENCY;

  const run = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { note: note.trim() || null };
      if (action === "submit" && rate.trim()) body.exchangeRate = Number(rate);
      await apiRequest("POST", `/api/purchase-orders/${encodeURIComponent(po.id)}/${action}`, body);
      invalidatePurchasing(po.id);
      toast({ title: `${po.id}: ${spec.button.toLowerCase()} done` });
      setNote(""); setRate("");
      onClose();
    } catch (err) {
      toast({ title: `Couldn't ${spec.button.toLowerCase()}`, description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{spec.title}: {po.id}</DialogTitle>
          <DialogDescription>{spec.description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between"><span>{po.vendor}</span><CurrencyTag currency={po.currency} /></div>
          <MoneyPair className="mt-1" amount={po.total} currency={po.currency}
            homeAmount={action === "submit" && foreign ? (latest?.rate ? Number(po.total) * latest.rate : null) : po.totalHome}
            rate={action === "submit" ? latest?.rate : po.exchangeRate} rateDate={action === "submit" ? latest?.rateDate : po.rateDate}
            rateSource={action === "submit" ? (latest ? "ECB today" : null) : po.rateSource} />
        </div>
        {action === "submit" && foreign && privileged && (
          <div className="space-y-2">
            <Label>Exchange rate override (optional, Manager/Admin)</Label>
            <Input inputMode="decimal" placeholder={latest?.rate ? `ECB: ${latest.rate.toFixed(6)}` : "e.g. 0.857300"} value={rate} onChange={(e) => setRate(e.target.value)} />
            <p className="text-xs text-muted-foreground">{HOME_CURRENCY} per 1 {po.currency}. Leave blank to use the latest ECB rate.</p>
          </div>
        )}
        {spec.noteLabel && (
          <div className="space-y-2">
            <Label>{spec.noteLabel}</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} data-testid="input-po-action-note" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Back</Button>
          <Button variant={spec.danger ? "destructive" : "default"} onClick={run} disabled={busy || (spec.noteRequired && !note.trim())} data-testid="button-po-action-confirm">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}{spec.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ po, open, onClose, privileged }: { po: PoDetail; open: boolean; onClose: () => void; privileged: boolean }) {
  const { toast } = useToast();
  const outstanding = po.lines.filter((l) => l.outstanding > 0);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [deliveryNote, setDeliveryNote] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: latest } = useLatestRate(po.currency);
  const foreign = po.currency !== HOME_CURRENCY;

  const value = (lineId: number, fallback: number) => qty[lineId] ?? String(fallback);
  const receive = async () => {
    const lines = outstanding
      .map((l) => ({ lineId: l.id, quantity: parseInt(value(l.id, l.outstanding), 10) || 0 }))
      .filter((l) => l.quantity > 0);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { deliveryNote: deliveryNote.trim() || null, lines };
      if (rate.trim()) body.exchangeRate = Number(rate);
      await apiRequest("POST", `/api/purchase-orders/${encodeURIComponent(po.id)}/receipts`, body);
      invalidatePurchasing(po.id);
      toast({ title: "Goods received", description: "Stock parts have been booked into stock." });
      setQty({}); setDeliveryNote(""); setRate("");
      onClose();
    } catch (err) {
      toast({ title: "Couldn't receive goods", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive goods: {po.id}</DialogTitle>
          <DialogDescription>
            Enter what arrived in this delivery; set a line to 0 if it didn't come. Stock parts go into stock at the PO price
            {foreign ? `, converted to ${HOME_CURRENCY} at today's rate` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received so far</TableHead>
                <TableHead className="text-right w-28">Receiving now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{l.lineNo}. {l.description}</div>
                    <div className="text-xs text-muted-foreground">{l.partId ? `Stock part ${l.partId}` : "Non-stock item"} · {formatMoney(l.unitPrice, po.currency)} each</div>
                  </TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">{l.quantityReceived}</TableCell>
                  <TableCell>
                    <Input className="h-8 text-right" type="number" min={0} max={l.outstanding} value={value(l.id, l.outstanding)}
                      onChange={(e) => setQty((x) => ({ ...x, [l.id]: e.target.value }))} data-testid={`input-receive-${l.lineNo}`} />
                    <div className="text-[11px] text-muted-foreground text-right mt-0.5">max {l.outstanding}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Delivery note / reference</Label>
            <Input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} maxLength={200} data-testid="input-delivery-note" />
          </div>
          {foreign && (
            <div className="space-y-2">
              <Label>Rate for this delivery</Label>
              {privileged ? (
                <Input inputMode="decimal" placeholder={latest?.rate ? `ECB: ${latest.rate.toFixed(6)}` : "Enter rate"} value={rate} onChange={(e) => setRate(e.target.value)} />
              ) : (
                <p className="text-sm">{latest?.rate ? `1 ${po.currency} = ${formatMoney(latest.rate, HOME_CURRENCY, 4)} (ECB ${formatDate(latest.rateDate)})` : "No ECB rate yet: ask a Manager to receive this delivery."}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={receive} disabled={busy} data-testid="button-confirm-receive">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Book in delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseOrderPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const [, navigate] = useLocation();
  const { data: me } = useCurrentUser();
  const { data: po, isLoading, error } = useQuery<PoDetail>({ queryKey: ["/api/purchase-orders", id] });
  const [action, setAction] = useState<Action | null>(null);
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);

  if (isLoading) return <Layout><div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (error || !po) return <Layout><p className="py-20 text-center text-muted-foreground">Purchase order {id} not found.</p></Layout>;

  const privileged = !!me && (PRIVILEGED_ROLES as string[]).includes(me.role);
  const isCreator = !!me && po.createdById === me.id;
  const canManage = privileged || isCreator;
  const limit = (me as any)?.poApprovalLimit as string | null | undefined;
  const approveBlock = !me ? "" : isCreator ? "You raised this PO, so someone else must approve it."
    : limit === null || limit === undefined ? "You don't have PO approval rights."
    : po.totalHome !== null && Number(po.totalHome) > Number(limit) ? `Above your approval limit of ${formatMoney(limit, HOME_CURRENCY)}.` : "";
  const nothingReceived = po.lines.every((l) => l.quantityReceived === 0);
  const foreign = po.currency !== HOME_CURRENCY;

  const buttons: { key: string; show: boolean; node: JSX.Element }[] = [
    { key: "edit", show: canManage && ["Draft", "Rejected"].includes(po.status), node: <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 size-4" />Edit</Button> },
    { key: "submit", show: canManage && ["Draft", "Rejected"].includes(po.status), node: <Button onClick={() => setAction("submit")} data-testid="button-po-submit"><Send className="mr-2 size-4" />Submit for approval</Button> },
    { key: "withdraw", show: canManage && po.status === "Pending Approval", node: <Button variant="outline" onClick={() => setAction("withdraw")}><Undo2 className="mr-2 size-4" />Withdraw</Button> },
    { key: "approve", show: po.status === "Pending Approval" && !approveBlock, node: <Button onClick={() => setAction("approve")} data-testid="button-po-approve"><CheckCircle2 className="mr-2 size-4" />Approve</Button> },
    { key: "reject", show: po.status === "Pending Approval" && !approveBlock, node: <Button variant="outline" onClick={() => setAction("reject")}><XCircle className="mr-2 size-4" />Reject</Button> },
    { key: "send", show: canManage && po.status === "Approved", node: <Button onClick={() => setAction("send")} data-testid="button-po-send"><Send className="mr-2 size-4" />Mark as sent</Button> },
    { key: "recall", show: (canManage || po.approvedById === me?.id) && po.status === "Approved", node: <Button variant="outline" onClick={() => setAction("recall")}><Undo2 className="mr-2 size-4" />Recall</Button> },
    { key: "receive", show: ["Sent", "Partially Received"].includes(po.status), node: <Button onClick={() => setReceiving(true)} data-testid="button-po-receive"><PackageCheck className="mr-2 size-4" />Receive goods</Button> },
    { key: "close", show: privileged && po.status === "Partially Received", node: <Button variant="outline" onClick={() => setAction("close")}><Lock className="mr-2 size-4" />Close short</Button> },
    { key: "cancel", show: canManage && ["Draft", "Pending Approval", "Approved", "Rejected", "Sent"].includes(po.status) && nothingReceived, node: <Button variant="ghost" className="text-destructive" onClick={() => setAction("cancel")}><Ban className="mr-2 size-4" />Cancel PO</Button> },
  ];

  return (
    <Layout>
      <Link href="/purchase-orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-1 size-4" /> Purchase orders
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono" data-testid="text-po-id">{po.id}</h1>
            <PoStatusBadge status={po.status} />
            <CurrencyTag currency={po.currency} className="text-sm" />
          </div>
          <p className="text-muted-foreground mt-1">{po.vendor}{po.jobId ? <> · for job <span className="font-mono">{po.jobId}</span></> : null}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {buttons.filter((b) => b.show).map((b) => <span key={b.key}>{b.node}</span>)}
          <Button variant="outline" onClick={() => window.open(`/purchase-orders/${encodeURIComponent(po.id)}/print`, "_blank", "noopener")}>
            <Printer className="mr-2 size-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {po.status === "Pending Approval" && approveBlock && (
        <p className="mb-4 text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
          Awaiting approval by someone with a limit of at least {formatMoney(po.totalHome, HOME_CURRENCY)}. {approveBlock}
        </p>
      )}
      {po.status === "Rejected" && po.rejectionReason && (
        <p className="mb-4 text-sm rounded-md border border-red-200 bg-red-50 text-red-900 px-3 py-2">Rejected: {po.rejectionReason}</p>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total (ex-VAT)</p>
          <MoneyPair className="text-lg" amount={po.total} currency={po.currency} homeAmount={po.totalHome} rate={po.exchangeRate} rateDate={po.rateDate} rateSource={po.rateSource} />
          {foreign && !po.totalHome && <p className="text-xs text-muted-foreground mt-1">GBP value fixed on submission.</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4 text-sm space-y-1">
          <p className="text-xs text-muted-foreground">Raised</p>
          <p>{po.createdByName ?? po.requestedBy ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(po.createdAt)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-sm space-y-1">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p>{po.approvedByName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{po.approvedAt ? formatDateTime(po.approvedAt) : ""}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-sm space-y-1">
          <p className="text-xs text-muted-foreground">Sent / expected</p>
          <p>{po.sentAt ? `Sent ${formatDate(po.sentAt)}` : "Not sent"}</p>
          <p className="text-xs text-muted-foreground">Expected {formatDate(po.expectedDate)}</p>
        </CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Lines</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead>Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineNo}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{l.description}</div>
                    <div className="text-xs text-muted-foreground">{l.partId ? <span className="font-mono">{l.partId}</span> : "Non-stock item"}</div>
                  </TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMoney(l.unitPrice, po.currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMoney(l.quantity * Number(l.unitPrice), po.currency)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("whitespace-nowrap",
                      l.deliveryStatus === "Received" && "bg-green-50 text-green-700 border-green-200",
                      l.deliveryStatus === "Part received" && "bg-teal-50 text-teal-700 border-teal-200",
                      (l.deliveryStatus === "Cancelled" || l.deliveryStatus === "Closed short") && "bg-zinc-100 text-zinc-600")}>
                      {l.deliveryStatus}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.quantityReceived} of {l.quantity} received{l.quantityCancelled ? ` · ${l.quantityCancelled} cancelled` : ""}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {po.lines.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No lines (this PO was created before order lines existed).</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Inbox className="size-4" /> Goods receipts</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {po.receipts.length === 0 ? <p className="text-muted-foreground">Nothing received yet.</p> : po.receipts.map((r) => (
              <div key={r.id} className="border rounded-md p-3">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{formatDateTime(r.receivedAt)}</span>
                  <span className="text-muted-foreground">{r.receivedBy}</span>
                </div>
                {r.deliveryNote && <div className="text-xs">Delivery note: {r.deliveryNote}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {r.lines.map((rl) => {
                    const line = po.lines.find((l) => l.id === rl.poLineId);
                    return `Line ${line?.lineNo ?? "?"}: ${rl.quantity}`;
                  }).join(" · ")}
                </div>
                {foreign && (
                  <div className="text-xs text-muted-foreground">Valued at 1 {po.currency} = {formatMoney(r.exchangeRate, HOME_CURRENCY, 4)} ({r.rateSource}{r.rateDate ? ` ${formatDate(r.rateDate)}` : ""})</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative border-l ml-2 space-y-3">
              {po.events.map((e) => (
                <li key={e.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" />
                  <div className="text-sm font-medium">{e.action}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(e.at)} · {e.userName ?? "—"}</div>
                  {e.note && <div className="text-xs mt-0.5 break-words">{e.note}</div>}
                </li>
              ))}
              {po.events.length === 0 && <li className="ml-4 text-sm text-muted-foreground">No history recorded.</li>}
            </ol>
          </CardContent>
        </Card>
      </div>

      {po.notes && (
        <Card className="mt-6"><CardContent className="p-4 text-sm whitespace-pre-wrap"><span className="text-xs text-muted-foreground block mb-1">Notes for the supplier</span>{po.notes}</CardContent></Card>
      )}

      <ActionDialog po={po} action={action} onClose={() => setAction(null)} privileged={privileged} />
      <ReceiveDialog po={po} open={receiving} onClose={() => setReceiving(false)} privileged={privileged} />
      <PoEditorDialog open={editing} onOpenChange={setEditing} po={po} onSaved={() => navigate(`/purchase-orders/${encodeURIComponent(po.id)}`)} />
    </Layout>
  );
}
