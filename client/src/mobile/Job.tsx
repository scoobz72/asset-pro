import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-auth";
import { HOME_CURRENCY, formatMoney } from "@shared/constants";
import { cn } from "@/lib/utils";
import {
  Btn, Card, Chip, Field, Icon, Screen, Sheet, Spinner, TopBar, enc, fmtClock, fmtDate, inputCls, patch, post,
  priorityTone, refreshMobile, statusTone, textareaCls, ukToday, useRun, useTimer, useTimerSeconds,
} from "./ui";

type JobRecord = {
  id: string; title: string; description: string | null; assetId: string | null; assetName: string | null; status: string;
  priority: string; type: string | null; assigneeId: number | null; assigneeName: string | null; dueDate: string | null; createdAt: string;
  labour: { id: number; userId: number; userName: string | null; workDate: string; hours: number; note: string | null; canDelete: boolean }[];
  notes: { id: number; kind: string; text: string; userName: string | null; createdAt: string; followUpJobId: string | null }[];
  parts: { id: string; partId: string; partName: string | null; type: string; quantity: number; value: string | null }[];
  purchaseOrders: { id: string; vendor: string; status: string; currency: string; total: string }[];
  totals: { hours: number; labourCost: number | null; partsCost: number };
};

const fmt = (n: number) => formatMoney(n, HOME_CURRENCY).replace(` ${HOME_CURRENCY}`, "");

export default function MobileJob() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw ?? "");
  const [, navigate] = useLocation();
  const { data: me } = useCurrentUser();
  const key = ["/api/jobs", enc(id), "record"];
  const { data: job, isLoading, error } = useQuery<JobRecord>({ queryKey: key, refetchOnWindowFocus: true });
  const { data: timer } = useTimer();
  const seconds = useTimerSeconds(timer ?? null);
  const { busy, run } = useRun();
  const [sheet, setSheet] = useState<null | "hours" | "complete" | "stop" | "note">(null);
  const [hours, setHours] = useState("1");
  const [workDate, setWorkDate] = useState(ukToday());
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<"Note" | "Follow-up">("Note");

  const parts = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; value: number }>();
    for (const t of job?.parts ?? []) {
      if (t.type === "Purchase Order") continue;
      const cur = m.get(t.partId) ?? { name: t.partName ?? t.partId, qty: 0, value: 0 };
      cur.qty -= t.quantity; cur.value -= Number(t.value ?? 0);
      m.set(t.partId, cur);
    }
    return Array.from(m, ([partId, p]) => ({ partId, ...p })).filter((p) => p.qty !== 0);
  }, [job?.parts]);

  if (isLoading) return <Screen header={<TopBar title="Job" back="/m" dark />}><Spinner /></Screen>;
  if (error || !job) return <Screen header={<TopBar title="Job" back="/m" dark />}><p className="p-8 text-center">Job {id} not found.</p></Screen>;

  const here = timer?.jobId === job.id;
  const bookH = Math.min(24, Math.max(0.25, Math.round(seconds / 900) / 4));
  const elsewhere = !!timer && !here;
  const done = job.status === "Completed";
  const refresh = () => refreshMobile();
  const base = `/api/jobs/${enc(job.id)}`;

  const start = () => run(() => post(`${base}/timer/start`), here ? "Timer resumed" : "Timer started").then(refresh);
  const pause = () => run(() => post("/api/me/timer/pause"), "Timer paused").then(refresh);
  const stop = async (book: boolean) => {
    const r = await run(() => post("/api/me/timer/stop", { book, note: note.trim() || null }));
    if (r !== undefined) { setSheet(null); setNote(""); refresh(); }
    return r;
  };
  const addHours = async (h: number, date = ukToday()) => {
    const ok = await run(() => post(`${base}/labour`, { workDate: date, hours: h, note: null }), `${h} h booked`);
    if (ok !== undefined) { setSheet(null); refresh(); }
  };
  const addNote = async () => {
    const ok = await run(() => post(`${base}/notes`, { kind: noteKind, text: note.trim() }), noteKind === "Note" ? "Note added" : "Follow-up recommended");
    if (ok !== undefined) { setNote(""); setSheet(null); refresh(); }
  };
  const setStatus = (status: string, msg: string) => run(() => patch(base, { status }), msg).then(refresh);
  const complete = async () => {
    if (here) {
      const r = await run(() => post("/api/me/timer/stop", { book: true, note: null }));
      if (r === undefined) return;
    }
    if (note.trim()) {
      const n = await run(() => post(`${base}/notes`, { kind: "Note", text: note.trim() }));
      if (n === undefined) return;
    }
    const ok = await run(() => patch(base, { status: "Completed" }), "Job completed");
    if (ok !== undefined) { setNote(""); setSheet(null); refresh(); navigate("/m"); }
  };
  const returnOne = (partId: string) => run(() => post("/api/stock/movements", { partId, type: "Return to Stores", quantity: 1, jobId: job.id }), "Returned 1 to stores").then(refresh);
  const takeIt = () => me && run(() => patch(base, { assigneeId: me.id }), "Assigned to you").then(refresh);

  return (
    <Screen
      header={
        <div className="bg-[#102A45] text-white">
          <TopBar dark back="/m" title={<span className="font-mono text-sm font-medium text-[#C7D3E0]">{job.id}</span>}
            right={<Link href={`/jobs/${enc(job.id)}`} aria-label="Open on full site" className="size-11 flex items-center justify-center"><Icon name="desktop" /></Link>} />
          <div className="px-5 pb-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={job.type === "Planned" ? "blue" : priorityTone(job.priority)}>{job.type ?? "Job"} · {job.priority}</Chip>
              <Chip tone={statusTone(job.status)}>{job.status}</Chip>
              {job.dueDate && <Chip tone="grey">Due {fmtDate(job.dueDate)}</Chip>}
            </div>
            <h1 className="text-[21px] font-bold leading-tight">{job.title}</h1>
            {job.assetId && (
              <Link href={`/m/asset/${enc(job.assetId)}`} className="text-[13px] text-[#C7D3E0] underline-offset-2 underline">{job.assetName ?? job.assetId} · {job.assetId}</Link>
            )}
            <p className="text-xs text-[#C7D3E0]">{job.assigneeName ? `Assigned to ${job.assigneeName}` : "Unassigned"}</p>
          </div>
        </div>
      }
      footer={done ? (
        <Btn variant="outline" className="w-full h-[52px]" disabled={busy} onClick={() => setStatus("In Progress", "Job reopened")}>Reopen job</Btn>
      ) : (
        <div className="flex gap-2.5">
          {job.status !== "In Progress" && <Btn variant="outline" className="h-[52px]" disabled={busy} onClick={() => setStatus("In Progress", "Job started")}>Start</Btn>}
          <Btn className="flex-1 h-[52px] text-base" disabled={busy} onClick={() => setSheet("complete")}>
            <Icon name="check" className="text-[#F59E0B]" strokeWidth={2.8} /> Complete job
          </Btn>
        </div>
      )}
    >
      <div className="p-4 flex flex-col gap-3">
        {!job.assigneeId && me && !done && (
          <Card className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm">Nobody is assigned to this job.</span>
            <Btn variant="soft" disabled={busy} onClick={takeIt}>Take it</Btn>
          </Card>
        )}

        {!done && (
          <Card aria-label="Job timer" className="flex flex-col gap-3">
            {elsewhere ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Your timer is running on <Link href={`/m/job/${enc(timer!.jobId)}`} className="font-semibold underline">{timer!.jobId}</Link> ({fmtClock(seconds)}).</p>
                <p className="text-xs text-[#4B5E73]">Stop it there first so its time is booked to the right job.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#4B5E73]">{here ? (timer!.running ? "Timer running" : "Timer paused") : "Time this job"}</p>
                    <p className="font-mono text-[34px] font-medium tracking-tight leading-tight" aria-live="off">{fmtClock(here ? seconds : 0)}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={here && timer!.running ? pause : start}
                    aria-label={here && timer!.running ? "Pause timer" : "Start timer"}
                    className="size-16 rounded-full bg-[#F59E0B] text-[#102A45] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                    <Icon name={here && timer!.running ? "pause" : "play"} className="size-7" />
                  </button>
                </div>
                {here && <Btn variant="outline" disabled={busy} onClick={() => setSheet("stop")}>Stop and book {bookH} h</Btn>}
              </>
            )}
            <p className="text-xs text-[#4B5E73]">{here ? "Timed hours round to the nearest quarter hour." : "Or add time by hand:"}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.25, 0.5, 1].map((h) => (
                <Btn key={h} variant="soft" className="px-0 text-sm" disabled={busy} onClick={() => addHours(h)}>+{h < 1 ? `${h * 60} min` : "1 h"}</Btn>
              ))}
              <Btn variant="soft" className="px-0 text-sm" onClick={() => { setHours("1"); setWorkDate(ukToday()); setSheet("hours"); }}>Other</Btn>
            </div>
          </Card>
        )}

        {job.description && (
          <Card><h2 className="text-[15px] font-bold mb-1">Description</h2><p className="text-sm whitespace-pre-wrap">{job.description}</p></Card>
        )}

        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-bold">Time booked</h2><span className="font-semibold">{job.totals.hours} h</span></div>
          {job.labour.length === 0 ? <p className="text-sm text-[#4B5E73]">No time booked yet.</p> : job.labour.slice().reverse().map((l) => (
            <div key={l.id} className="flex justify-between gap-3 text-sm border-t border-[#E5EAF0] pt-2">
              <span className="min-w-0">{l.userName} · {fmtDate(l.workDate)}{l.note && <span className="block text-xs text-[#4B5E73] truncate">{l.note}</span>}</span>
              <span className="flex items-center gap-1">{l.hours} h
                {l.canDelete && (
                  <button type="button" aria-label="Remove entry" className="size-9 flex items-center justify-center text-[#4B5E73]"
                    onClick={() => run(() => fetch(`${base}/labour/${l.id}`, { method: "DELETE", credentials: "include" }).then((r) => { if (!r.ok) throw new Error("Couldn't remove it"); }), "Entry removed").then(refresh)}>
                    <Icon name="close" className="size-4" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Parts used</h2>
            {!done && <Link href={`/m/issue/${enc(job.id)}`} className="min-h-9 px-3 rounded-lg bg-[#102A45] text-white text-[13px] font-semibold flex items-center gap-1"><Icon name="plus" className="size-4" strokeWidth={2.4} /> Issue part</Link>}
          </div>
          {parts.length === 0 ? <p className="text-sm text-[#4B5E73]">No parts issued.</p> : parts.map((p) => (
            <div key={p.partId} className="flex items-center justify-between gap-3 text-sm border-t border-[#E5EAF0] pt-2">
              <span className="min-w-0">{p.name}<span className="block font-mono text-xs text-[#4B5E73]">{p.partId} · ×{p.qty}</span></span>
              <span className="flex items-center gap-1">{fmt(p.value)}
                {!done && p.qty > 0 && <button type="button" aria-label={`Return one ${p.name}`} disabled={busy} onClick={() => returnOne(p.partId)} className="size-9 flex items-center justify-center text-[#4B5E73]"><Icon name="undo" className="size-4" /></button>}
              </span>
            </div>
          ))}
          {parts.length > 0 && <p className="text-right text-sm">Parts total <strong>{fmt(job.totals.partsCost)}</strong></p>}
        </Card>

        <Card className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Notes</h2>
            <span className="text-xs text-[#4B5E73]">{job.notes.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="soft" className="text-sm" onClick={() => { setNoteKind("Note"); setSheet("note"); }}>Add note</Btn>
            <Btn variant="soft" className="text-sm bg-[#FEF3C7] text-[#78350F]" onClick={() => { setNoteKind("Follow-up"); setSheet("note"); }}><Icon name="bulb" className="size-4" /> Follow-up</Btn>
          </div>
          {job.notes.slice().reverse().map((n) => (
            <div key={n.id} className={cn("rounded-xl border p-2.5 text-sm", n.kind === "Follow-up" ? "border-amber-300 bg-amber-50" : "border-[#E5EAF0]")}>
              <p className="text-xs text-[#4B5E73]">{n.kind} · {n.userName} · {fmtDate(n.createdAt)}{n.followUpJobId && <> · <Link href={`/m/job/${enc(n.followUpJobId)}`} className="font-mono underline">{n.followUpJobId}</Link></>}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{n.text}</p>
            </div>
          ))}
        </Card>

        {job.purchaseOrders.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">Purchase orders</h2>
            {job.purchaseOrders.map((po) => (
              <div key={po.id} className="flex justify-between text-sm border-t border-[#E5EAF0] pt-2">
                <span><span className="font-mono">{po.id}</span><span className="block text-xs text-[#4B5E73]">{po.vendor}</span></span>
                <span className="text-right">{formatMoney(Number(po.total), po.currency)}<span className="block text-xs text-[#4B5E73]">{po.status}</span></span>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Sheet open={sheet === "hours"} onClose={() => setSheet(null)} title="Add time">
        <div className="flex flex-col gap-4">
          <Field label="Hours" hint="Quarter hours, e.g. 1.25 or 2.5"><input className={inputCls} type="number" inputMode="decimal" min={0.25} max={24} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
          <Field label="Date"><input className={inputCls} type="date" max={ukToday()} value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></Field>
          <Btn className="h-12" disabled={busy || !(Number(hours) > 0)} onClick={() => addHours(Number(hours), workDate)}>Book {hours || 0} h</Btn>
        </div>
      </Sheet>

      <Sheet open={sheet === "stop"} onClose={() => setSheet(null)} title={`Book ${bookH} h to ${job.id}`}>
        <div className="flex flex-col gap-4">
          <Field label="What was done (optional)"><textarea className={textareaCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Replaced seal element, tested OK" /></Field>
          <Btn className="h-12" disabled={busy} onClick={() => stop(true)}>Stop and book</Btn>
          <Btn variant="danger" disabled={busy} onClick={() => stop(false)}>Discard timer (book nothing)</Btn>
        </div>
      </Sheet>

      <Sheet open={sheet === "note"} onClose={() => setSheet(null)} title={noteKind === "Note" ? "Add a note" : "Recommend follow-up work"}>
        <div className="flex flex-col gap-4">
          <textarea className={textareaCls} rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000}
            placeholder={noteKind === "Note" ? "What did you find and do?" : "e.g. Bearing noisy, replace at next shutdown"} />
          {noteKind === "Follow-up" && <p className="text-xs text-[#4B5E73]">A Lead or Manager can turn this into a new job.</p>}
          <Btn className="h-12" disabled={busy || !note.trim()} onClick={addNote}>Save</Btn>
        </div>
      </Sheet>

      <Sheet open={sheet === "complete"} onClose={() => setSheet(null)} title="Complete job">
        <div className="flex flex-col gap-4">
          {here && <p className="text-sm rounded-xl bg-[#FEF3C7] text-[#78350F] p-3">Your timer will stop and book {bookH} h first.</p>}
          {job.totals.hours === 0 && !here && <p className="text-sm rounded-xl bg-[#FEF3C7] text-[#78350F] p-3">No time is booked on this job. Add your hours first so utilisation is right.</p>}
          <Field label="Closing note (optional)"><textarea className={textareaCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Fault found, fix, and anything to watch" /></Field>
          <Btn className="h-12" disabled={busy} onClick={complete}><Icon name="check" className="text-[#F59E0B]" strokeWidth={2.8} /> Complete</Btn>
        </div>
      </Sheet>
    </Screen>
  );
}
