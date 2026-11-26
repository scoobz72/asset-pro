import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { useMaintenanceRequests, useAssets, useJobs, useUsers } from "@/hooks/use-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { ClipboardEdit, Factory, ShieldCheck, Send, Loader2, Wrench, XCircle, ArrowRight } from "lucide-react";
import { JOB_TYPES, JOB_PRIORITIES, URGENCY_PRIORITY } from "@shared/constants";
import { errorMessage } from "@/components/po";
import { cn } from "@/lib/utils";

/** Who can triage requests: must match TRIAGE_ROLES on the server. */
const TRIAGE_ROLES = ["Lead", "Manager", "Admin", "PlatformAdmin"];

export type Req = {
  id: string; title: string; assetId: string | null; area: string | null; urgency: string; description: string | null;
  requestedBy: string; status: string; createdAt: string | null; jobId: string | null; triagedBy: string | null;
  triagedAt: string | null; rejectionReason: string | null;
};

const VIEWS = {
  triage: { label: "To triage", status: "Submitted" },
  converted: { label: "Turned into jobs", status: "Converted" },
  rejected: { label: "Rejected", status: "Rejected" },
  all: { label: "All", status: null },
} as const;
type View = keyof typeof VIEWS;

function invalidate() {
  for (const key of ["/api/maintenance-requests", "/api/jobs", "/api/dashboard/summary", "/api/calendar"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function ConvertDialog({ request, onClose }: { request: Req | null; onClose: () => void }) {
  const { toast } = useToast();
  const { data: users = [] } = useUsers();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Request");
  const [priority, setPriority] = useState<string>("Medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setTitle(request.title);
    setType("Request");
    setPriority(URGENCY_PRIORITY[request.urgency] ?? "Medium");
    setAssigneeId("");
    setDueDate("");
  }, [request]);

  if (!request) return null;
  const convert = async () => {
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/maintenance-requests/${encodeURIComponent(request.id)}/convert`, {
        title: title.trim() || undefined, type, priority,
        assigneeId: assigneeId ? Number(assigneeId) : null, dueDate: dueDate || null,
      });
      const { job } = await res.json();
      invalidate();
      toast({ title: `${request.id} → ${job.id}`, description: "Job created and linked to the request." });
      onClose();
    } catch (err) {
      toast({ title: "Couldn't create the job", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create job from {request.id}</DialogTitle>
          <DialogDescription>The request is marked as converted and linked to the new job.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Job title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} data-testid="input-convert-title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-convert-type"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-convert-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={assigneeId || "__none__"} onValueChange={(v) => setAssigneeId(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-convert-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(users as any[]).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={convert} disabled={busy || !title.trim()} data-testid="button-confirm-convert">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({ request, onClose }: { request: Req | null; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(""), [request]);
  if (!request) return null;
  const reject = async () => {
    setBusy(true);
    try {
      await apiRequest("POST", `/api/maintenance-requests/${encodeURIComponent(request.id)}/reject`, { reason: reason.trim() });
      invalidate();
      toast({ title: `${request.id} rejected` });
      onClose();
    } catch (err) {
      toast({ title: "Couldn't reject the request", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {request.id}</DialogTitle>
          <DialogDescription>The requester will see this reason on the request.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000}
          placeholder="e.g. Duplicate of REQ-00012, already being fixed" data-testid="input-reject-reason" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={reject} disabled={busy || !reason.trim()} data-testid="button-confirm-reject">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RequestPortal() {
  const { toast } = useToast();
  const { data: me } = useCurrentUser();
  const canTriage = !!me && TRIAGE_ROLES.includes(me.role);
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [view, setView] = useState<View>("triage");
  const [converting, setConverting] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);

  const { data: requestsData = [], isLoading: requestsLoading } = useMaintenanceRequests();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: jobs = [] } = useJobs();
  const requests = requestsData as Req[];

  useEffect(() => {
    if (me && !requestedBy) setRequestedBy(me.name);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/maintenance-requests", data)).json(),
    onSuccess: (created: Req) => {
      invalidate();
      toast({ title: `Request ${created.id} submitted`, description: "Maintenance has been notified for triage." });
      reset();
    },
    onError: (err) => {
      toast({ title: "Request not submitted", description: errorMessage(err), variant: "destructive" });
    },
  });

  const reset = () => {
    setTitle("");
    setAssetId(null);
    setArea("");
    setUrgency("Medium");
    setDescription("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequestMutation.mutate({
      title: title.trim(),
      assetId: assetId || null,
      area: area.trim() || null,
      urgency,
      description: description.trim() || null,
      requestedBy: requestedBy.trim() || null,
    });
  };

  const sorted = useMemo(
    () => [...requests].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id)),
    [requests],
  );
  const counts = useMemo(() => Object.fromEntries((Object.keys(VIEWS) as View[]).map((v) => {
    const st = VIEWS[v].status;
    return [v, st ? requests.filter((r) => r.status === st).length : requests.length];
  })), [requests]);
  const shown = sorted.filter((r) => !VIEWS[view].status || r.status === VIEWS[view].status);

  const urgencyBadge = (u: string) => {
    if (u === "High") return <Badge variant="destructive">High</Badge>;
    if (u === "Medium") return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">Medium</Badge>;
    return <Badge variant="outline" className="bg-muted/20">Low</Badge>;
  };

  if (requestsLoading || assetsLoading) {
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Request Portal</h1>
          <p className="text-muted-foreground mt-1">
            Log maintenance requests in seconds. Maintenance triages them into jobs.
          </p>
        </div>
        {canTriage && counts.triage > 0 && (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{counts.triage} waiting for triage</Badge>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="shadow-sm self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardEdit className="size-5 text-primary" />
              Submit a Request
            </CardTitle>
            <CardDescription>What, where and how urgent. Add an asset if you know it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="input-requestedby">Requested by</Label>
                <Input data-testid="input-requestedby" id="input-requestedby" value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)} placeholder="Your name" maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-title">Request title</Label>
                <Input data-testid="input-request-title" id="input-title" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Pump leaking near coupling" required maxLength={200} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset (optional)</Label>
                  <Select value={assetId ?? "__none__"} onValueChange={(v) => setAssetId(v === "__none__" ? null : v)}>
                    <SelectTrigger data-testid="select-request-asset"><SelectValue placeholder="Select asset" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not sure / none</SelectItem>
                      {(assets as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-area">Area / Line</Label>
                  <Input data-testid="input-request-area" id="input-area" value={area} onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g., Line 2" required maxLength={200} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                  <SelectTrigger data-testid="select-request-urgency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="textarea-desc">Description</Label>
                <Textarea data-testid="textarea-request-description" id="textarea-desc" value={description}
                  onChange={(e) => setDescription(e.target.value)} maxLength={4000}
                  placeholder="What happened? When did it start? Any safety concerns?" className="min-h-[120px]" required />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button data-testid="button-submit-request" type="submit" className="gap-2" disabled={createRequestMutation.isPending}>
                  {createRequestMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
                <Button data-testid="button-reset-request" type="button" variant="outline" onClick={reset}>Clear</Button>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground flex items-start gap-3">
                <div className="p-2 rounded bg-primary/10 text-primary"><ShieldCheck className="size-4" /></div>
                <div>
                  <p className="font-medium text-foreground">What happens next?</p>
                  <p>A Lead, Manager or Admin reviews your request and turns it into a job, or replies with a reason. Track it in the list.</p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><Factory className="size-5 text-primary" /> Requests</CardTitle>
            <CardDescription>
              {canTriage ? "Turn requests into jobs, or reject them with a reason." : "Every request and what happened to it."}
            </CardDescription>
            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="pt-2">
              <TabsList className="flex-wrap h-auto">
                {(Object.keys(VIEWS) as View[]).map((v) => (
                  <TabsTrigger key={v} value={v} data-testid={`tab-requests-${v}`}>{VIEWS[v].label} ({counts[v] ?? 0})</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            {shown.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {view === "triage" ? "Nothing waiting for triage." : "No requests here."}
              </div>
            ) : shown.map((r) => {
              const asset = r.assetId ? (assets as any[]).find((a: any) => a.id === r.assetId) : null;
              const job = r.jobId ? (jobs as any[]).find((j: any) => j.id === r.jobId) : null;
              return (
                <div key={r.id} data-testid={`card-request-${r.id}`} className={cn("p-3 rounded-lg border bg-background", r.status === "Submitted" && "border-amber-300")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                        <Badge variant="outline" className={cn("text-[10px]",
                          r.status === "Submitted" && "bg-amber-50 text-amber-800 border-amber-200",
                          r.status === "Converted" && "bg-green-50 text-green-700 border-green-200",
                          r.status === "Rejected" && "bg-red-50 text-red-700 border-red-200")}>{r.status === "Converted" ? "Job created" : r.status}</Badge>
                        {urgencyBadge(r.urgency)}
                      </div>
                      <div className="font-semibold mt-1">{r.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {r.area && <span className="font-medium text-foreground/90">{r.area}</span>}
                        {asset ? <span> • {asset.name}</span> : null}
                      </div>
                      {r.description && <p className="text-sm mt-1 whitespace-pre-wrap break-words">{r.description}</p>}
                      <div className="text-xs text-muted-foreground mt-1">Requested by {r.requestedBy} · {when(r.createdAt)}</div>
                      {r.status === "Converted" && (
                        <div className="text-xs mt-1 flex items-center gap-1">
                          <ArrowRight className="size-3" /> Job <span className="font-mono font-medium">{r.jobId}</span>
                          {job ? <> · {job.status}</> : null} · by {r.triagedBy} {when(r.triagedAt)}
                        </div>
                      )}
                      {r.status === "Rejected" && (
                        <div className="text-xs mt-1 text-red-700">Rejected by {r.triagedBy}: {r.rejectionReason}</div>
                      )}
                    </div>
                    {canTriage && r.status === "Submitted" && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => setConverting(r)} data-testid={`button-convert-${r.id}`}>
                          <Wrench className="mr-1.5 size-3.5" /> Create job
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejecting(r)} data-testid={`button-reject-${r.id}`}>
                          <XCircle className="mr-1.5 size-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <ConvertDialog request={converting} onClose={() => setConverting(null)} />
      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} />
    </Layout>
  );
}
