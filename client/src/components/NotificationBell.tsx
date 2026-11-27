/** The header bell: unread count, latest notifications, mark as read. */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export type NotificationItem = { id: number; kind: string; title: string; body: string | null; link: string | null; mobileLink: string; createdAt: string; readAt: string | null };

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const KIND_DOT: Record<string, string> = {
  request_new: "bg-amber-500", job_assigned: "bg-blue-600", job_unassigned: "bg-orange-600", request_update: "bg-green-600", stock_daily: "bg-red-600",
};

export function useUnread() {
  return useQuery<{ unread: number }>({ queryKey: ["/api/notifications/unread-count"], refetchInterval: 60_000, refetchOnWindowFocus: true, staleTime: 15_000 });
}

export function refreshNotifications() {
  queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
}

export async function openNotification(n: NotificationItem, navigate: (to: string) => void, mobile = false) {
  if (!n.readAt) { apiRequest("POST", `/api/notifications/${n.id}/read`).then(refreshNotifications).catch(() => {}); }
  const to = mobile ? n.mobileLink : n.link;
  if (to) navigate(to);
}

export function NotificationBell() {
  const [, navigate] = useLocation();
  const { data: count } = useUnread();
  const { data, refetch } = useQuery<{ unread: number; items: NotificationItem[] }>({ queryKey: ["/api/notifications"], enabled: false });
  const unread = count?.unread ?? 0;
  const readAll = () => apiRequest("POST", "/api/notifications/read-all").then(refreshNotifications);

  return (
    <Popover onOpenChange={(o) => { if (o) refetch(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} data-testid="button-notifications">
          <Bell className="size-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold leading-[18px] text-white text-center">{unread > 99 ? "99+" : unread}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[95vw] p-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex items-center gap-1">
            {unread > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={readAll}><CheckCheck className="mr-1 size-3.5" /> Mark all read</Button>}
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Notification settings" onClick={() => navigate("/settings#notifications")}><SettingsIcon className="size-3.5" /></Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!data ? <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
            : data.items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
              : data.items.map((n) => (
                <button key={n.id} type="button" onClick={() => openNotification(n, navigate)}
                  className={cn("w-full text-left flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50", !n.readAt && "bg-amber-50/60")}>
                  <span className={cn("mt-1.5 size-2 rounded-full shrink-0", n.readAt ? "bg-transparent" : KIND_DOT[n.kind] ?? "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
