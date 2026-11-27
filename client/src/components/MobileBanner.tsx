import { useState } from "react";
import { Link } from "wouter";
import { Smartphone, X } from "lucide-react";

const KEY = "mycmms.mobileBanner.dismissed";

/** On a phone, offer the mobile app (/m). Hidden once dismissed, and on wider screens. */
export function MobileBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
  };
  return (
    <div className="md:hidden print:hidden bg-[#F59E0B] text-[#102A45] text-sm px-3 py-2 flex items-center gap-2">
      <Smartphone className="size-4 shrink-0" />
      <span className="flex-1">On your phone? The mobile app is built for the shop floor.</span>
      <Link href="/m" className="font-semibold underline">Open</Link>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="p-1"><X className="size-4" /></button>
    </div>
  );
}
