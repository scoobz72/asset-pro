import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogoIcon } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Card, Chip, Icon, Screen, Segments, Spinner, enc, fmtDate, fmtClock, fmtHours, priorityTone, statusTone, useTimer, useTimerSeconds } from "./ui";

export type MyDay = {
  today: string; name: string; role: string;
  jobs: { id: string; title: string; status: string; priority: string; type: string | null; dueDate: string | null; assetId: string | null; assetName: string | null; locationName: string | null; overdue: boolean; dueToday: boolean }[];
  audits: { key: string; date: string | null; location: string | null; auditIds: string[]; assetIds: string[]; overdue: boolean }[];
  hours: { today: { booked: number; planned: number; available: number }; week: { booked: number; available: number; from: string }; hasShifts: boolean };
  newRequests: number;
  unassigned: { id: string; title: string; status: string; priority: string; type: string | null; dueDate: string | null; assetId: string | null; assetName: string | null }[];
};

function Ring({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.min(1, value);
  const c = 2 * Math.PI * 15.5;
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 36 36" className="size-14" role="img" aria-label={value === null ? "No shift today" : `Utilisation ${Math.round(value * 100)} percent`}>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5EAF0" strokeWidth="4" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 18 18)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold">{value === null ? "—" : `${Math.round(value * 100)}%`}</span>
    </div>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export default function Today() {
  const { data: day, isLoading, refetch, isFetching } = useQuery<MyDay>({ queryKey: ["/api/me/today"], refetchOnWindowFocus: true, refetchInterval: 60_000, staleTime: 20_000 });
  const { data: timer } = useTimer();
  const seconds = useTimerSeconds(timer ?? null);
  const [filter, setFilter] = useState<"today" | "overdue" | "all">("today");

  const lists = useMemo(() => {
    const jobs = day?.jobs ?? [];
    const audits = day?.audits ?? [];
    const t = day?.today ?? "";
    return {
      today: { jobs: jobs.filter((j) => j.overdue || j.dueToday || !j.dueDate || j.status === "In Progress"), audits: audits.filter((a) => !a.date || a.date <= t) },
      overdue: { jobs: jobs.filter((j) => j.overdue), audits: audits.filter((a) => a.overdue) },
      all: { jobs, audits },
    };
  }, [day]);
  const shown = lists[filter];

  if (isLoading || !day) return <Screen><Spinner /></Screen>;
  const util = day.hours.today.available > 0 ? day.hours.today.booked / day.hours.today.available : null;
  const date = new Date(`${day.today}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const count = shown.jobs.length + shown.audits.length;

  const todo = lists.today.jobs.length + lists.today.audits.length;
  const first = day.name.split(" ")[0];

  return (
    <Screen header={
      <header className="bg-[#102A45] text-white flex items-center justify-between pl-4 pr-2 pt-[max(8px,env(safe-area-inset-top))] pb-1">
        <div className="flex items-center gap-2.5"><LogoIcon className="size-8" /><span className="font-bold text-[17px]">myCMMS</span></div>
        <button type="button" aria-label="Refresh" onClick={() => refetch()} className="size-11 flex items-center justify-center rounded-lg active:bg-white/10">
          <Icon name="refresh" className={cn("size-5", isFetching && "animate-spin")} />
        </button>
      </header>
    }>
      <div className="bg-[#102A45] text-white px-5 pt-2 pb-14">
        <p className="text-sm text-[#C7D3E0]">{date} · {greeting()} {first}</p>
        <h1 className="text-[22px] font-bold leading-tight mt-1">{todo === 0 ? "Nothing due today" : `${todo} to do today`}</h1>
      </div>
      <div className="relative -mt-10 px-4 pb-6 flex flex-col gap-3">
        <Card className="flex items-center gap-3.5 py-3.5">
          {day.hours.hasShifts ? <Ring value={util} /> : (
            <span className="size-14 shrink-0 rounded-full bg-[#F4F6F9] flex items-center justify-center text-[#4B5E73]"><Icon name="clock" className="size-6" /></span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug">{fmtHours(day.hours.today.booked)} booked today{day.hours.today.available > 0 ? ` of ${fmtHours(day.hours.today.available)}` : ""}</p>
            <p className="text-[13px] text-[#4B5E73] leading-snug">
              {day.hours.today.booked > 0 ? `${day.hours.today.planned} planned · ${Math.round((day.hours.today.booked - day.hours.today.planned) * 100) / 100} reactive · ` : ""}{day.hours.week.booked} h this week
            </p>
            {!day.hours.hasShifts && <p className="text-xs text-[#92400E] mt-0.5 leading-snug">No shift hours set yet, so utilisation can't show. A manager sets them on the Team page.</p>}
          </div>
        </Card>

        {timer && (
          <Link href={`/m/job/${enc(timer.jobId)}`} className={cn("rounded-2xl px-4 py-3 flex items-center gap-3", timer.running ? "bg-[#F59E0B] text-[#102A45]" : "bg-white border-2 border-[#F59E0B]")}>
            <span className={cn("size-2.5 rounded-full bg-[#102A45]", timer.running && "animate-pulse")} />
            <span className="flex-1 min-w-0 text-sm truncate"><strong>{timer.running ? "Timer running" : "Timer paused"}</strong> · {timer.jobId}</span>
            <span className="font-mono text-base font-medium">{fmtClock(seconds)}</span>
          </Link>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/m/scan", icon: "scan", label: "Scan tag", tone: "text-[#102A45]" },
            { href: "/m/report", icon: "alert", label: "Report fault", tone: "text-[#B45309]" },
            { href: "/m/stock", icon: "box", label: "Find part", tone: "text-[#1D4ED8]" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="bg-white rounded-2xl min-h-[72px] flex flex-col items-center justify-center gap-1.5 text-[13px] font-semibold shadow-[0_1px_3px_rgba(16,42,69,0.08)] active:bg-[#F9FAFB]">
              <Icon name={a.icon} className={cn("size-6", a.tone)} />{a.label}
            </Link>
          ))}
        </div>

        {day.newRequests > 0 && (
          <Link href="/m/requests" className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 border-2 border-[#F59E0B]">
            <Icon name="inbox" className="text-[#B45309]" />
            <span className="flex-1 text-sm"><strong>{day.newRequests} request{day.newRequests === 1 ? "" : "s"}</strong> waiting for triage</span>
            <Icon name="back" className="rotate-180 size-4 text-[#9AAABB]" />
          </Link>
        )}

        <Segments value={filter} onChange={setFilter} options={[
          { value: "today", label: `Today ${lists.today.jobs.length + lists.today.audits.length}` },
          { value: "overdue", label: `Overdue ${lists.overdue.jobs.length + lists.overdue.audits.length}` },
          { value: "all", label: `All ${lists.all.jobs.length + lists.all.audits.length}` },
        ]} />

        {count === 0 && (
          <div className="bg-white/60 rounded-2xl px-4 py-5 flex items-center gap-3 text-sm text-[#4B5E73]">
            <span className="size-10 rounded-xl bg-[#DCFCE7] text-[#166534] flex items-center justify-center shrink-0"><Icon name="check" strokeWidth={2.6} /></span>
            <span>{filter === "overdue" ? "Nothing overdue. Nice work." : filter === "all" ? "No open jobs or audits are assigned to you." : "Nothing assigned to you for today."}</span>
          </div>
        )}

        {shown.jobs.map((j) => (
          <Link key={j.id} href={`/m/job/${enc(j.id)}`} className="bg-white rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 shadow-[0_1px_3px_rgba(16,42,69,0.08)] active:bg-[#F9FAFB]">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[#4B5E73]">{j.id}</span>
              <Chip tone={j.type === "Planned" ? "blue" : priorityTone(j.priority)}>{j.type ?? "Job"} · {j.priority}</Chip>
              <span className={cn("ml-auto font-semibold", j.overdue ? "text-red-700" : statusTone(j.status) === "blue" ? "text-[#1D4ED8]" : "text-[#4B5E73]")}>
                {j.overdue ? `Overdue ${fmtDate(j.dueDate)}` : j.status === "In Progress" ? "In progress" : j.dueDate ? `Due ${fmtDate(j.dueDate)}` : j.status}
              </span>
            </div>
            <p className="text-base font-semibold leading-snug">{j.title}</p>
            {(j.assetName || j.assetId) && <p className="text-[13px] text-[#4B5E73]">{[j.assetName, j.assetId, j.locationName].filter(Boolean).join(" · ")}</p>}
          </Link>
        ))}

        {shown.audits.map((a) => (
          <Link key={a.key} href={`/m/audit?ids=${enc(a.auditIds.join(","))}`} className="bg-white rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 shadow-[0_1px_3px_rgba(16,42,69,0.08)]">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[#4B5E73]">{a.auditIds[0]}</span>
              <Chip tone="amber">Audit · {a.assetIds.length} asset{a.assetIds.length === 1 ? "" : "s"}</Chip>
              <span className={cn("ml-auto font-semibold", a.overdue ? "text-red-700" : "text-[#4B5E73]")}>{a.date ? (a.overdue ? `Overdue ${fmtDate(a.date)}` : fmtDate(a.date)) : "No date"}</span>
            </div>
            <p className="text-base font-semibold">Asset audit{a.location ? `: ${a.location}` : ""}</p>
            <p className="text-[13px] text-[#4B5E73]">Scan each asset tag to confirm it's where it should be</p>
          </Link>
        ))}

        {day.unassigned.length > 0 && (
          <>
            <h2 className="text-[13px] font-semibold text-[#4B5E73] mt-2">Open jobs nobody has ({day.unassigned.length})</h2>
            {day.unassigned.map((j) => (
              <Link key={j.id} href={`/m/job/${enc(j.id)}`} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-[#F9FAFB]">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs"><span className="font-mono text-[#4B5E73]">{j.id}</span><Chip tone={j.type === "Planned" ? "blue" : priorityTone(j.priority)}>{j.priority}</Chip></span>
                  <span className="block font-semibold truncate mt-0.5">{j.title}</span>
                  {(j.assetName || j.assetId) && <span className="block text-xs text-[#4B5E73] truncate">{j.assetName ?? j.assetId}</span>}
                </span>
                <span className="text-sm font-semibold text-[#1D4ED8] shrink-0">Take</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </Screen>
  );
}
