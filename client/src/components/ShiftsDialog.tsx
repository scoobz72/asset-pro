import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ABSENCE_REASONS } from "@shared/constants";
import { errorMessage, formatDate } from "@/components/po";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<(typeof DAYS)[number], string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
type Day = (typeof DAYS)[number];
type Pattern = { id: number; effectiveFrom: string } & Record<Day, string>;
type Absence = { id: number; startDate: string; endDate: string; hoursPerDay: string | null; reason: string; note: string | null };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const weekTotal = (p: Record<Day, string | number>) => DAYS.reduce((s, d) => s + Number(p[d] || 0), 0);

export function ShiftsDialog({ user, onClose }: { user: { id: number; name: string } | null; onClose: () => void }) {
  const { toast } = useToast();
  const key = ["/api/users", String(user?.id ?? 0), "shifts"];
  const { data, isLoading } = useQuery<{ patterns: Pattern[]; absences: Absence[] }>({ queryKey: key, enabled: !!user });
  const [from, setFrom] = useState(today());
  const [hours, setHours] = useState<Record<Day, string>>({ mon: "8", tue: "8", wed: "8", thu: "8", fri: "8", sat: "0", sun: "0" });
  const [abs, setAbs] = useState({ startDate: today(), endDate: today(), reason: "Holiday", hoursPerDay: "", note: "" });
  const [busy, setBusy] = useState(false);

  // Start the editor from the pattern in force today, if there is one.
  useEffect(() => {
    if (!data) return;
    const current = [...data.patterns].reverse().find((p) => p.effectiveFrom <= today()) ?? data.patterns[data.patterns.length - 1];
    if (current) setHours(Object.fromEntries(DAYS.map((d) => [d, String(Number(current[d]))])) as Record<Day, string>);
  }, [data]);
  useEffect(() => { if (user) { setFrom(today()); setAbs({ startDate: today(), endDate: today(), reason: "Holiday", hoursPerDay: "", note: "" }); } }, [user]);

  if (!user) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok });
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/kpis"] });
      return true;
    } catch (err) {
      toast({ title: "Couldn't save", description: errorMessage(err), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const base = `/api/users/${user.id}`;
  const savePattern = () => run(() => apiRequest("PUT", `${base}/shifts`, {
    effectiveFrom: from, ...Object.fromEntries(DAYS.map((d) => [d, Number(hours[d] || 0)])),
  }), "Shift pattern saved");
  const addAbsence = async () => {
    const ok = await run(() => apiRequest("POST", `${base}/absences`, {
      startDate: abs.startDate, endDate: abs.endDate, reason: abs.reason,
      hoursPerDay: abs.hoursPerDay === "" ? null : Number(abs.hoursPerDay), note: abs.note.trim() || null,
    }), "Absence added");
    if (ok) setAbs({ ...abs, note: "", hoursPerDay: "" });
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user.name}: shift hours & absences</DialogTitle>
          <DialogDescription>
            Available hours = the weekly pattern in force on each day, less absences. Utilisation on the Reports page is hours booked to jobs ÷ available hours.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="font-semibold text-sm">Weekly shift pattern</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d) => (
                  <div key={d} className="space-y-1">
                    <Label className="text-xs">{DAY_LABEL[d]}</Label>
                    <Input className="h-9 px-2 text-center" type="number" min={0} max={24} step={0.25} value={hours[d]}
                      onChange={(e) => setHours({ ...hours, [d]: e.target.value })} data-testid={`input-shift-${d}`} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Applies from</Label>
                  <Input className="h-9 w-44" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{weekTotal(hours)} h a week</span>
                  <Button onClick={savePattern} disabled={busy || !from} data-testid="button-save-shifts">Save pattern</Button>
                </div>
              </div>
              {data && data.patterns.length > 0 && (
                <ul className="text-sm border rounded-md divide-y">
                  {[...data.patterns].reverse().map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span>From {formatDate(p.effectiveFrom)}: {DAYS.map((d) => Number(p[d])).join(" / ")} <span className="text-muted-foreground">({weekTotal(p)} h)</span></span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete pattern" disabled={busy}
                        onClick={() => run(() => apiRequest("DELETE", `${base}/shifts/${p.id}`), "Pattern deleted")}><Trash2 className="size-3.5" /></Button>
                    </li>
                  ))}
                </ul>
              )}
              {data && data.patterns.length === 0 && <p className="text-xs text-muted-foreground">No pattern yet, so {user.name} has no available hours and won't show a utilisation figure.</p>}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold text-sm">Absences</h3>
              <div className="grid gap-2 sm:grid-cols-4 items-end">
                <div className="space-y-1"><Label className="text-xs">From</Label><Input className="h-9" type="date" value={abs.startDate} onChange={(e) => setAbs({ ...abs, startDate: e.target.value, endDate: abs.endDate < e.target.value ? e.target.value : abs.endDate })} /></div>
                <div className="space-y-1"><Label className="text-xs">To</Label><Input className="h-9" type="date" min={abs.startDate} value={abs.endDate} onChange={(e) => setAbs({ ...abs, endDate: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Reason</Label>
                  <Select value={abs.reason} onValueChange={(v) => setAbs({ ...abs, reason: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{ABSENCE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Hours off a day</Label><Input className="h-9" type="number" min={0} max={24} step={0.25} placeholder="Whole shift" value={abs.hoursPerDay} onChange={(e) => setAbs({ ...abs, hoursPerDay: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <Input className="h-9" placeholder="Note (optional)" maxLength={500} value={abs.note} onChange={(e) => setAbs({ ...abs, note: e.target.value })} />
                <Button className="h-9" onClick={addAbsence} disabled={busy || !abs.startDate || !abs.endDate} data-testid="button-add-absence">Add</Button>
              </div>
              {data && data.absences.length > 0 ? (
                <ul className="text-sm border rounded-md divide-y">
                  {[...data.absences].reverse().map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span>
                        {formatDate(a.startDate)}{a.endDate !== a.startDate ? ` – ${formatDate(a.endDate)}` : ""} · {a.reason}
                        {a.hoursPerDay !== null ? ` · ${Number(a.hoursPerDay)} h a day` : " · whole shift"}
                        {a.note && <span className="text-muted-foreground"> · {a.note}</span>}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete absence" disabled={busy}
                        onClick={() => run(() => apiRequest("DELETE", `${base}/absences/${a.id}`), "Absence deleted")}><Trash2 className="size-3.5" /></Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">No absences recorded.</p>}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
