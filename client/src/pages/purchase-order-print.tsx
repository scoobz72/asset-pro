import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/Logo";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSuppliers } from "@/hooks/use-data";
import { HOME_CURRENCY, currencySymbol, formatMoney } from "@shared/constants";
import { formatDate, type PoDetail } from "@/components/po";

/** A4 portrait purchase order for printing or saving as PDF to send to the supplier. */
export default function PurchaseOrderPrint() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const { data: po, isLoading } = useQuery<PoDetail>({ queryKey: ["/api/purchase-orders", id] });
  const { data: me } = useCurrentUser();
  const { data: suppliersData = [] } = useSuppliers();
  const supplier = (suppliersData as any[]).find((s) => s.id === po?.supplierId);

  useEffect(() => {
    if (po) document.title = `${po.id} – ${po.vendor}`;
  }, [po]);

  if (isLoading || !po) {
    return <div className="flex justify-center py-20">{isLoading ? <Loader2 className="size-8 animate-spin" /> : `Purchase order ${id} not found.`}</div>;
  }
  const draft = ["Draft", "Pending Approval", "Rejected"].includes(po.status);

  return (
    <div className="po-print bg-white text-black min-h-screen">
      <div className="print:hidden sticky top-0 bg-muted border-b px-6 py-3 flex items-center justify-between">
        <span className="text-sm">Print, or choose "Save as PDF" as the printer, to send this PO to the supplier.</span>
        <Button onClick={() => window.print()}><Printer className="mr-2 size-4" /> Print / Save as PDF</Button>
      </div>

      <div className="mx-auto max-w-[190mm] p-8 print:p-0 text-[12px] leading-snug">
        {draft && (
          <div className="mb-4 border-2 border-red-500 text-red-600 text-center font-bold py-1 uppercase tracking-widest">
            {po.status}: not an authorised order
          </div>
        )}
        <div className="flex items-start justify-between border-b-2 border-[#102A45] pb-4 mb-4">
          <div>
            <LogoFull className="text-2xl" />
            <div className="mt-2 font-semibold">{me?.companyName ?? ""}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">PURCHASE ORDER</div>
            <div className="text-lg font-mono font-semibold">{po.id}</div>
            <div>Date: {formatDate(po.sentAt ?? po.approvedAt ?? po.createdAt ?? po.date)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Supplier</div>
            <div className="font-semibold">{po.vendor}</div>
            {supplier?.contactName && <div>{supplier.contactName}</div>}
            {supplier?.email && <div>{supplier.email}</div>}
            {supplier?.phone && <div>{supplier.phone}</div>}
            {po.supplierId && <div className="text-gray-500">Account: {po.supplierId}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Order details</div>
            <div>Raised by: {po.createdByName ?? po.requestedBy ?? "—"}</div>
            {po.approvedByName && <div>Approved by: {po.approvedByName}</div>}
            {po.expectedDate && <div>Required by: {formatDate(po.expectedDate)}</div>}
            {po.jobId && <div>Job ref: {po.jobId}</div>}
          </div>
          <div className="border-2 border-[#102A45] rounded p-2 self-start">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Order currency</div>
            <div className="text-xl font-bold">{po.currency} ({currencySymbol(po.currency).trim()})</div>
            <div className="text-[10px] text-gray-500">All prices are in {po.currency}, excluding VAT.</div>
          </div>
        </div>

        <table className="w-full border-collapse mb-3">
          <thead>
            <tr className="bg-[#102A45] text-white">
              <th className="text-left p-1.5 w-8">#</th>
              <th className="text-left p-1.5">Description</th>
              <th className="text-left p-1.5 w-28">Our part no.</th>
              <th className="text-right p-1.5 w-12">Qty</th>
              <th className="text-right p-1.5 w-28">Unit price ({po.currency})</th>
              <th className="text-right p-1.5 w-28">Total ({po.currency})</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-300 break-inside-avoid">
                <td className="p-1.5 align-top">{l.lineNo}</td>
                <td className="p-1.5 align-top">{l.description}</td>
                <td className="p-1.5 align-top font-mono">{l.partId ?? "—"}</td>
                <td className="p-1.5 align-top text-right">{l.quantity}</td>
                <td className="p-1.5 align-top text-right">{formatMoney(l.unitPrice, po.currency)}</td>
                <td className="p-1.5 align-top text-right">{formatMoney(l.quantity * Number(l.unitPrice), po.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-72 border-t-2 border-[#102A45] pt-2 text-right">
            <div className="flex justify-between font-bold text-base"><span>Total (ex-VAT)</span><span>{formatMoney(po.total, po.currency)}</span></div>
            {po.currency !== HOME_CURRENCY && (
              <div className="text-[10px] text-gray-500 mt-1">Order placed in {po.currency}. Please invoice in {po.currency}.</div>
            )}
          </div>
        </div>

        {po.notes && (
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Notes</div>
            <div className="whitespace-pre-wrap">{po.notes}</div>
          </div>
        )}
        <div className="text-[10px] text-gray-500 border-t pt-2">
          Please quote <span className="font-mono font-semibold">{po.id}</span> on all delivery notes and invoices.
        </div>
      </div>
    </div>
  );
}
