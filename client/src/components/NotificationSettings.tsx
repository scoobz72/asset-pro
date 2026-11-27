/** Notification settings: what to be told about, in the app and as phone/browser pushes, plus this device's push switch. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Loader2, Smartphone, Monitor, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { currentEndpoint, disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { errorMessage } from "@/components/po";

type Settings = {
  kinds: { kind: string; label: string; help: string; app: boolean; push: boolean }[];
  vapidPublicKey: string;
  devices: { id: number; userAgent: string | null; createdAt: string; endpointHost: string; endpoint: string }[];
};

function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Windows/.test(ua) ? "Windows PC" : /Mac OS/.test(ua) ? "Mac" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${os} · ${browser}`;
}

export function NotificationSettings({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Settings>({ queryKey: ["/api/notifications/settings"] });
  const [state, setState] = useState<PushState | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState).catch(() => setState("unsupported")); currentEndpoint().then(setMine).catch(() => {}); }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast({ title: ok }); }
    catch (err) { toast({ title: "Couldn't change that", description: errorMessage(err), variant: "destructive" }); }
    finally { setBusy(false); refresh(); }
  };
  const setPref = (kind: string, field: "app" | "push", value: boolean) =>
    act(() => apiRequest("PUT", "/api/notifications/settings", { [kind]: { [field]: value } }));
  const turnOn = () => act(async () => {
    const s = await enablePush(data!.vapidPublicKey);
    setState(s); setMine(await currentEndpoint());
    if (s === "denied") throw new Error("Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.");
    if (s === "on") await apiRequest("POST", "/api/push/test");
  }, "Notifications are on for this device");
  const turnOff = () => act(async () => { setState(await disablePush()); setMine(null); }, "Notifications are off for this device");
  const test = () => act(async () => {
    const r = await (await apiRequest("POST", "/api/push/test")).json();
    if (!r.devices) throw new Error("No devices have notifications turned on yet.");
  }, "Test sent. It should arrive within a few seconds.");

  if (isLoading || !data) return <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <BellRing className="size-5 mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Notifications on this device</p>
            <p className="text-xs text-muted-foreground">
              {state === "on" && "On. Alerts pop up even when myCMMS isn't open."}
              {state === "off" && "Off. Turn on to get alerts on this phone or computer."}
              {state === "denied" && "Blocked in your browser or phone settings for mycmms.co.uk. Allow notifications there, then come back."}
              {state === "ios-needs-install" && "On iPhone, add myCMMS to your Home Screen first (Share → Add to Home Screen), open it from there, then turn notifications on."}
              {state === "unsupported" && "This browser can't receive notifications. Use Chrome, Edge, Firefox or Safari (iPhone: from the Home Screen app)."}
              {state === null && "Checking…"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === "off" && <Button size="sm" onClick={turnOn} disabled={busy} data-testid="button-push-on">Turn on notifications</Button>}
          {state === "on" && <><Button size="sm" variant="outline" onClick={test} disabled={busy}>Send a test</Button><Button size="sm" variant="ghost" onClick={turnOff} disabled={busy}>Turn off here</Button></>}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3">
          <span className="text-xs font-semibold text-muted-foreground">Tell me about</span>
          <span className="text-xs font-semibold text-muted-foreground text-center w-12">In app</span>
          <span className="text-xs font-semibold text-muted-foreground text-center w-12">Push</span>
          {data.kinds.map((k) => (
            <div key={k.kind} className="contents">
              <div className="min-w-0">
                <p className="text-sm font-medium">{k.label}</p>
                {!compact && <p className="text-xs text-muted-foreground">{k.help}</p>}
              </div>
              <div className="w-12 flex justify-center"><Switch checked={k.app} onCheckedChange={(v) => setPref(k.kind, "app", v)} disabled={busy} aria-label={`${k.label} in the app`} /></div>
              <div className="w-12 flex justify-center"><Switch checked={k.push} onCheckedChange={(v) => setPref(k.kind, "push", v)} disabled={busy} aria-label={`${k.label} as a push`} /></div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Push goes to every device you've turned notifications on for. The stock summary comes once a day at 7:00, only when something is low or out.</p>
      </div>

      {data.devices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Devices getting push ({data.devices.length})</p>
          {data.devices.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 text-sm rounded-lg border px-3 py-2">
              {/Mobi|Android|iPhone|iPad/.test(d.userAgent ?? "") ? <Smartphone className="size-4 text-muted-foreground" /> : <Monitor className="size-4 text-muted-foreground" />}
              <span className="flex-1 min-w-0 truncate">{deviceName(d.userAgent)}{d.endpoint === mine && <span className="text-muted-foreground"> (this device)</span>}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove device" disabled={busy}
                onClick={() => act(() => apiRequest("POST", "/api/push/unsubscribe", { id: d.id }), "Device removed")}><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
