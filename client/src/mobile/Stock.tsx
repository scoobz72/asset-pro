import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useBins, useInventory } from "@/hooks/use-data";
import { matchesSearch } from "@/lib/search";
import { HOME_CURRENCY, formatMoney } from "@shared/constants";
import { cn } from "@/lib/utils";
import { Btn, Card, Chip, Empty, Field, Icon, Screen, Sheet, Spinner, TopBar, enc, inputCls, post, refreshMobile, useRun } from "./ui";
import type { MyDay } from "./Today";

type Part = { id: string; name: string; category: string | null; stock: number; minStock: number; unit: string; unitCost: string | null; binId: string | null; manufacturerPartNo: string | null; primarySupplierId: string | null };
type Common = { id: string; name: string; stock: number; unit: string; timesUsed: number }[];

const money = (v: number) => formatMoney(v, HOME_CURRENCY).replace(` ${HOME_CURRENCY}`, "");

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex gap-2">
      <label className="relative flex-1">
        <span className="sr-only">Search</span>
        <Icon name="search" className="absolute left-3 top-3.5 text-[#4B5E73]" />
        <input className={cn(inputCls, "pl-10")} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </label>
      <Link href="/m/scan" aria-label="Scan a label" className="size-12 rounded-xl bg-[#102A45] text-[#F59E0B] flex items-center justify-center"><Icon name="scan" strokeWidth={2.2} /></Link>
    </div>
  );
}

function PartRow({ p, href, right }: { p: Part | Common[number]; href: string; right?: React.ReactNode }) {
  const low = "minStock" in p && p.stock <= p.minStock;
  return (
    <Link href={href} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 min-h-16 active:bg-[#F9FAFB]">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold truncate">{p.name}</span>
        <span className="block text-xs text-[#4B5E73] truncate"><span className="font-mono">{p.id}</span>{"binId" in p && p.binId ? ` · ${p.binId}` : ""}{"timesUsed" in p ? ` · used ${p.timesUsed}× on this asset` : ""}</span>
      </span>
      {right ?? <span className={cn("text-sm font-semibold whitespace-nowrap", p.stock <= 0 ? "text-red-700" : low ? "text-[#B45309]" : "")}>{p.stock} {p.unit}</span>}
    </Link>
  );
}

/* --------------------------------------------------------------- stock list */

export function StockList() {
  const params = new URLSearchParams(useSearch());
  const assetId = params.get("asset");
  const { data: parts = [], isLoading } = useInventory();
  const { data: common = [] } = useQuery<Common>({ queryKey: ["/api/assets", enc(assetId ?? ""), "common-parts"], enabled: !!assetId });
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(params.get("low") === "1");
  const list = useMemo(() => (parts as Part[])
    .filter((p) => (!lowOnly || p.stock <= p.minStock) && matchesSearch(q, p.id, p.name, p.category, p.manufacturerPartNo, p.binId))
    .slice(0, 100), [parts, q, lowOnly]);
  const lowCount = (parts as Part[]).filter((p) => p.stock <= p.minStock).length;

  return (
    <Screen header={<TopBar title="Stock" sub={assetId ? `Parts for ${assetId}` : `${(parts as Part[]).length} parts`} />}>
      <div className="p-4 flex flex-col gap-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Part name, number or bin" />
        <div className="flex gap-2">
          <button type="button" aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)} className={cn("min-h-9 px-3 rounded-full text-sm font-semibold", lowOnly ? "bg-[#102A45] text-white" : "bg-white")}>Low stock {lowCount}</button>
        </div>
        {assetId && common.length > 0 && !q && (
          <>
            <h2 className="text-[13px] font-semibold text-[#4B5E73] mt-1">Often used on {assetId}</h2>
            {common.map((p) => <PartRow key={`c-${p.id}`} p={p} href={`/m/part/${enc(p.id)}`} />)}
            <h2 className="text-[13px] font-semibold text-[#4B5E73] mt-2">All parts</h2>
          </>
        )}
        {isLoading ? <Spinner /> : list.length === 0 ? <Empty icon="box" title="No parts match" /> : list.map((p) => <PartRow key={p.id} p={p} href={`/m/part/${enc(p.id)}`} />)}
        {list.length === 100 && <p className="text-center text-xs text-[#4B5E73]">Showing the first 100. Search to narrow it down.</p>}
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- part page */

export function PartPage() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw ?? "");
  const { data: parts = [], isLoading } = useInventory();
  const { data: day } = useQuery<MyDay>({ queryKey: ["/api/me/today"] });
  const part = (parts as Part[]).find((p) => p.id.toLowerCase() === id.toLowerCase());
  const [mode, setMode] = useState<null | "issue" | "return">(null);
  const [qty, setQty] = useState(1);
  const [jobId, setJobId] = useState("");
  const { busy, run } = useRun();

  if (isLoading) return <Screen header={<TopBar title="Part" back="/m/stock" />}><Spinner /></Screen>;
  if (!part) return <Screen header={<TopBar title="Part" back="/m/stock" />}><Empty icon="search" title={`No part ${id}`} /></Screen>;
  const myJobs = day?.jobs ?? [];
  const move = async () => {
    const type = mode === "issue" ? "Job Issue" : "Return to Stores";
    const ok = await run(() => post("/api/stock/movements", { partId: part.id, type, quantity: qty, jobId: jobId || null }),
      mode === "issue" ? `${qty} issued${jobId ? ` to ${jobId}` : ""}` : `${qty} returned to stores`);
    if (ok !== undefined) { setMode(null); setQty(1); refreshMobile(); }
  };

  return (
    <Screen header={<TopBar title={part.name} sub={part.id} back="/m/stock" />}
      footer={<div className="grid grid-cols-2 gap-2.5"><Btn variant="outline" className="h-[52px]" onClick={() => { setMode("return"); setQty(1); setJobId(""); }}><Icon name="undo" /> Return</Btn><Btn className="h-[52px]" disabled={part.stock <= 0} onClick={() => { setMode("issue"); setQty(1); setJobId(myJobs.find((j) => j.status === "In Progress")?.id ?? ""); }}><Icon name="plus" /> Issue</Btn></div>}>
      <div className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["In stock", `${part.stock}`], ["Minimum", `${part.minStock}`], ["Unit cost", part.unitCost ? money(Number(part.unitCost)) : "—"]].map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl py-3"><p className="text-[11px] text-[#4B5E73]">{k}</p><p className={cn("text-xl font-bold", k === "In stock" && part.stock <= part.minStock && "text-[#B45309]")}>{v}</p></div>
          ))}
        </div>
        {part.stock <= part.minStock && <p className="rounded-xl bg-[#FEF3C7] text-[#78350F] text-sm p-3">At or below minimum. It shows in purchasing's restock suggestions.</p>}
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {[["Bin", part.binId], ["Category", part.category], ["Maker's part no.", part.manufacturerPartNo], ["Unit", part.unit]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="contents"><dt className="text-[#4B5E73]">{k}</dt><dd className="font-medium break-words">{k === "Bin" ? <Link href={`/m/bin/${enc(v as string)}`} className="underline">{v}</Link> : v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <Sheet open={!!mode} onClose={() => setMode(null)} title={mode === "issue" ? `Issue ${part.name}` : `Return ${part.name}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Quantity</span>
            <div className="flex items-center gap-1">
              <Btn variant="soft" className="size-12 p-0 text-2xl" aria-label="One fewer" onClick={() => setQty(Math.max(1, qty - 1))}>−</Btn>
              <span className="w-14 text-center text-2xl font-bold" aria-live="polite">{qty}</span>
              <Btn variant="soft" className="size-12 p-0 text-2xl" aria-label="One more" onClick={() => setQty(mode === "issue" ? Math.min(part.stock, qty + 1) : qty + 1)}>+</Btn>
            </div>
          </div>
          <Field label={mode === "issue" ? "To job" : "From job (optional)"}>
            <select className={inputCls} value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">{mode === "issue" ? "No job (general use)" : "Not from a job"}</option>
              {myJobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.title}</option>)}
            </select>
          </Field>
          {mode === "issue" && part.stock - qty < part.minStock && <p className="rounded-xl bg-[#FEF3C7] text-[#78350F] text-sm p-3">Stock will be {part.stock - qty}, below the minimum of {part.minStock}.</p>}
          <Btn className="h-12" disabled={busy || (mode === "issue" && qty > part.stock)} onClick={move}>{mode === "issue" ? `Issue ${qty}` : `Return ${qty}`}</Btn>
        </div>
      </Sheet>
    </Screen>
  );
}

/* --------------------------------------------------------------- bin page */

export function BinPage() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw ?? "");
  const { data: parts = [], isLoading } = useInventory();
  const { data: bins = [] } = useBins();
  const bin = (bins as any[]).find((b) => b.id.toLowerCase() === id.toLowerCase());
  const inBin = (parts as Part[]).filter((p) => (p.binId ?? "").toLowerCase() === id.toLowerCase());
  return (
    <Screen header={<TopBar title={`Bin ${bin?.id ?? id}`} sub={bin?.description ?? undefined} back="/m/stock" />}>
      <div className="p-4 flex flex-col gap-2.5">
        {isLoading ? <Spinner /> : inBin.length === 0 ? <Empty icon="box" title="Nothing recorded in this bin" /> : inBin.map((p) => <PartRow key={p.id} p={p} href={`/m/part/${enc(p.id)}`} />)}
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- issue to a job */

export function IssueToJob() {
  const { jobId: raw } = useParams<{ jobId: string }>();
  const jobId = decodeURIComponent(raw ?? "");
  const [, navigate] = useLocation();
  const { data: parts = [] } = useInventory();
  const { data: job } = useQuery<{ id: string; title: string; assetId: string | null; assetName: string | null }>({ queryKey: ["/api/jobs", enc(jobId), "record"] });
  const { data: common = [] } = useQuery<Common>({ queryKey: ["/api/assets", enc(job?.assetId ?? ""), "common-parts"], enabled: !!job?.assetId });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Part | null>(null);
  const [qty, setQty] = useState(1);
  const { busy, run } = useRun();
  const list = useMemo(() => (q.trim() ? (parts as Part[]).filter((p) => matchesSearch(q, p.id, p.name, p.category, p.manufacturerPartNo, p.binId)).slice(0, 40) : []), [parts, q]);
  const pick = (id: string) => { const p = (parts as Part[]).find((x) => x.id === id); if (p) { setPicked(p); setQty(1); } };
  const issue = async () => {
    if (!picked) return;
    const ok = await run(() => post("/api/stock/movements", { partId: picked.id, type: "Job Issue", quantity: qty, jobId }), `${qty} × ${picked.name} issued`);
    if (ok !== undefined) { refreshMobile(); navigate(`/m/job/${enc(jobId)}`); }
  };

  return (
    <Screen tabs={false} header={<TopBar title="Issue part" sub={<>to <span className="font-mono">{jobId}</span>{job?.assetName ? ` · ${job.assetName}` : ""}</>} back={`/m/job/${enc(jobId)}`} />}
      footer={picked ? <Btn className="w-full h-[52px] text-base" disabled={busy || qty > picked.stock} onClick={issue}>Issue {qty} to job · {money(qty * Number(picked.unitCost ?? 0))}</Btn> : undefined}>
      <div className="p-4 flex flex-col gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search parts" />
        {picked && (
          <Card className="border-2 border-[#F59E0B] flex flex-col gap-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="text-[17px] font-bold">{picked.name}</p><p className="text-[13px] text-[#4B5E73]"><span className="font-mono">{picked.id}</span>{picked.binId ? ` · Bin ${picked.binId}` : ""}</p></div>
              <button type="button" aria-label="Choose another part" onClick={() => setPicked(null)} className="size-9 flex items-center justify-center text-[#4B5E73]"><Icon name="close" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["In stock", picked.stock], ["Minimum", picked.minStock], ["Unit cost", picked.unitCost ? money(Number(picked.unitCost)) : "—"]].map(([k, v]) => (
                <div key={k as string} className="bg-[#F4F6F9] rounded-xl py-2"><p className="text-[11px] text-[#4B5E73]">{k}</p><p className="text-lg font-bold">{v}</p></div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Quantity</span>
              <div className="flex items-center gap-1">
                <Btn variant="soft" className="size-12 p-0 text-2xl" aria-label="One fewer" onClick={() => setQty(Math.max(1, qty - 1))}>−</Btn>
                <span className="w-14 text-center text-2xl font-bold" aria-live="polite">{qty}</span>
                <Btn variant="soft" className="size-12 p-0 text-2xl" aria-label="One more" onClick={() => setQty(Math.min(picked.stock, qty + 1))}>+</Btn>
              </div>
            </div>
            {picked.stock <= 0 ? <p className="rounded-xl bg-red-50 text-red-800 text-sm p-3">None in stock. Ask purchasing, or raise a PO for this job on the full site.</p>
              : picked.stock - qty < picked.minStock
                ? <p className="rounded-xl bg-[#FEF3C7] text-[#78350F] text-sm p-3">Stock will be <strong>{picked.stock - qty}</strong>, below the minimum of {picked.minStock}. It will show in restock suggestions.</p>
                : <p className="text-sm text-[#4B5E73]">Stock after issue: <strong className="text-[#102A45]">{picked.stock - qty}</strong></p>}
          </Card>
        )}
        {!q.trim() && !picked && common.length > 0 && (
          <>
            <h2 className="text-[13px] font-semibold text-[#4B5E73]">Often used on this asset</h2>
            {common.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p.id)} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 min-h-14 text-left">
                <span className="min-w-0"><span className="block font-semibold truncate">{p.name}</span><span className="text-xs text-[#4B5E73]">Used {p.timesUsed}× · {p.stock} {p.unit} in stock</span></span>
                <Icon name="plus" className="text-[#4B5E73]" />
              </button>
            ))}
          </>
        )}
        {!picked && list.map((p) => (
          <button key={p.id} type="button" onClick={() => pick(p.id)} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 min-h-14 text-left">
            <span className="min-w-0"><span className="block font-semibold truncate">{p.name}</span><span className="text-xs text-[#4B5E73]"><span className="font-mono">{p.id}</span>{p.binId ? ` · ${p.binId}` : ""}</span></span>
            <Chip tone={p.stock <= 0 ? "red" : p.stock <= p.minStock ? "amber" : "grey"}>{p.stock} {p.unit}</Chip>
          </button>
        ))}
        {!picked && q.trim() && list.length === 0 && <Empty icon="search" title="No parts match" />}
        {!picked && !q.trim() && common.length === 0 && <p className="text-sm text-[#4B5E73] text-center py-6">Search for a part, or scan its label.</p>}
      </div>
    </Screen>
  );
}
