import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Clock, Loader2, Package, MessageSquare, Lightbulb, ShoppingCart, Trash2, Plus, Undo2, Wrench, Activity, CheckCircle2, Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser, PRIVILEGED_ROLES } from "@/hooks/use-auth";
import { useInventory, useUsers } from "@/hooks/use-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { HOME_CURRENCY, JOB_TYPES, JOB_PRIORITIES, formatMoney } from "@shared/constants";
import { errorMessage, formatDate, formatDateTime, PoEditorDialog, PoStatusBadge, CurrencyTag, MoneyPair } from "@/components/po";

const LEAD_ROLES = ["Lead", "Manager", "Admin", "PlatformAdmin"];
const JOB_STATUSES = ["Open", "Scheduled", "In Progress", "Completed"];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

type Labour = { id: number; userId: number; userName: string | null; workDate: string; hours: number; note: string | null; createdBy: string | null; cost: number | null; canDelete: boolean };
type Note = { id: number; kind: string; text: string; userName: string | null; createdAt: string; followUpJobId: string | null };
type PartTxn = { id: string; partId: string; partName: string | null; type: string; quantity: number; unitCost: string | null; value: string | null; createdAt: string; userId: string | null; reference: string | null };
type JobRecord = {
  id: string; title: string; description: string | null; assetId: string | null; assetName: string | null; status: string;
  priority: string; type: string | null; assigneeId: number | null; assigneeName: string | null; dueDate: string | null;
  createdAt: string; completedAt: string | null;
  labour: Labour[]; notes: Note[]; parts: PartTxn[];
  purchaseOrders: { id: string; vendor: string; status: string; currency: string; total: string; totalHome: string | null }[];
  totals: { hours: number; labourCost: number | null; partsCost: number };
  assetKpis: { months: { month: string; breakdowns: number }[]; breakdownsTotal: number; mttrHours: number | null; mtbfDays: number | null; repairHoursExcludingPlanned: number } | null;
};

function refresh(id: string) {
  for (const key of ["/api/jobs", "/api/inventory", "/api/transactions", "/api/dashboard/summary", "/api/calendar", "/api/reports/kpis"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
  queryClient.invalidateQueries({ queryKey: ["/api/jobs", encodeURIComponent(id), "record"] });
}

function useAction() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast({ title: ok });
      return true;
    } catch (err) {
      toast({ title: "Couldn't save", description: errorMessage(err), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function TimeCard({ job, canBookForOthers }: { job: JobRecord; canBookForOthers: boolean }) {
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const [userId, setUserId] = useState<string>("");
  const [workDate, setWorkDate] = useState(today());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const { busy, run } = useAction();
  useEffect(() => { if (me && !userId) setUserId(String(me.id)); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    const h = Number(hours);
    const ok = await run(() => apiRequest("POST", `/api/jobs/${encodeURIComponent(job.id)}/labour`, {
      userId: Number(userId) || undefined, workDate, hours: h, note: note.trim() || null,
    }), `${h} h booked`);
    if (ok) { setHours(""); setNote(""); refresh(job.id); }
  };
  const remove = (l: Labour) => run(() => apiRequest("DELETE", `/api/jobs/${encodeURIComponent(job.id)}/labour/${l.id}`), "Time entry removed").then((ok) => ok && refresh(job.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="size-4" /> Time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_0.7fr] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Engineer</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!canBookForOthers}>
              <SelectTrigger className="h-9" data-testid="select-labour-user"><SelectValue placeholder="Engineer" /></SelectTrigger>
              <SelectContent>
                {(canBookForOthers ? (users as any[]) : (users as any[]).filter((u) => u.id === me?.id)).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input className="h-9" type="date" max={today()} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hours</Label>
            <Input className="h-9" type="number" min={0.25} max={24} step={0.25} placeholder="1.5" value={hours} onChange={(e) => setHours(e.target.value)} data-testid="input-labour-hours" />
          </div>
        </div>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="What was done (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <Button className="h-9" onClick={add} disabled={busy || !(Number(hours) > 0)} data-testid="button-add-labour">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}<span className="ml-1">Book</span>
          </Button>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                {job.totals.labourCost !== null && <TableHead className="text-right">Cost</TableHead>}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.labour.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-14 text-center text-muted-foreground text-sm">No time booked yet.</TableCell></TableRow>
              ) : job.labour.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(l.workDate)}</TableCell>
                  <TableCell className="text-sm">
                    {l.userName}
                    {l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}
                  </TableCell>
                  <TableCell className="text-right">{l.hours}</TableCell>
                  {job.totals.labourCost !== null && <TableCell className="text-right text-sm">{l.cost === null ? <span className="text-muted-foreground">no rate</span> : formatMoney(l.cost, HOME_CURRENCY)}</TableCell>}
                  <TableCell>
                    {l.canDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove entry" onClick={() => remove(l)}><Trash2 className="size-3.5" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-right">
          Total <span className="font-semibold">{job.totals.hours} h</span>
          {job.totals.labourCost !== null && <> · {formatMoney(job.totals.labourCost, HOME_CURRENCY)}</>}
        </div>
      </CardContent>
    </Card>
  );
}

function PartsCard({ job }: { job: JobRecord }) {
  const { data: inventory = [] } = useInventory();
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("1");
  const { busy, run } = useAction();
  const part = (inventory as any[]).find((p) => p.id === partId);

  // Net quantity per part on this job (issues minus returns), for "Return" buttons.
  const net = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; value: number }>();
    for (const t of job.parts) {
      if (t.type === "Purchase Order") continue;
      const cur = m.get(t.partId) ?? { name: t.partName ?? t.partId, qty: 0, value: 0 };
      cur.qty += -t.quantity;
      cur.value += -Number(t.value ?? 0);
      m.set(t.partId, cur);
    }
    return m;
  }, [job.parts]);

  const move = (type: "Job Issue" | "Return to Stores", id: string, quantity: number) => run(
    () => apiRequest("POST", "/api/stock/movements", { partId: id, type, quantity, jobId: job.id }),
    type === "Job Issue" ? "Part issued to job" : "Part returned to stores",
  ).then((ok) => { if (ok) { refresh(job.id); setQty("1"); } return ok; });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="size-4" /> Parts used</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={partId} onValueChange={setPartId}>
            <SelectTrigger className="h-9 flex-1" data-testid="select-job-part"><SelectValue placeholder="Issue a part from stores…" /></SelectTrigger>
            <SelectContent>
              {(inventory as any[]).map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>{p.id} – {p.name} ({p.stock} {p.unit})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-9 w-20" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          <Button className="h-9" disabled={busy || !partId || !(Number(qty) > 0) || (part && Number(qty) > part.stock)}
            onClick={() => move("Job Issue", partId, parseInt(qty, 10))} data-testid="button-issue-part">
            <Plus className="size-4" /><span className="ml-1">Issue</span>
          </Button>
        </div>
        {part && Number(qty) > part.stock && <p className="text-xs text-destructive">Only {part.stock} {part.unit} in stock.</p>}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead className="text-right">Qty used</TableHead>
                <TableHead className="text-right">Cost (FIFO)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {net.size === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-14 text-center text-muted-foreground text-sm">No parts issued to this job.</TableCell></TableRow>
              ) : Array.from(net, ([id, p]) => (
                <TableRow key={id}>
                  <TableCell className="text-sm">{p.name}<div className="text-xs text-muted-foreground font-mono">{id}</div></TableCell>
                  <TableCell className="text-right">{p.qty}</TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.value, HOME_CURRENCY)}</TableCell>
                  <TableCell>
                    {p.qty > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => move("Return to Stores", id, 1)} title="Return one to stores">
                        <Undo2 className="mr-1 size-3" /> Return 1
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-right">Parts total <span className="font-semibold">{formatMoney(job.totals.partsCost, HOME_CURRENCY)}</span></div>
      </CardContent>
    </Card>
  );
}

function NotesCard({ job, canRaise }: { job: JobRecord; canRaise: boolean }) {
  const [, navigate] = useLocation();
  const { data: users = [] } = useUsers();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"Note" | "Follow-up">("Note");
  const [raising, setRaising] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: "", type: "Planned", priority: "Medium", assigneeId: "", dueDate: "" });
  const { busy, run } = useAction();

  const add = async () => {
    const ok = await run(() => apiRequest("POST", `/api/jobs/${encodeURIComponent(job.id)}/notes`, { kind, text: text.trim() }),
      kind === "Note" ? "Note added" : "Follow-up recommended");
    if (ok) { setText(""); refresh(job.id); }
  };
  const openRaise = (n: Note) => { setRaising(n); setForm({ title: n.text.slice(0, 120), type: "Planned", priority: "Medium", assigneeId: "", dueDate: "" }); };
  const raise = async () => {
    if (!raising) return;
    let createdId = "";
    const ok = await run(async () => {
      const res = await apiRequest("POST", `/api/jobs/${encodeURIComponent(job.id)}/notes/${raising.id}/follow-up-job`, {
        title: form.title.trim() || undefined, type: form.type, priority: form.priority,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null, dueDate: form.dueDate || null,
      });
      createdId = (await res.json()).id;
    }, "Follow-up job raised");
    if (ok) { setRaising(null); refresh(job.id); if (createdId) navigate(`/jobs/${encodeURIComponent(createdId)}`); }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="size-4" /> Notes & follow-ups</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
          placeholder={kind === "Note" ? "What was found and done…" : "Recommended further work, e.g. replace worn bearing at next shutdown"} data-testid="input-job-note" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Note">Note</SelectItem>
              <SelectItem value="Follow-up">Follow-up recommendation</SelectItem>
            </SelectContent>
          </Select>
          <Button className="h-9" onClick={add} disabled={busy || !text.trim()} data-testid="button-add-note">Add</Button>
        </div>
        <ol className="space-y-2">
          {job.notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
          {[...job.notes].reverse().map((n) => (
            <li key={n.id} className={cn("rounded-md border p-2.5 text-sm", n.kind === "Follow-up" && "border-amber-300 bg-amber-50/50")}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">{n.kind === "Follow-up" && <Lightbulb className="size-3 text-amber-600" />}{n.kind} · {n.userName} · {formatDateTime(n.createdAt)}</span>
                {n.kind === "Follow-up" && (n.followUpJobId ? (
                  <Link href={`/jobs/${encodeURIComponent(n.followUpJobId)}`} className="font-mono text-primary hover:underline">→ {n.followUpJobId}</Link>
                ) : canRaise ? (
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => openRaise(n)} data-testid={`button-raise-${n.id}`}>Raise job</Button>
                ) : <span>Not raised yet</span>)}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">{n.text}</p>
            </li>
          ))}
        </ol>
      </CardContent>
      <Dialog open={!!raising} onOpenChange={(o) => !o && setRaising(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise follow-up job</DialogTitle>
            <DialogDescription>A new job on the same asset, linked to {job.id}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Assign to</Label>
                <Select value={form.assigneeId || "__none__"} onValueChange={(v) => setForm({ ...form, assigneeId: v === "__none__" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">Unassigned</SelectItem>{(users as any[]).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaising(null)}>Cancel</Button>
            <Button onClick={raise} disabled={busy || !form.title.trim()}>Raise job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const [, navigate] = useLocation();
  const { data: me } = useCurrentUser();
  const { data: job, isLoading, error } = useQuery<JobRecord>({ queryKey: ["/api/jobs", encodeURIComponent(id), "record"] });
  const [poOpen, setPoOpen] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const { busy, run } = useAction();

  if (isLoading) return <Layout><div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div></Layout>;
  if (error || !job) return <Layout><p className="py-20 text-center text-muted-foreground">Job {id} not found.</p></Layout>;

  const isLead = !!me && LEAD_ROLES.includes(me.role);
  const isManager = !!me && (PRIVILEGED_ROLES as string[]).includes(me.role);
  const setStatus = (status: string) => run(() => apiRequest("PATCH", `/api/jobs/${encodeURIComponent(job.id)}`, { status }), `Job ${status.toLowerCase()}`).then((ok) => ok && refresh(job.id));
  const saveDescription = () => run(() => apiRequest("PATCH", `/api/jobs/${encodeURIComponent(job.id)}`, { description: (description ?? "").trim() || null }), "Description saved")
    .then((ok) => { if (ok) { setDescription(null); refresh(job.id); } });

  return (
    <Layout>
      <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="mr-1 size-4" /> Jobs</Link>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-muted-foreground" data-testid="text-job-id">{job.id}</span>
            <Badge variant="outline">{job.type ?? "Job"}</Badge>
            <Badge variant="outline" className={cn(job.priority === "Critical" && "border-red-500 text-red-600", job.priority === "High" && "border-orange-500 text-orange-600")}>{job.priority}</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">{job.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {job.assetName ? <>{job.assetName} <span className="font-mono">({job.assetId})</span> · </> : null}
            {job.assigneeName ? `Assigned to ${job.assigneeName}` : "Unassigned"}
            {job.dueDate ? ` · Due ${formatDate(job.dueDate)}` : ""} · Raised {formatDateTime(job.createdAt)}
            {job.completedAt ? ` · Completed ${formatDateTime(job.completedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={job.status} onValueChange={setStatus} disabled={busy}>
            <SelectTrigger className="w-40" data-testid="select-job-status"><SelectValue /></SelectTrigger>
            <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          {job.status !== "In Progress" && job.status !== "Completed" && <Button variant="outline" onClick={() => setStatus("In Progress")} disabled={busy}><Play className="mr-1 size-4" /> Start</Button>}
          {job.status !== "Completed" && <Button onClick={() => setStatus("Completed")} disabled={busy} data-testid="button-job-complete"><CheckCircle2 className="mr-1 size-4" /> Complete</Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hours booked</p><p className="text-2xl font-bold">{job.totals.hours}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Parts (FIFO)</p><p className="text-2xl font-bold">{formatMoney(job.totals.partsCost, HOME_CURRENCY)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Labour</p><p className="text-2xl font-bold">{job.totals.labourCost === null ? "—" : formatMoney(job.totals.labourCost, HOME_CURRENCY)}</p>{!isManager && <p className="text-xs text-muted-foreground">Shown to Managers/Admins</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total cost</p><p className="text-2xl font-bold">{job.totals.labourCost === null ? "—" : formatMoney(job.totals.labourCost + job.totals.partsCost, HOME_CURRENCY)}</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent>
          {description === null ? (
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm whitespace-pre-wrap">{job.description || <span className="text-muted-foreground">No description.</span>}</p>
              <Button variant="ghost" size="sm" onClick={() => setDescription(job.description ?? "")}>Edit</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDescription(null)}>Cancel</Button>
                <Button size="sm" onClick={saveDescription} disabled={busy}>Save</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2 mb-6">
        <TimeCard job={job} canBookForOthers={isLead} />
        <PartsCard job={job} />
        <NotesCard job={job} canRaise={isLead} />
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="size-4" /> Purchase orders</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setPoOpen(true)}><Plus className="mr-1 size-3.5" /> PO for this job</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.purchaseOrders.length === 0 ? <p className="text-sm text-muted-foreground">No POs raised for this job.</p> : job.purchaseOrders.map((po) => (
              <Link key={po.id} href={`/purchase-orders/${encodeURIComponent(po.id)}`} className="flex items-center justify-between gap-2 rounded-md border p-2.5 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="font-mono text-sm">{po.id}</div>
                  <div className="text-xs text-muted-foreground truncate">{po.vendor}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CurrencyTag currency={po.currency} />
                  <MoneyPair amount={po.total} currency={po.currency} homeAmount={po.currency === HOME_CURRENCY ? null : po.totalHome} />
                  <PoStatusBadge status={po.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {job.assetKpis && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> {job.assetName ?? job.assetId}: KPI trend</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={job.assetKpis.months.map((m) => ({ ...m, label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" }) }))}>
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} width={24} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="breakdowns" name="Breakdowns" fill="#DC2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center">Breakdowns per month, last 12 months</p>
            </div>
            <div className="grid grid-cols-2 gap-3 content-start">
              <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Breakdowns (all time)</p><p className="text-xl font-bold">{job.assetKpis.breakdownsTotal}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">MTTR</p><p className="text-xl font-bold">{job.assetKpis.mttrHours === null ? "—" : `${job.assetKpis.mttrHours} h`}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">MTBF</p><p className="text-xl font-bold">{job.assetKpis.mtbfDays === null ? "—" : `${job.assetKpis.mtbfDays} d`}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Repair hours (excl. PPM)</p><p className="text-xl font-bold">{job.assetKpis.repairHoursExcludingPlanned}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <PoEditorDialog open={poOpen} onOpenChange={setPoOpen} defaultJobId={job.id} onSaved={(poId) => navigate(`/purchase-orders/${encodeURIComponent(poId)}`)} />
    </Layout>
  );
}
