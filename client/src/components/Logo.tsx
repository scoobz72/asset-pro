import { cn } from "@/lib/utils";

/** Brand colours, matching the myCMMS logo artwork. */
export const BRAND_NAVY = "#102A45";
export const BRAND_AMBER = "#F59E0B";

const TEETH = 14;

/**
 * The myCMMS cog-and-tick mark. The cog uses `currentColor`, so it follows the text
 * colour (navy on light backgrounds, white in dark mode) unless `cogColor` is given.
 */
export function LogoMark({
  className,
  cogColor = "currentColor",
  tickColor = BRAND_AMBER,
  title,
}: {
  className?: string;
  cogColor?: string;
  tickColor?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g fill={cogColor}>
        {Array.from({ length: TEETH }, (_, i) => (
          <rect key={i} x="44.5" y="2" width="11" height="14" rx="1.5" transform={`rotate(${(360 / TEETH) * i} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="33" />
      </g>
      <path d="M36 51 L46 61 L65 40" fill="none" stroke={tickColor} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The simple app icon: navy cog with a white tick on an amber rounded square. */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-[22%] shrink-0", className)}
      style={{ backgroundColor: BRAND_AMBER }}
    >
      <LogoMark className="size-[72%]" cogColor={BRAND_NAVY} tickColor="#FFFFFF" title="myCMMS" />
    </span>
  );
}

/**
 * The full "myCMMS.co.uk" lockup for the main screens (home page, sign-in).
 * Sized by font size: set `className="text-3xl"` etc.
 */
export function LogoFull({ className, showDomain = true }: { className?: string; showDomain?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-[0.35em] leading-none text-[#102A45] dark:text-white select-none", className)}
      aria-label={showDomain ? "myCMMS.co.uk" : "myCMMS"}
      role="img"
    >
      <LogoMark className="h-[1.45em] w-[1.45em] shrink-0" />
      <span aria-hidden className="tracking-tight whitespace-nowrap">
        <span className="font-normal">my</span>
        <span className="font-extrabold">CMMS</span>
        {showDomain && <span className="text-[0.42em] font-medium text-slate-500 dark:text-slate-400">.co.uk</span>}
      </span>
    </span>
  );
}
