import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocations } from "@/hooks/use-data";
import { Btn, Card, Chip, Empty, Field, Icon, Screen, Sheet, Spinner, TopBar, enc, inputCls, patch, priorityTone, refreshMobile, statusTone, textareaCls, useRun } from "./ui";

export type AssetSummary = {
  id: string; name: string; status: string; criticality: string | null; category: string | null;
  manufacturer: string | null; model: string | null; serialNumber: string | null; locationId: string | null; locationName: string | null;
  openJobs: { id: string; title: string; status: string; priority: string }[];
  audit: { id: string; expectedLocation: string | null; scheduledDate: string | null } | null;
};

export function useAssetSummary(id: string) {
  return useQuery<AssetSummary | null>({
    queryKey: ["/api/lookup", "asset", id],
    queryFn: async () => {
      const r = await fetch(`/api/lookup?code=${enc(id)}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      return (data.assets as AssetSummary[]).find((a) => a.id.toLowerCase() === id.toLowerCase()) ?? null;
    },
    refetchOnWindowFocus: true,
    enabled: !!id,
  });
}

/** Confirm (or flag) an asset's location for an open audit. */
export function AuditConfirm({ audit, assetId, onDone }: { audit: NonNullable<AssetSummary["audit"]>; assetId: string; onDone?: () => void }) {
  const { data: locations = [] } = useLocations();
  const { busy, run } = useRun();
  const [moved, setMoved] = useState(false);
  const [where, setWhere] = useState("");
  const [notes, setNotes] = useState("");
  const submit = async (found: boolean) => {
    const ok = await run(() => patch(`/api/audits/${enc(audit.id)}`, {
      status: found ? "Completed" : "Discrepancy",
      verifiedLocation: found ? audit.expectedLocation : where,
      completionDate: new Date().toISOString(),
      notes: notes.trim() || undefined,
    }), found ? `${assetId} confirmed` : "Discrepancy recorded");
    if (ok !== undefined) { setMoved(false); refreshMobile("/api/lookup"); onDone?.(); }
  };
  return (
    <Card className="border-2 border-[#F59E0B] flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold text-[#78350F]">Audit {audit.id}</p>
        <p className="font-semibold">Should be at: {audit.expectedLocation ?? "not recorded"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn disabled={busy} onClick={() => submit(true)}><Icon name="check" className="text-[#F59E0B]" strokeWidth={2.6} /> It's here</Btn>
        <Btn variant="outline" disabled={busy} onClick={() => setMoved(true)}>Not here</Btn>
      </div>
      <Sheet open={moved} onClose={() => setMoved(false)} title="Where is it?">
        <div className="flex flex-col gap-4">
          <Field label="Location found">
            <select className={inputCls} value={where} onChange={(e) => setWhere(e.target.value)}>
              <option value="">Choose…</option>
              {(locations as any[]).map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              <option value="Missing">Not found anywhere</option>
            </select>
          </Field>
          <Field label="Notes (optional)"><textarea className={textareaCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Btn className="h-12" disabled={busy || !where} onClick={() => submit(false)}>Record discrepancy</Btn>
        </div>
      </Sheet>
    </Card>
  );
}

export default function MobileAsset() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw ?? "");
  const { data: asset, isLoading } = useAssetSummary(id);
  const { data: common = [] } = useQuery<{ id: string; name: string; stock: number; unit: string; timesUsed: number }[]>({ queryKey: ["/api/assets", enc(id), "common-parts"], enabled: !!asset });

  if (isLoading) return <Screen header={<TopBar title="Asset" back="/m" />}><Spinner /></Screen>;
  if (!asset) return <Screen header={<TopBar title="Asset" back="/m" />}><Empty icon="search" title={`No asset ${id}`}>Check the tag, or try typing the code on the Scan screen.</Empty></Screen>;

  const facts = [
    ["Location", asset.locationName ?? asset.locationId], ["Category", asset.category], ["Make", asset.manufacturer],
    ["Model", asset.model], ["Serial", asset.serialNumber],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <Screen header={<TopBar title={asset.name} sub={asset.id} back="/m" right={<Link href={`/assets?q=${enc(asset.id)}`} aria-label="Open on full site" className="size-11 flex items-center justify-center"><Icon name="desktop" /></Link>} />}>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={asset.status === "Operational" ? "green" : asset.status === "Down" ? "red" : "amber"}>{asset.status}</Chip>
          {asset.criticality && <Chip tone={asset.criticality === "Critical" || asset.criticality === "High" ? "red" : "grey"}>{asset.criticality} criticality</Chip>}
        </div>

        {asset.audit && <AuditConfirm audit={asset.audit} assetId={asset.id} />}

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/m/report?asset=${enc(asset.id)}`} className="min-h-16 rounded-2xl bg-white flex flex-col items-center justify-center gap-1 text-sm font-semibold"><Icon name="alert" className="text-[#B45309]" /> Report fault</Link>
          <Link href={`/m/stock?asset=${enc(asset.id)}`} className="min-h-16 rounded-2xl bg-white flex flex-col items-center justify-center gap-1 text-sm font-semibold"><Icon name="box" className="text-[#1D4ED8]" /> Find parts</Link>
        </div>

        <Card className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">Open jobs ({asset.openJobs.length})</h2>
          {asset.openJobs.length === 0 ? <p className="text-sm text-[#4B5E73]">No open jobs on this asset.</p> : asset.openJobs.map((j) => (
            <Link key={j.id} href={`/m/job/${enc(j.id)}`} className="flex items-center justify-between gap-2 border-t border-[#E5EAF0] pt-2 min-h-11">
              <span className="min-w-0"><span className="block text-sm font-semibold truncate">{j.title}</span><span className="font-mono text-xs text-[#4B5E73]">{j.id}</span></span>
              <span className="flex flex-col items-end gap-1"><Chip tone={statusTone(j.status)}>{j.status}</Chip><Chip tone={priorityTone(j.priority)}>{j.priority}</Chip></span>
            </Link>
          ))}
        </Card>

        {common.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">Parts often fitted</h2>
            {common.map((p) => (
              <Link key={p.id} href={`/m/part/${enc(p.id)}`} className="flex justify-between gap-2 text-sm border-t border-[#E5EAF0] pt-2 min-h-11">
                <span className="min-w-0"><span className="block font-semibold truncate">{p.name}</span><span className="text-xs text-[#4B5E73]">Used {p.timesUsed}×</span></span>
                <span className={p.stock <= 0 ? "text-red-700 font-semibold" : ""}>{p.stock} {p.unit}</span>
              </Link>
            ))}
          </Card>
        )}

        <Card>
          <h2 className="text-[15px] font-bold mb-2">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {facts.map(([k, v]) => <div key={k} className="contents"><dt className="text-[#4B5E73]">{k}</dt><dd className="font-medium break-words">{v}</dd></div>)}
          </dl>
        </Card>
      </div>
    </Screen>
  );
}
