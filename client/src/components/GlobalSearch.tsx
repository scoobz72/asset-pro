import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, Wrench, Box, Package, ShoppingCart, Truck, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { matchesSearch, searchWords } from "@/lib/search";
import { useQuery } from "@tanstack/react-query";

type Hit = { key: string; group: string; icon: typeof Search; title: string; sub: string; href: string };
const PER_GROUP = 5;

/** Header search: jobs, assets, parts, purchase orders and suppliers, with "See all" per type. */
export function GlobalSearch({ className }: { className?: string }) {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const enabled = open && searchWords(q).length > 0;

  // Same query keys as the pages, so the cache is shared. Nothing loads until the box is used.
  const [armed, setArmed] = useState(false);
  const useList = (key: string) => (useQuery<any[]>({ queryKey: [key], enabled: armed }).data ?? []);
  const jobs = useList("/api/jobs");
  const assets = useList("/api/assets");
  const parts = useList("/api/inventory");
  const pos = useList("/api/purchase-orders");
  const suppliers = useList("/api/suppliers");

  const { hits, more } = useMemo(() => {
    if (!enabled) return { hits: [] as Hit[], more: [] as { label: string; href: string; count: number }[] };
    const enc = encodeURIComponent(q.trim());
    const groups: { label: string; all: string; rows: Hit[] }[] = [
      {
        label: "Jobs", all: `/jobs?q=${enc}`,
        rows: jobs.filter((j) => matchesSearch(q, j.id, j.title, j.assetId, assets.find((a) => a.id === j.assetId)?.name, j.type, j.status, j.description))
          .map((j) => ({ key: `job-${j.id}`, group: "Jobs", icon: Wrench, title: j.title, sub: `${j.id} · ${j.status}`, href: `/jobs/${encodeURIComponent(j.id)}` })),
      },
      {
        label: "Assets", all: `/assets?q=${enc}`,
        rows: assets.filter((a) => matchesSearch(q, a.id, a.name, a.category, a.manufacturer, a.model, a.serialNumber, a.locationId))
          .map((a) => ({ key: `asset-${a.id}`, group: "Assets", icon: Box, title: a.name, sub: `${a.id} · ${a.status}`, href: `/assets?q=${encodeURIComponent(a.id)}` })),
      },
      {
        label: "Parts", all: `/inventory?q=${enc}`,
        rows: parts.filter((p) => matchesSearch(q, p.id, p.name, p.category, p.manufacturerPartNo, p.binId))
          .map((p) => ({ key: `part-${p.id}`, group: "Parts", icon: Package, title: p.name, sub: `${p.id} · ${p.stock} ${p.unit} in stock`, href: `/inventory?q=${encodeURIComponent(p.id)}` })),
      },
      {
        label: "Purchase orders", all: `/purchase-orders?q=${enc}`,
        rows: pos.filter((po) => matchesSearch(q, po.id, po.vendor, po.jobId, po.status, po.requestedBy))
          .map((po) => ({ key: `po-${po.id}`, group: "Purchase orders", icon: ShoppingCart, title: `${po.id} · ${po.vendor}`, sub: po.status, href: `/purchase-orders/${encodeURIComponent(po.id)}` })),
      },
      {
        label: "Suppliers", all: `/suppliers?q=${enc}`,
        rows: suppliers.filter((s) => matchesSearch(q, s.id, s.name, s.categories ?? [], s.contactName, s.email))
          .map((s) => ({ key: `sup-${s.id}`, group: "Suppliers", icon: Truck, title: s.name, sub: (s.categories ?? []).join(", ") || s.id, href: `/suppliers?q=${encodeURIComponent(s.name)}` })),
      },
    ];
    return {
      hits: groups.flatMap((g) => g.rows.slice(0, PER_GROUP)),
      more: groups.filter((g) => g.rows.length > PER_GROUP).map((g) => ({ label: g.label, href: g.all, count: g.rows.length })),
    };
  }, [enabled, q, jobs, assets, parts, pos, suppliers]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href: string) => { setOpen(false); setQ(""); navigate(href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); go(hits[active].href); }
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        placeholder="Search jobs, assets, parts, POs..."
        className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setArmed(true); setOpen(true); }}
        onKeyDown={onKey}
        aria-label="Search"
        data-testid="input-global-search"
      />
      {enabled && (
        <div className="absolute z-50 mt-1 w-[26rem] max-w-[90vw] rounded-md border bg-popover text-popover-foreground shadow-lg max-h-[70vh] overflow-y-auto">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing matches "{q.trim()}".</p>
          ) : (
            <ul className="py-1">
              {hits.map((h, i) => {
                const first = i === 0 || hits[i - 1].group !== h.group;
                return (
                  <li key={h.key}>
                    {first && <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h.group}</div>}
                    <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h.href)}
                      className={cn("w-full flex items-center gap-3 px-3 py-1.5 text-left", i === active && "bg-muted")}>
                      <h.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm truncate">{h.title}</span>
                        <span className="block text-xs text-muted-foreground truncate">{h.sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {more.length > 0 && (
            <div className="border-t p-1">
              {more.map((m) => (
                <button key={m.href} type="button" onClick={() => go(m.href)} className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted rounded">
                  <span>See all {m.count} {m.label.toLowerCase()}</span><ArrowRight className="size-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
