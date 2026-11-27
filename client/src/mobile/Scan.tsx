import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Btn, Icon, Screen, Sheet, enc, inputCls } from "./ui";

type Lookup = {
  code: string; exact: boolean;
  assets: { id: string; name: string; locationName: string | null; openJobs: unknown[] }[];
  parts: { id: string; name: string; stock: number; unit: string; binId: string | null }[];
  bins: { id: string; description: string | null; parts: unknown[] }[];
  jobs: { id: string; title: string; status: string }[];
  purchaseOrders: { id: string; vendor: string; status: string }[];
};

type Hit = { href: string; kind: string; title: string; sub: string };

function hitsOf(r: Lookup): Hit[] {
  return [
    ...r.jobs.map((j) => ({ href: `/m/job/${enc(j.id)}`, kind: "Job", title: j.title, sub: `${j.id} · ${j.status}` })),
    ...r.assets.map((a) => ({ href: `/m/asset/${enc(a.id)}`, kind: "Asset", title: a.name, sub: [a.id, a.locationName].filter(Boolean).join(" · ") })),
    ...r.parts.map((p) => ({ href: `/m/part/${enc(p.id)}`, kind: "Part", title: p.name, sub: `${p.id} · ${p.stock} ${p.unit} in stock` })),
    ...r.bins.map((b) => ({ href: `/m/bin/${enc(b.id)}`, kind: "Bin", title: b.id, sub: `${b.parts.length} part${b.parts.length === 1 ? "" : "s"}${b.description ? ` · ${b.description}` : ""}` })),
    ...r.purchaseOrders.map((po) => ({ href: `/purchase-orders/${enc(po.id)}`, kind: "PO", title: po.id, sub: `${po.vendor} · ${po.status}` })),
  ];
}

/** Camera scanning uses the browser's BarcodeDetector (Chrome on Android). Elsewhere, type the code. */
export default function Scan() {
  const [, navigate] = useLocation();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unsupported" | "denied">("starting");
  const [torch, setTorch] = useState<boolean | null>(null);
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");
  const lastCode = useRef("");

  const resolve = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setLooking(true); setError("");
    try {
      const res = await apiRequest("GET", `/api/lookup?code=${enc(v)}`);
      const r: Lookup = await res.json();
      const hits = hitsOf(r);
      if (hits.length === 1 && r.exact) {
        if (navigator.vibrate) navigator.vibrate(60);
        navigate(hits[0].href);
        return;
      }
      setResult(r);
      if (!hits.length) setError(`Nothing matches "${r.code}".`);
    } catch {
      setError("Couldn't look that up. Check your signal and try again.");
    } finally {
      setLooking(false);
    }
  };

  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout> | undefined;
    const Detector = (window as any).BarcodeDetector;
    (async () => {
      if (!Detector || !navigator.mediaDevices?.getUserMedia) { setCamera("unsupported"); return; }
      try {
        const formats: string[] = await Detector.getSupportedFormats?.() ?? ["qr_code"];
        const want = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "data_matrix", "upc_a", "itf"].filter((f) => formats.includes(f));
        const detector = new Detector({ formats: want.length ? want : formats });
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const track = s.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as any;
        if (caps.torch) setTorch(false);
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setCamera("on");
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            if (video.current.readyState >= 2) {
              const found = await detector.detect(video.current);
              const value = found?.[0]?.rawValue;
              if (value && value !== lastCode.current) {
                lastCode.current = value;
                await resolve(value);
                setTimeout(() => { lastCode.current = ""; }, 2500);
              }
            }
          } catch { /* keep scanning */ }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (err: any) {
        setCamera(err?.name === "NotAllowedError" ? "denied" : "unsupported");
      }
    })();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch } as any] }); setTorch(!torch); } catch { /* not supported */ }
  };

  const hits = result ? hitsOf(result) : [];

  return (
    <Screen dark tabs={false} header={
      <header className="flex items-center justify-between px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 text-white">
        <Link href="/m" aria-label="Close scanner" className="size-11 flex items-center justify-center"><Icon name="close" className="size-6" /></Link>
        <span className="font-semibold">Scan a tag</span>
        {torch !== null ? (
          <button type="button" aria-label={torch ? "Torch off" : "Torch on"} aria-pressed={torch} onClick={toggleTorch} className={`size-11 flex items-center justify-center rounded-lg ${torch ? "bg-[#F59E0B] text-[#102A45]" : ""}`}><Icon name="torch" /></button>
        ) : <span className="size-11" />}
      </header>
    }>
      <div className="flex flex-col items-center gap-5 px-5 py-4 min-h-full">
        <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-black/40">
          <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
          {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"]).map((c) => (
            <span key={c} className={`absolute size-12 m-3 border-[#F59E0B] ${c}`} />
          ))}
          {camera === "on" && <span className="absolute left-8 right-8 top-1/2 h-0.5 bg-[#F59E0B] shadow-[0_0_12px_#F59E0B] animate-pulse" />}
          {camera !== "on" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[#C7D3E0]">
              <Icon name="scan" className="size-12 opacity-40" />
              {camera === "starting" && <p>Starting camera…</p>}
              {camera === "denied" && <p>Camera access is blocked. Allow the camera for mycmms.co.uk in your browser settings, or type the code.</p>}
              {camera === "unsupported" && <p>This browser can't read codes from the camera. Type the code, or point your phone's own camera at a myCMMS QR label to open it here.</p>}
            </div>
          )}
        </div>
        <p className="text-sm text-[#C7D3E0] text-center max-w-[280px]">{looking ? "Looking it up…" : "Point at an asset tag, part or bin label, or a job sheet."}</p>
        {error && <p className="text-sm text-amber-300 text-center" role="alert">{error}</p>}
        <Btn variant="outline" className="bg-transparent border-white/40 text-white" onClick={() => { setTyping(true); setError(""); }}>Type the code instead</Btn>
      </div>

      <Sheet open={typing} onClose={() => setTyping(false)} title="Find by code or name">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setTyping(false); resolve(code); }}>
          <input className={inputCls} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Asset ID, serial, part no., bin or JOB-…" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          <Btn type="submit" className="h-12" disabled={!code.trim()}>Find</Btn>
        </form>
      </Sheet>

      <Sheet open={hits.length > 0} onClose={() => setResult(null)} title={result?.exact ? `Matches for ${result.code}` : `Closest to "${result?.code}"`}>
        <ul className="flex flex-col gap-2">
          {hits.map((h) => (
            <li key={h.href}>
              <Link href={h.href} className="flex items-center gap-3 rounded-xl bg-[#F4F6F9] px-3 py-3 min-h-14">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#4B5E73] w-11">{h.kind}</span>
                <span className="min-w-0"><span className="block font-semibold truncate">{h.title}</span><span className="block text-xs text-[#4B5E73] truncate">{h.sub}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </Screen>
  );
}
