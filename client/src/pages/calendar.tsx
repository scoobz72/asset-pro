import Layout from "@/components/Layout";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Wrench, ClipboardEdit, ScanLine, Truck, Play, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/components/po";
import { ConvertDialog, RejectDialog, type Req } from "@/pages/request-portal";

type Kind = "job" | "request" | "audit" | "delivery";
type Item = {
  kind: Kind; id: string; date: string; title: string; subtitle: string | null; status: string;
  category: string | null; priority: string | null; assignee: string | null; overdue: boolean;
};
type CalendarData = { from: string; to: string; today: string; canTriage: boolean; items: Item[]; overdue: Item[] };

/** Layers. Planned jobs and other jobs are shown separately so planned work stands out. */
const LAYERS = {
  planned: { label: "Planned work", icon: Wrench, chip: "bg-blue-100 text-blue-900 border-blue-200", dot: "bg-blue-500" },
  job: { label: "Breakdowns & other jobs", icon: Wrench, chip: "bg-orange-100 text-orange-900 border-orange-200", dot: "bg-orange-500" },
  request: { label: "Requests to triage", icon: ClipboardEdit, chip: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500" },
  audit: { label: "Asset audits", icon: ScanLine, chip: "bg-purple-100 text-purple-900 border-purple-200", dot: "bg-purple-500" },
  delivery: { label: "Expected deliveries", icon: Truck, chip: "bg-teal-100 text-teal-900 border-teal-200", dot: "bg-teal-500" },
} as const;
type Layer = keyof typeof LAYERS;

const layerOf = (i: Item): Layer => (i.kind === "job" ? (i.category === "Planned" ? "planned" : "job") : i.kind);
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function useLayers() {
  const [on, setOn] = useState<Record<Layer, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("calendar.layers") ?? "null");
      if (saved && typeof saved === "object") return { planned: true, job: true, request: true, audit: true, delivery: true, ...saved };
    } catch { /* storage unavailable */ }
    return { planned: true, job: true, request: true, audit: true, delivery: true };
  });
  const toggle = (l: Layer) => setOn((prev) => {
    const next = { ...prev, [l]: !prev[l] };
    try { localStorage.setItem("calendar.layers", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  return [on, toggle] as const;
}

function invalidateCalendar() {
  for (const key of ["/api/calendar", "/api/jobs", "/api/maintenance-requests", "/api/dashboard/summary"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

function ItemRow({ item, onTriage, onReject }: { item: Item; onTriage: (i: Item) => void; onReject: (i: Item) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const layer = LAYERS[layerOf(item)];
  const Icon = layer.icon;

  const setJobStatus = async (status: string) => {
    setBusy(true);
    try {
      await apiRequest("PATCH", `/api/jobs/${encodeURIComponent(item.id)}`, { status });
      invalidateCalendar();
      toast({ title: `${item.id} ${status === "Completed" ? "completed" : "started"}` });
    } catch (err) {
      toast({ title: "Couldn't update the job", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("p-3 rounded-lg border bg-card flex items-start gap-3", item.overdue && "border-red-300")} data-testid={`calendar-item-${item.kind}-${item.id}`}>
      <div className={cn("mt-1 size-2.5 rounded-full shrink-0", layer.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
          <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
          {item.priority && item.kind === "job" && <Badge variant="secondary" className="text-[10px]">{item.priority}</Badge>}
          {item.kind === "request" && item.category && <Badge variant="secondary" className="text-[10px]">{item.category} urgency</Badge>}
          {item.overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
        </div>
        <div className="font-medium text-sm mt-0.5">{item.title}</div>
        <div className="text-xs text-muted-foreground">
          {[item.subtitle, item.kind === "request" ? (item.assignee ? `from ${item.assignee}` : null) : item.assignee].filter(Boolean).join(" · ")}
          {item.overdue && <> · due {format(parseISO(item.date), "d MMM")}</>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {item.kind === "job" && item.status !== "Completed" && (
          <>
            {item.status !== "In Progress" && (
              <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => setJobStatus("In Progress")}>
                <Play className="mr-1 size-3" /> Start
              </Button>
            )}
            <Button size="sm" className="h-7" disabled={busy} onClick={() => setJobStatus("Completed")} data-testid={`button-complete-${item.id}`}>
              <CheckCircle2 className="mr-1 size-3" /> Complete
            </Button>
          </>
        )}
        {item.kind === "request" && (
          <>
            <Button size="sm" className="h-7" onClick={() => onTriage(item)} data-testid={`button-calendar-convert-${item.id}`}>
              <Wrench className="mr-1 size-3" /> Create job
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => onReject(item)}>
              <XCircle className="mr-1 size-3" /> Reject
            </Button>
          </>
        )}
        {item.kind === "audit" && (
          <Button size="sm" variant="outline" className="h-7" asChild>
            <Link href="/audits"><ExternalLink className="mr-1 size-3" /> {item.status === "Discrepancy" ? "Resolve" : "Conduct"}</Link>
          </Button>
        )}
        {item.kind === "delivery" && (
          <Button size="sm" variant="outline" className="h-7" asChild>
            <Link href={`/purchase-orders/${encodeURIComponent(item.id)}`}><Truck className="mr-1 size-3" /> Receive</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function WorkCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));
  const [layers, toggleLayer] = useLayers();
  const [triage, setTriage] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);

  // Six weeks, Monday first, so the grid never changes height.
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = ymd(days[0]);
  const to = ymd(days[41]);

  const { data, isLoading, isError } = useQuery<CalendarData>({
    queryKey: ["/api/calendar", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30_000,
  });

  const visible = (i: Item) => layers[layerOf(i)];
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of data?.items ?? []) {
      if (!visible(i)) continue;
      if (!m.has(i.date)) m.set(i.date, []);
      m.get(i.date)!.push(i);
    }
    return m;
  }, [data, layers]); // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = (data?.overdue ?? []).filter(visible);
  const selectedItems = byDay.get(selected) ?? [];
  const counts = useMemo(() => {
    const c: Record<Layer, number> = { planned: 0, job: 0, request: 0, audit: 0, delivery: 0 };
    for (const i of data?.items ?? []) c[layerOf(i)]++;
    return c;
  }, [data]);

  const asReq = (i: Item): Req => ({
    id: i.id, title: i.title, urgency: i.category ?? "Medium", assetId: null, area: null, description: null,
    requestedBy: i.assignee ?? "", status: "Submitted", createdAt: null, jobId: null, triagedBy: null, triagedAt: null, rejectionReason: null,
  });

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Everything you can action, by date: planned work, jobs, requests, audits and deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
          <div className="w-40 text-center font-semibold" data-testid="text-calendar-month">{format(month, "MMMM yyyy")}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
          <Button variant="outline" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(ymd(new Date())); }}>Today</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 mb-4">
        {(Object.keys(LAYERS) as Layer[]).filter((l) => l !== "request" || data?.canTriage).map((l) => (
          <label key={l} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={layers[l]} onCheckedChange={() => toggleLayer(l)} data-testid={`toggle-layer-${l}`} />
            <span className={cn("size-2.5 rounded-full", LAYERS[l].dot)} />
            {LAYERS[l].label} <span className="text-muted-foreground">({counts[l]})</span>
          </label>
        ))}
      </div>

      {overdue.length > 0 && (
        <Card className="mb-4 border-red-200">
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2 text-red-700"><AlertTriangle className="size-4" /> Overdue or still waiting ({overdue.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 pb-4">
            {overdue.slice(0, 8).map((i) => (
              <ItemRow key={`${i.kind}-${i.id}`} item={i} onTriage={(x) => setTriage(asReq(x))} onReject={(x) => setRejecting(asReq(x))} />
            ))}
            {overdue.length > 8 && <p className="text-xs text-muted-foreground">…and {overdue.length - 8} more.</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="py-24 text-center text-muted-foreground">Couldn't load the calendar.</p>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const list = byDay.get(key) ?? [];
                const isToday = key === data?.today;
                const isSel = key === selected;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "min-h-[104px] border-b border-r p-1.5 text-left align-top hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !isSameMonth(d, month) && "bg-muted/20 text-muted-foreground",
                      isSel && "bg-primary/5 ring-2 ring-inset ring-primary/40",
                    )}
                    data-testid={`calendar-day-${key}`}
                    aria-label={`${format(d, "EEEE d MMMM")}: ${list.length} item${list.length === 1 ? "" : "s"}`}
                  >
                    <div className={cn("text-xs font-medium mb-1 inline-flex size-6 items-center justify-center rounded-full", isToday && "bg-primary text-primary-foreground")}>
                      {format(d, "d")}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((i) => (
                        <div key={`${i.kind}-${i.id}`} className={cn("truncate rounded border px-1 py-0.5 text-[11px] leading-tight", LAYERS[layerOf(i)].chip, i.status === "Completed" && "opacity-50 line-through")}>
                          {i.title}
                        </div>
                      ))}
                      {list.length > 3 && <div className="text-[11px] text-muted-foreground px-1">+{list.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{format(parseISO(selected), "EEEE d MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing for you on this day.</p>
            ) : selectedItems.map((i) => (
              <ItemRow key={`${i.kind}-${i.id}`} item={i} onTriage={(x) => setTriage(asReq(x))} onReject={(x) => setRejecting(asReq(x))} />
            ))}
          </CardContent>
        </Card>
      </div>

      <ConvertDialog request={triage} onClose={() => setTriage(null)} />
      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} />
    </Layout>
  );
}
