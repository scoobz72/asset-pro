import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAssets, useUsers } from "@/hooks/use-data";
import { matchesSearch } from "@/lib/search";
import { JOB_PRIORITIES, JOB_TYPES, URGENCY_PRIORITY } from "@shared/constants";
import { cn } from "@/lib/utils";
import { Btn, Card, Chip, Empty, Field, Icon, Screen, Segments, Sheet, Spinner, TopBar, enc, fmtDate, inputCls, post, refreshMobile, textareaCls, useRun } from "./ui";
import { useAssetSummary } from "./Asset";

const LEAD_ROLES = ["Lead", "Manager", "Admin", "PlatformAdmin"];
type Req = { id: string; title: string; assetId: string | null; area: string | null; urgency: string; description: string | null; requestedBy: string; status: string; createdAt: string | null; jobId: string | null; rejectionReason: string | null };

/* --------------------------------------------------------------- report a fault */

export function ReportFault() {
  const params = new URLSearchParams(useSearch());
  const [, navigate] = useLocation();
  const { data: me } = useCurrentUser();
  const { data: assets = [] } = useAssets();
  const [assetId, setAssetId] = useState(params.get("asset") ?? "");
  const { data: asset } = useAssetSummary(assetId);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High">("Medium");
  const [stopped, setStopped] = useState(false);
  const [area, setArea] = useState("");
  const [detail, setDetail] = useState("");
  const { busy, run } = useRun();
  useEffect(() => { if (stopped) setUrgency("High"); }, [stopped]);
  useEffect(() => { if (asset?.locationName && !area) setArea(asset.locationName); }, [asset?.locationName]); // eslint-disable-line react-hooks/exhaustive-deps

  const found = useMemo(() => (assets as any[]).filter((a) => matchesSearch(q, a.id, a.name, a.serialNumber, a.locationId)).slice(0, 30), [assets, q]);

  const send = async () => {
    const description = [stopped ? "LINE STOPPED: production can't run until this is fixed." : null, detail.trim() || null].filter(Boolean).join("\n\n") || null;
    const r = await run(() => post("/api/maintenance-requests", {
      title: title.trim(), assetId: assetId || null, area: area.trim() || null, urgency, description, requestedBy: me?.name ?? null,
    }));
    if (r) { refreshMobile(); navigate(`/m/requests?sent=${enc(r.id ?? "")}`); }
  };

  return (
    <Screen tabs={false} header={<TopBar title="Report a fault" sub="Goes to the Request Portal for triage" back="/m" />}
      footer={<Btn variant="amber" className="w-full h-[52px] text-base font-bold" disabled={busy || !title.trim()} onClick={send}><Icon name="send" /> Send request</Btn>}>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Asset</span>
          <div className="bg-white border border-[#C7D3E0] rounded-xl px-3 py-2.5 flex items-center gap-2.5 min-h-14">
            {assetId ? (
              <>
                <span className="size-9 rounded-lg bg-[#DCFCE7] text-[#166534] flex items-center justify-center"><Icon name="check" strokeWidth={2.4} /></span>
                <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{asset?.name ?? assetId}</span><span className="text-xs text-[#4B5E73]">{[assetId, asset?.locationName].filter(Boolean).join(" · ")}</span></span>
              </>
            ) : <span className="flex-1 text-[#4B5E73]">No asset (general fault)</span>}
            <button type="button" onClick={() => setPicking(true)} className="min-h-11 px-2 font-semibold text-[#1D4ED8]">{assetId ? "Change" : "Choose"}</button>
          </div>
          {asset && asset.openJobs.length > 0 && (
            <p className="text-xs text-[#78350F] bg-[#FEF3C7] rounded-lg px-3 py-2">
              {asset.openJobs.length} open job{asset.openJobs.length === 1 ? "" : "s"} already on this asset: {asset.openJobs.slice(0, 2).map((j) => <Link key={j.id} href={`/m/job/${enc(j.id)}`} className="underline mr-1">{j.title}</Link>)}
            </p>
          )}
        </div>

        <Field label="What's wrong?"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Film tearing at the sealing station" /></Field>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-semibold mb-1.5">How urgent?</legend>
          <div className="grid grid-cols-3 gap-2">
            {([["Low", "When convenient"], ["Medium", "This shift"], ["High", "Now"]] as const).map(([u, help]) => (
              <button key={u} type="button" aria-pressed={urgency === u} onClick={() => setUrgency(u)}
                className={cn("min-h-16 rounded-xl border-2 flex flex-col items-center justify-center", urgency === u ? "border-[#102A45] bg-white" : "border-[#E5EAF0] bg-[#F9FAFB]")}>
                <span className="font-bold">{u}</span><span className="text-[11px] text-[#4B5E73]">{help}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-14">
          <span><span className="block font-semibold">Line stopped</span><span className="text-xs text-[#4B5E73]">Production can't run until it's fixed</span></span>
          <input type="checkbox" checked={stopped} onChange={(e) => setStopped(e.target.checked)} className="size-6 accent-[#102A45]" />
        </label>

        <Field label="Area"><input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} maxLength={200} placeholder="e.g. LINE 9, packing hall" /></Field>
        <Field label="More detail (optional)" hint="Tip: tap the microphone on your keyboard to dictate.">
          <textarea className={textareaCls} rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={3800} placeholder="When did it start? Any alarms or codes?" />
        </Field>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose asset">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input className={inputCls} autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID or serial" />
            <Link href="/m/scan" aria-label="Scan asset tag" className="size-12 shrink-0 rounded-xl bg-[#102A45] text-[#F59E0B] flex items-center justify-center"><Icon name="scan" /></Link>
          </div>
          <button type="button" onClick={() => { setAssetId(""); setPicking(false); }} className="text-left min-h-12 px-3 rounded-xl bg-[#F4F6F9] text-sm">No asset (general fault)</button>
          {found.map((a) => (
            <button key={a.id} type="button" onClick={() => { setAssetId(a.id); setArea(""); setPicking(false); }} className="text-left min-h-12 px-3 py-2 rounded-xl bg-[#F4F6F9]">
              <span className="block font-semibold text-sm">{a.name}</span><span className="text-xs text-[#4B5E73] font-mono">{a.id}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

/* --------------------------------------------------------------- requests list + triage */

export function RequestsList() {
  const sent = new URLSearchParams(useSearch()).get("sent");
  const { data: me } = useCurrentUser();
  const lead = !!me && LEAD_ROLES.includes(me.role);
  const { data: requests = [], isLoading } = useQuery<Req[]>({ queryKey: ["/api/maintenance-requests"], refetchOnWindowFocus: true, refetchInterval: 60_000, staleTime: 20_000 });
  const { data: users = [] } = useUsers();
  const [view, setView] = useState<"triage" | "mine" | "done">(lead ? "triage" : "mine");
  const [converting, setConverting] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [form, setForm] = useState({ type: "Request", priority: "Medium", assigneeId: "", dueDate: "", note: "" });
  const [reason, setReason] = useState("");
  const { busy, run } = useRun();

  const sorted = [...requests].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const mine = sorted.filter((r) => me && (r.requestedBy ?? "").toLowerCase() === me.name.toLowerCase());
  const shown = view === "triage" ? sorted.filter((r) => r.status === "Submitted") : view === "mine" ? mine : sorted.filter((r) => r.status !== "Submitted").slice(0, 50);

  const openConvert = (r: Req) => { setConverting(r); setForm({ type: "Request", priority: URGENCY_PRIORITY[r.urgency] ?? "Medium", assigneeId: "", dueDate: "", note: "" }); };
  const convert = async () => {
    if (!converting) return;
    const ok = await run(() => post(`/api/maintenance-requests/${enc(converting.id)}/convert`, {
      type: form.type, priority: form.priority, assigneeId: form.assigneeId ? Number(form.assigneeId) : null, dueDate: form.dueDate || null, note: form.note.trim() || null,
    }), `${converting.id} turned into a job`);
    if (ok !== undefined) { setConverting(null); refreshMobile(); }
  };
  const reject = async () => {
    if (!rejecting) return;
    const ok = await run(() => post(`/api/maintenance-requests/${enc(rejecting.id)}/reject`, { reason: reason.trim() }), `${rejecting.id} rejected`);
    if (ok !== undefined) { setRejecting(null); setReason(""); refreshMobile(); }
  };

  return (
    <Screen header={<TopBar title="Requests" sub={lead ? "Faults reported by the site" : "Faults you've reported"} right={<Link href="/m/report" aria-label="Report a fault" className="size-11 flex items-center justify-center"><Icon name="plus" className="size-6" /></Link>} />}>
      <div className="p-4 flex flex-col gap-2.5">
        {sent && <p className="rounded-xl bg-[#DCFCE7] text-[#166534] text-sm px-3 py-2.5" role="status">Sent{sent ? ` as ${sent}` : ""}. A Lead or Manager will triage it.</p>}
        <Segments value={view} onChange={setView} options={[
          ...(lead ? [{ value: "triage" as const, label: `To triage ${sorted.filter((r) => r.status === "Submitted").length}` }] : []),
          { value: "mine" as const, label: `Mine ${mine.length}` },
          { value: "done" as const, label: "Handled" },
        ]} />
        <Link href="/m/report" className="min-h-14 rounded-2xl bg-[#F59E0B] text-[#102A45] font-bold flex items-center justify-center gap-2"><Icon name="alert" /> Report a fault</Link>
        {isLoading ? <Spinner /> : shown.length === 0 ? <Empty icon="inbox" title={view === "triage" ? "Nothing waiting for triage" : "No requests"} /> : shown.map((r) => (
          <Card key={r.id} className="flex flex-col gap-1.5 py-3.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[#4B5E73]">{r.id}</span>
              <Chip tone={r.urgency === "High" ? "red" : r.urgency === "Medium" ? "amber" : "grey"}>{r.urgency}</Chip>
              <span className="ml-auto text-[#4B5E73]">{fmtDate(r.createdAt)}</span>
            </div>
            <p className="font-semibold leading-snug">{r.title}</p>
            <p className="text-[13px] text-[#4B5E73]">{[r.assetId, r.area, r.requestedBy && `by ${r.requestedBy}`].filter(Boolean).join(" · ")}</p>
            {r.description && <p className="text-sm whitespace-pre-wrap line-clamp-4">{r.description}</p>}
            {r.status === "Converted" && r.jobId && <Link href={`/m/job/${enc(r.jobId)}`} className="text-sm font-semibold text-[#1D4ED8]">Job {r.jobId} →</Link>}
            {r.status === "Rejected" && <p className="text-sm text-[#9B1C1C]">Rejected{r.rejectionReason ? `: ${r.rejectionReason}` : ""}</p>}
            {r.status === "Submitted" && lead && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Btn variant="outline" onClick={() => { setRejecting(r); setReason(""); }}>Reject</Btn>
                <Btn onClick={() => openConvert(r)}>Make job</Btn>
              </div>
            )}
            {r.status === "Submitted" && !lead && <p className="text-xs text-[#4B5E73]">Waiting for triage</p>}
          </Card>
        ))}
      </div>

      <Sheet open={!!converting} onClose={() => setConverting(null)} title={`Make a job from ${converting?.id ?? ""}`}>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Priority"><select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{JOB_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          </div>
          <Field label="Assign to">
            <select className={inputCls} value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">Unassigned</option>
              {(users as any[]).map((u) => <option key={u.id} value={u.id}>{u.name}{me && u.id === me.id ? " (me)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Due date (optional)"><input className={inputCls} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Note for the engineer (optional)"><textarea className={textareaCls} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <Btn className="h-12" disabled={busy} onClick={convert}>Create job</Btn>
        </div>
      </Sheet>

      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.id ?? ""}`}>
        <div className="flex flex-col gap-3.5">
          <Field label="Reason (the requester sees this)"><textarea className={textareaCls} rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate of REQ-00031, already being fixed" /></Field>
          <Btn variant="danger" className="h-12" disabled={busy || !reason.trim()} onClick={reject}>Reject request</Btn>
        </div>
      </Sheet>
    </Screen>
  );
}
