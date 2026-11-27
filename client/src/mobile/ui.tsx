/**
 * Building blocks for the mobile app (/m): screen shell, tab bar, bottom sheet, chips and helpers.
 * Designed for one hand on a phone: 44px+ targets, primary actions at the bottom.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/po";
import { cn } from "@/lib/utils";

export const NAVY = "#102A45";
export const AMBER = "#F59E0B";

export const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
export const fmtHours = (h: number) => `${Math.round(h * 100) / 100} h`;
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  const date = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
export const fmtClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
export const enc = encodeURIComponent;

/* ----------------------------------------------------------------- data */

export type Timer = {
  jobId: string; jobTitle: string; assetId: string | null; running: boolean; startedAt: string | null;
  accumulatedSeconds: number; elapsedSeconds: number; workDate: string; hoursIfStopped: number;
} | null;

export function useTimer() {
  return useQuery<Timer>({ queryKey: ["/api/me/timer"], refetchOnWindowFocus: true, staleTime: 15_000 });
}

/** Seconds on the timer, ticking every second while it runs. */
export function useTimerSeconds(t: Timer) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!t?.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t?.running]);
  if (!t) return 0;
  if (!t.running || !t.startedAt) return t.accumulatedSeconds;
  return t.accumulatedSeconds + Math.max(0, (now - new Date(t.startedAt).getTime()) / 1000);
}

export function refreshMobile(...extra: string[]) {
  for (const key of ["/api/me/today", "/api/me/timer", "/api/jobs", "/api/inventory", "/api/transactions",
    "/api/audits", "/api/maintenance-requests", "/api/dashboard/summary", "/api/calendar", "/api/reports/kpis", ...extra]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Runs a write with a toast on failure (and on success, if given a message). */
export function useRun() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) toast({ title: ok });
      return out;
    } catch (err) {
      toast({ title: "Couldn't do that", description: errorMessage(err), variant: "destructive" });
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export const post = async (url: string, body?: unknown) => (await apiRequest("POST", url, body ?? {})).json().catch(() => null);
export const patch = async (url: string, body: unknown) => (await apiRequest("PATCH", url, body)).json().catch(() => null);

/* ----------------------------------------------------------------- icons */

const paths: Record<string, ReactNode> = {
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  scan: <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  inbox: <><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  back: <path d="m15 18-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  check: <path d="m5 12 5 5 9-10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  torch: <><path d="M7 2h10v5l-3 4v11h-4V11L7 7z" /><path d="M7 7h10" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></>,
  desktop: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  logout: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
};

export function Icon({ name, className, strokeWidth = 2 }: { name: keyof typeof paths | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={cn("size-5 shrink-0", className)} aria-hidden="true">
      {paths[name] ?? null}
    </svg>
  );
}

/* ----------------------------------------------------------------- shell */

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

/** A full-height phone screen: optional header, scrolling body, optional sticky footer, tab bar. */
export function Screen({ header, children, footer, tabs = true, dark = false, className }: {
  header?: ReactNode; children: ReactNode; footer?: ReactNode; tabs?: boolean; dark?: boolean; className?: string;
}) {
  const online = useOnline();
  return (
    <div className={cn("mobile-app fixed inset-0 flex flex-col font-sans", dark ? "bg-[#0B1C2E] text-white" : "bg-[#F4F6F9] text-[#102A45]")}>
      {!online && <div className="bg-red-700 text-white text-center text-sm py-1.5 pt-[max(6px,env(safe-area-inset-top))]">You're offline. Changes won't save until you're back on signal.</div>}
      {header}
      <main className={cn("flex-1 overflow-y-auto overscroll-contain", className)}>{children}</main>
      {footer && <div className="bg-white border-t border-[#E5EAF0] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] text-[#102A45]">{footer}</div>}
      {tabs && !footer && <TabBar />}
    </div>
  );
}

export function TopBar({ title, sub, back, right, dark }: { title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode; dark?: boolean }) {
  const [, navigate] = useLocation();
  return (
    <header className={cn("flex items-center gap-1 px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]", dark ? "bg-[#102A45] text-white" : "bg-white border-b border-[#E5EAF0]")}>
      {back !== undefined ? (
        <button type="button" aria-label="Back" className="size-11 flex items-center justify-center rounded-lg active:bg-black/10"
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate(back || "/m"))}>
          <Icon name="back" className="size-6" />
        </button>
      ) : <span className="w-2" />}
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-bold leading-tight truncate">{title}</h1>
        {sub && <p className={cn("text-xs truncate", dark ? "text-[#C7D3E0]" : "text-[#4B5E73]")}>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function TabBar() {
  const [loc] = useLocation();
  const { data: day } = useQuery<{ newRequests: number }>({ queryKey: ["/api/me/today"] });
  const tab = (href: string, label: string, icon: string, active: boolean, badge?: number) => (
    <Link href={href} className={cn("w-16 min-h-[52px] flex flex-col items-center gap-0.5 pt-1 text-[11px] relative", active ? "font-semibold text-[#102A45]" : "text-[#4B5E73]")}>
      <Icon name={icon} className="size-6" />{label}
      {!!badge && <span className="absolute top-0 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F59E0B] text-[#102A45] text-[11px] font-bold leading-[18px] text-center">{badge}</span>}
    </Link>
  );
  return (
    <nav aria-label="Main" className="bg-white border-t border-[#E5EAF0] flex items-start justify-around pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]">
      {tab("/m", "Jobs", "wrench", loc === "/m" || loc.startsWith("/m/job"))}
      {tab("/m/stock", "Stock", "box", loc.startsWith("/m/stock") || loc.startsWith("/m/part") || loc.startsWith("/m/bin"))}
      <Link href="/m/scan" aria-label="Scan" className="size-[60px] -mt-6 rounded-full bg-[#F59E0B] text-[#102A45] flex items-center justify-center shadow-[0_4px_12px_rgba(245,158,11,0.45)] active:scale-95 transition-transform">
        <Icon name="scan" className="size-7" strokeWidth={2.2} />
      </Link>
      {tab("/m/requests", "Requests", "inbox", loc.startsWith("/m/requests") || loc.startsWith("/m/report"), day?.newRequests)}
      {tab("/m/me", "Me", "user", loc.startsWith("/m/me"))}
    </nav>
  );
}

/* ----------------------------------------------------------------- pieces */

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(16,42,69,0.08)]", className)} {...rest}>{children}</section>;
}

export function Chip({ children, tone = "grey" }: { children: ReactNode; tone?: "red" | "blue" | "amber" | "green" | "grey" | "navy" }) {
  const tones = {
    red: "bg-[#FDE2E2] text-[#9B1C1C]", blue: "bg-[#DBEAFE] text-[#1E3A8A]", amber: "bg-[#FEF3C7] text-[#78350F]",
    green: "bg-[#DCFCE7] text-[#166534]", grey: "bg-[#E5EAF0] text-[#334155]", navy: "bg-[#102A45] text-white",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", tones[tone])}>{children}</span>;
}

export const priorityTone = (p: string | null | undefined) => (p === "Critical" || p === "High" ? "red" : p === "Medium" ? "amber" : "grey") as "red" | "amber" | "grey";
export const statusTone = (s: string | null | undefined) => (s === "In Progress" ? "blue" : s === "Completed" ? "green" : s === "Scheduled" ? "amber" : "grey") as "blue" | "green" | "amber" | "grey";

export function Btn({ children, onClick, variant = "primary", disabled, className, type = "button", ...rest }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "amber" | "outline" | "soft" | "danger" | "ghost"; disabled?: boolean; className?: string; type?: "button" | "submit";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const v = {
    primary: "bg-[#102A45] text-white", amber: "bg-[#F59E0B] text-[#102A45]", outline: "border-[1.5px] border-[#102A45] text-[#102A45] bg-white",
    soft: "bg-[#E5EAF0] text-[#102A45]", danger: "bg-white border-[1.5px] border-red-600 text-red-700", ghost: "text-[#102A45]",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn("min-h-11 px-4 rounded-xl font-semibold text-[15px] inline-flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50", v[variant], className)} {...rest}>
      {children}
    </button>
  );
}

/** A bottom sheet for short forms (closes on backdrop tap). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end text-[#102A45]" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto">
        <span className="block mx-auto mb-3 w-10 h-1.5 rounded-full bg-[#C7D3E0]" />
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-[#4B5E73]">{hint}</span>}
    </label>
  );
}

export const inputCls = "h-12 w-full rounded-xl border border-[#C7D3E0] bg-white px-3 text-base text-[#102A45] outline-none focus:border-[#102A45] focus:ring-2 focus:ring-[#102A45]/15";
export const textareaCls = "w-full rounded-xl border border-[#C7D3E0] bg-white px-3 py-2.5 text-base text-[#102A45] outline-none focus:border-[#102A45] focus:ring-2 focus:ring-[#102A45]/15 resize-none";

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-6 text-[#4B5E73]">
      <span className="size-14 rounded-2xl bg-white flex items-center justify-center text-[#102A45]"><Icon name={icon} className="size-7" /></span>
      <p className="font-semibold text-[#102A45]">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-16"><span className="size-8 rounded-full border-4 border-[#C7D3E0] border-t-[#102A45] animate-spin" /></div>;
}

/** Segmented control. */
export function Segments<T extends string>({ value, onChange, options, dark }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; dark?: boolean }) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-xl p-1", dark ? "bg-white/10" : "bg-[#E5EAF0]")}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cn("flex-1 h-9 rounded-lg text-sm", o.value === value ? (dark ? "bg-white text-[#102A45] font-semibold" : "bg-white font-semibold text-[#102A45] shadow-sm") : (dark ? "text-white" : "text-[#4B5E73]"))}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
