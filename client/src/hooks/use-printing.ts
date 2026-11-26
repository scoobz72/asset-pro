import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * True while the browser is printing (or saving as PDF). Charts use it to draw at a fixed
 * size, because responsive charts are measured for the screen and come out wrong on paper.
 */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    // The browser takes its print snapshot straight after "beforeprint", so render now.
    const on = () => flushSync(() => setPrinting(true));
    const off = () => setPrinting(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    const mq = window.matchMedia?.("print");
    const onChange = (e: MediaQueryListEvent) => (e.matches ? on() : off());
    mq?.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
      mq?.removeEventListener?.("change", onChange);
    };
  }, []);
  return printing;
}
