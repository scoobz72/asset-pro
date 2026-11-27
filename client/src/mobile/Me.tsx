import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useAssets } from "@/hooks/use-data";
import { LogoIcon } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Btn, Card, Chip, Empty, Icon, Screen, Spinner, TopBar, enc, patch, refreshMobile, useRun } from "./ui";
import type { MyDay } from "./Today";
import { NotificationSettings } from "@/components/NotificationSettings";

/* --------------------------------------------------------------- audit walk-round */

type Audit = { id: string; assetId: string; status: string; expectedLocation: string | null; verifiedLocation: string | null; scheduledDate: string | null };

export function AuditRun() {
  const ids = (new URLSearchParams(useSearch()).get("ids") ?? "").split(",").filter(Boolean);
  const { data: audits = [], isLoading } = useQuery<Audit[]>({ queryKey: ["/api/audits"], refetchOnWindowFocus: true });
  const { data: assets = [] } = useAssets();
  const { busy, run } = useRun();
  const mineList = (audits as Audit[]).filter((a) => ids.includes(a.id));
  const done = mineList.filter((a) => a.status !== "Pending" && a.status !== "Scheduled").length;
  const name = (id: string) => (assets as any[]).find((a) => a.id === id)?.name ?? id;
  const here = (a: Audit) => run(() => patch(`/api/audits/${enc(a.id)}`, {
    status: "Completed", verifiedLocation: a.expectedLocation, completionDate: new Date().toISOString(),
  }), `${a.assetId} confirmed`).then(() => refreshMobile());

  return (
    <Screen header={<TopBar title={`Audit${mineList[0]?.expectedLocation ? `: ${mineList[0].expectedLocation}` : ""}`} sub={`${done} of ${mineList.length} checked`} back="/m" />}>
      <div className="p-4 flex flex-col gap-2.5">
        <div className="h-2 rounded-full bg-[#E5EAF0] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={mineList.length} aria-valuenow={done}>
          <div className="h-full bg-[#F59E0B] transition-all" style={{ width: `${mineList.length ? (done / mineList.length) * 100 : 0}%` }} />
        </div>
        <Link href="/m/scan" className="min-h-14 rounded-2xl bg-[#102A45] text-white font-semibold flex items-center justify-center gap-2"><Icon name="scan" className="text-[#F59E0B]" /> Scan next asset</Link>
        <p className="text-xs text-[#4B5E73]">Scanning a tag opens the asset with "It's here" and "Not here" buttons. You can also tick assets off below.</p>
        {isLoading ? <Spinner /> : mineList.length === 0 ? <Empty icon="check" title="No audits found" /> : mineList.map((a) => {
          const open = a.status === "Pending" || a.status === "Scheduled";
          return (
            <Card key={a.id} className="flex items-center gap-3 py-3">
              <span className={cn("size-8 rounded-full flex items-center justify-center shrink-0", open ? "bg-[#E5EAF0] text-[#4B5E73]" : a.status === "Discrepancy" ? "bg-[#FDE2E2] text-[#9B1C1C]" : "bg-[#DCFCE7] text-[#166534]")}>
                <Icon name={open ? "pin" : a.status === "Discrepancy" ? "alert" : "check"} className="size-4" strokeWidth={2.4} />
              </span>
              <Link href={`/m/asset/${enc(a.assetId)}`} className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{name(a.assetId)}</span>
                <span className="block text-xs text-[#4B5E73] truncate"><span className="font-mono">{a.assetId}</span>{!open && ` · ${a.status === "Discrepancy" ? `found at ${a.verifiedLocation}` : "confirmed"}`}</span>
              </Link>
              {open && <Btn variant="soft" className="px-3 text-sm" disabled={busy} onClick={() => here(a)}>Here</Btn>}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- me */

type InstallPrompt = Event & { prompt: () => Promise<void> };
let deferredPrompt: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e as InstallPrompt; });
}

export function MePage() {
  const { data: me } = useCurrentUser();
  const { data: day } = useQuery<MyDay>({ queryKey: ["/api/me/today"] });
  const logout = useLogout();
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone);
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); deferredPrompt = e as InstallPrompt; setCanInstall(true); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  const week = day?.hours.week;
  const util = week && week.available > 0 ? Math.round((week.booked / week.available) * 100) : null;

  return (
    <Screen header={<TopBar title="Me" />}>
      <div className="p-4 flex flex-col gap-3">
        <Card className="flex items-center gap-3">
          <span className="size-12 rounded-full bg-[#102A45] text-white flex items-center justify-center text-lg font-bold">{(me?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
          <div className="min-w-0">
            <p className="font-bold truncate">{me?.name}</p>
            <p className="text-sm text-[#4B5E73] truncate">{me?.role} · {(me as any)?.companyName}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">This week</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#F4F6F9] rounded-xl py-2"><p className="text-[11px] text-[#4B5E73]">Booked</p><p className="text-lg font-bold">{week?.booked ?? 0} h</p></div>
            <div className="bg-[#F4F6F9] rounded-xl py-2"><p className="text-[11px] text-[#4B5E73]">Shift so far</p><p className="text-lg font-bold">{week?.available ?? 0} h</p></div>
            <div className="bg-[#F4F6F9] rounded-xl py-2"><p className="text-[11px] text-[#4B5E73]">Utilisation</p><p className="text-lg font-bold">{util === null ? "—" : `${util}%`}</p></div>
          </div>
          <p className="text-xs text-[#4B5E73]">Target 70–85%. Book time on every job so this reflects your real day.</p>
        </Card>

        {!standalone && (
          <Card className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3"><LogoIcon className="size-10" /><div><p className="font-bold">Install myCMMS</p><p className="text-xs text-[#4B5E73]">Opens full screen from your home screen, like an app.</p></div></div>
            {canInstall ? (
              <Btn variant="amber" onClick={async () => { await deferredPrompt?.prompt(); deferredPrompt = null; setCanInstall(false); }}><Icon name="download" /> Add to home screen</Btn>
            ) : ios ? (
              <p className="text-sm">In Safari, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.</p>
            ) : (
              <p className="text-sm">In your browser menu, choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
            )}
          </Card>
        )}

        <Card>
          <h2 className="text-[15px] font-bold mb-3">Notifications</h2>
          <NotificationSettings compact />
        </Card>

        <Card className="p-0 overflow-hidden">
          {[
            { href: "/m/notifications", icon: "inbox", label: "Notifications" },
            { href: "/m/requests", icon: "inbox", label: "My requests" },
            { href: "/m/stock", icon: "box", label: "Stock" },
            { href: "/", icon: "desktop", label: "Full site (reports, calendar, purchasing)" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 min-h-14 border-b border-[#E5EAF0] last:border-0">
              <Icon name={l.icon} className="text-[#4B5E73]" /><span className="flex-1">{l.label}</span><Icon name="back" className="rotate-180 size-4 text-[#9AAABB]" />
            </Link>
          ))}
        </Card>

        <Btn variant="danger" className="h-12" onClick={() => logout.mutate(undefined, { onSuccess: () => { window.location.href = "/m"; } })}><Icon name="logout" /> Sign out</Btn>
        <p className="text-center text-xs text-[#9AAABB]">{day?.newRequests ? <Chip tone="amber">{day.newRequests} requests to triage</Chip> : null}</p>
      </div>
    </Screen>
  );
}
