import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_CURRENCY, formatMoney } from "@shared/constants";
import { formatDate } from "@/components/po";

type Kpi = { key: string; label: string; value: number | null; unit: string; detail: string; target: string | null; definition: string };
type Engineer = { userId: number; name: string; role: string; hasShifts: boolean; available: number; booked: number; planned: number; reactive: number; utilisation: number | null };
type KpiReport = {
  from: string; to: string; today: string; showCost: boolean;
  targets: { low: number; high: number };
  utilisation: { team: { available: number; booked: number; utilisation: number | null }; engineers: Engineer[]; definition: string };
  kpis: Kpi[];
  cost: null | { labour: number; parts: number; total: number; unratedHours: number; stockValue: number; topAssets: { assetId: string; value: number }[]; definition: string };
  notYetMeasured: { label: string; needs: string }[];
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PERIODS = {
  thisMonth: "This month",
  lastMonth: "Last month",
  last3: "Last 3 months",
  ytd: "Year to date",
  last12: "Last 12 months",
  custom: "Custom dates",
} as const;
type Period = keyof typeof PERIODS;

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (p) {
    case "lastMonth": return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "last3": return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case "ytd": return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
    case "last12": return { from: ymd(new Date(y, m - 11, 1)), to: ymd(now) };
    default: return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
  }
}

const pctText = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** Green inside the target band, amber below it, blue above it (overbooked or hours not matching shifts). */
function bandClass(v: number | null, t: { low: number; high: number }) {
  if (v === null) return "text-muted-foreground";
  if (v < t.low) return "text-amber-600";
  if (v > t.high) return "text-sky-600";
  return "text-green-600";
}

function UtilBar({ value, targets }: { value: number | null; targets: { low: number; high: number } }) {
  const w = value === null ? 0 : Math.min(value, 1.2) / 1.2;
  return (
    <div className="relative h-2 w-full min-w-24 rounded bg-muted">
      <div className="absolute inset-y-0 bg-green-500/15" style={{ left: `${(targets.low / 1.2) * 100}%`, width: `${((targets.high - targets.low) / 1.2) * 100}%` }} />
      <div className={cn("absolute inset-y-0 left-0 rounded",
        value === null ? "" : value < targets.low ? "bg-amber-500" : value > targets.high ? "bg-sky-500" : "bg-green-500")} style={{ width: `${w * 100}%` }} />
    </div>
  );
}

export function EngineeringKpis() {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [custom, setCustom] = useState(periodRange("last3"));
  const range = useMemo(() => (period === "custom" ? custom : periodRange(period)), [period, custom]);
  const qs = `from=${range.from}&to=${range.to}`;
  const { data, isLoading, error } = useQuery<KpiReport>({
    queryKey: [`/api/reports/kpis?${qs}`],
    enabled: !!range.from && !!range.to && range.from <= range.to,
  });

  return (
    <section className="mt-8 space-y-6 print-break-before">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Engineering KPIs</h2>
          <p className="text-muted-foreground text-sm">
            {data ? `${formatDate(data.from)} – ${formatDate(data.to)}` : "Choose a period"} · from hours booked on jobs, shift patterns and the job history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44" data-testid="select-kpi-period"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PERIODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input type="date" className="w-40" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <Input type="date" className="w-40" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </>
          )}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
      {error && <p className="text-sm text-destructive">Couldn't load KPIs: {(error as Error).message}</p>}

      {data && (
        <>
          <Card className="print-avoid-break print:shadow-none">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline gap-x-3">
                Engineer utilisation
                <span className={cn("text-3xl", bandClass(data.utilisation.team.utilisation, data.targets))} data-testid="text-team-utilisation">{pctText(data.utilisation.team.utilisation)}</span>
                <span className="text-sm font-normal text-muted-foreground">team · {data.utilisation.team.booked} of {data.utilisation.team.available} h</span>
              </CardTitle>
              <CardDescription>
                {data.utilisation.definition} Target band {Math.round(data.targets.low * 100)}–{Math.round(data.targets.high * 100)}%: below it usually means hours aren't being booked or work isn't planned; above it usually means hours booked outside shifts, or no slack for breakdowns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.utilisation.engineers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No shift patterns or booked hours yet. Managers set shift hours on the <Link href="/team" className="text-primary underline">Team page</Link> (⋮ → Shift hours & absences); engineers book time on each job's page.
                </p>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Engineer</TableHead>
                        <TableHead className="text-right">Available h</TableHead>
                        <TableHead className="text-right">Booked h</TableHead>
                        <TableHead className="text-right">Planned h</TableHead>
                        <TableHead className="text-right">Reactive h</TableHead>
                        <TableHead className="text-right">Utilisation</TableHead>
                        <TableHead className="w-40 print:hidden" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.utilisation.engineers.map((e) => (
                        <TableRow key={e.userId} data-testid={`row-util-${e.userId}`}>
                          <TableCell>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-muted-foreground">{e.role}{!e.hasShifts && " · no shift pattern"}</div>
                          </TableCell>
                          <TableCell className="text-right">{e.available}</TableCell>
                          <TableCell className="text-right">{e.booked}</TableCell>
                          <TableCell className="text-right">{e.planned}</TableCell>
                          <TableCell className="text-right">{e.reactive}</TableCell>
                          <TableCell className={cn("text-right font-semibold", bandClass(e.utilisation, data.targets))}>{pctText(e.utilisation)}</TableCell>
                          <TableCell className="print:hidden"><UtilBar value={e.utilisation} targets={data.targets} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-3">
            {data.kpis.map((k) => (
              <Card key={k.key} className="print-avoid-break print:shadow-none" data-testid={`kpi-${k.key}`}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{k.label}</p>
                    <span title={k.definition} className="text-muted-foreground print:hidden"><Info className="size-3.5" /></span>
                  </div>
                  <p className="text-2xl font-bold">
                    {k.value === null ? "—" : k.unit === "%" ? `${Math.round(k.value * 100)}%` : <>{k.value}{k.unit && <span className="text-base font-normal text-muted-foreground"> {k.unit}</span>}</>}
                  </p>
                  <p className="text-xs text-muted-foreground">{k.detail}</p>
                  {k.target && <p className="text-xs"><span className="text-muted-foreground">Benchmark:</span> {k.target}</p>}
                  <p className="text-[11px] text-muted-foreground hidden print:block">{k.definition}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.cost && (
            <Card className="print-avoid-break print:shadow-none">
              <CardHeader>
                <CardTitle>Maintenance cost</CardTitle>
                <CardDescription>{data.cost.definition} Shown to Managers and Admins only. All in {HOME_CURRENCY}.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-3 content-start">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Labour</p><p className="text-xl font-bold">{formatMoney(data.cost.labour, HOME_CURRENCY)}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Parts</p><p className="text-xl font-bold">{formatMoney(data.cost.parts, HOME_CURRENCY)}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{formatMoney(data.cost.total, HOME_CURRENCY)}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Stock value today (FIFO)</p><p className="text-xl font-bold">{formatMoney(data.cost.stockValue, HOME_CURRENCY)}</p></div>
                  {data.cost.unratedHours > 0 && (
                    <p className="col-span-2 text-xs text-amber-700">{data.cost.unratedHours} h were booked by engineers with no labour rate, so they aren't costed. An Admin can set rates on the Team page.</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Top assets by cost</p>
                  {data.cost.topAssets.length === 0 ? <p className="text-sm text-muted-foreground">No costed work on assets in this period.</p> : (
                    <ol className="text-sm divide-y border rounded-md">
                      {data.cost.topAssets.map((a) => (
                        <li key={a.assetId} className="flex justify-between px-3 py-1.5"><span className="font-mono">{a.assetId}</span><span>{formatMoney(a.value, HOME_CURRENCY)}</span></li>
                      ))}
                    </ol>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="print-avoid-break print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Other common engineering KPIs</CardTitle>
              <CardDescription>Widely used in maintenance, but they need data myCMMS doesn't hold yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1.5">
                {data.notYetMeasured.map((n) => (
                  <li key={n.label}><span className="font-medium">{n.label}</span> <span className="text-muted-foreground">— needs {n.needs.charAt(0).toLowerCase() + n.needs.slice(1)}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
