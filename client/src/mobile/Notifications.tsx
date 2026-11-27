import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { KIND_DOT, openNotification, refreshNotifications, timeAgo, useUnread, type NotificationItem } from "@/components/NotificationBell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { pushState, type PushState } from "@/lib/push";
import { Btn, Card, Empty, Icon, Screen, Spinner, TopBar } from "./ui";

/** Bell for the mobile header, with the unread count. */
export function MobileBell() {
  const { data } = useUnread();
  const n = data?.unread ?? 0;
  return (
    <Link href="/m/notifications" aria-label={n ? `Notifications, ${n} unread` : "Notifications"} className="relative size-11 flex items-center justify-center rounded-lg active:bg-white/10">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-[22px]" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
      {n > 0 && <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F59E0B] text-[#102A45] text-[11px] font-bold leading-[18px] text-center">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}

export default function MobileNotifications() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<{ unread: number; items: NotificationItem[] }>({ queryKey: ["/api/notifications"], refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const [push, setPush] = useState<PushState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => { pushState().then(setPush).catch(() => setPush("unsupported")); }, []);
  const readAll = () => apiRequest("POST", "/api/notifications/read-all").then(refreshNotifications);

  return (
    <Screen header={<TopBar title="Notifications" sub={data?.unread ? `${data.unread} unread` : undefined} back="/m"
      right={data?.unread ? <button type="button" onClick={readAll} className="min-h-11 px-3 text-sm font-semibold text-[#1D4ED8]">Mark all read</button> : undefined} />}>
      <div className="p-4 flex flex-col gap-2.5">
        {push && push !== "on" && !showSettings && (
          <Card className="border-2 border-[#F59E0B] flex flex-col gap-2">
            <p className="font-semibold">Get alerts on this phone</p>
            <p className="text-sm text-[#4B5E73]">
              {push === "ios-needs-install" ? "Add myCMMS to your Home Screen (Share → Add to Home Screen), open it from there, then turn alerts on."
                : push === "denied" ? "Notifications are blocked for mycmms.co.uk. Allow them in your phone's settings for this browser."
                  : push === "unsupported" ? "This browser can't show alerts. Try Chrome on Android, or the Home Screen app on iPhone."
                    : "New requests, jobs assigned to you and the morning stock summary, even when the app is closed."}
            </p>
            {push === "off" && <Btn variant="amber" onClick={() => setShowSettings(true)}>Set up alerts</Btn>}
          </Card>
        )}

        {showSettings ? (
          <Card><NotificationSettings compact /><Btn variant="soft" className="w-full mt-4" onClick={() => setShowSettings(false)}>Done</Btn></Card>
        ) : (
          <Btn variant="ghost" className="self-end text-sm text-[#1D4ED8]" onClick={() => setShowSettings(true)}><Icon name="list" className="size-4" /> Notification settings</Btn>
        )}

        {isLoading ? <Spinner /> : !data?.items.length ? <Empty icon="inbox" title="No notifications yet">You'll see new requests, jobs assigned to you and stock alerts here.</Empty>
          : data.items.map((n) => (
            <button key={n.id} type="button" onClick={() => openNotification(n, navigate, true)}
              className={cn("text-left rounded-2xl px-4 py-3 flex gap-3 shadow-[0_1px_3px_rgba(16,42,69,0.08)]", n.readAt ? "bg-white" : "bg-[#FFFBEB] border border-[#FDE68A]")}>
              <span className={cn("mt-1.5 size-2.5 rounded-full shrink-0", n.readAt ? "bg-[#E5EAF0]" : KIND_DOT[n.kind] ?? "bg-[#102A45]")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px] leading-snug", !n.readAt && "font-semibold")}>{n.title}</span>
                {n.body && <span className="block text-[13px] text-[#4B5E73] mt-0.5 line-clamp-3">{n.body}</span>}
                <span className="block text-xs text-[#9AAABB] mt-1">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
      </div>
    </Screen>
  );
}
