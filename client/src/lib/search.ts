import { useEffect, useState } from "react";
import { useSearch } from "wouter";

/**
 * One search rule for every list in the app.
 * - Ignores case, extra spaces and missing (null) fields, so imported rows with blanks never break it.
 * - Every word typed must appear somewhere in the record's fields: "pump line 9" finds a pump on LINE 9.
 */
export type Searchable = string | number | null | undefined | readonly (string | null | undefined)[];

export function searchWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesSearch(query: string, ...fields: Searchable[]): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const haystack = fields
    .flatMap((f) => (Array.isArray(f) ? f : [f]))
    .filter((f) => f !== null && f !== undefined && f !== "")
    .map((f) => String(f).toLowerCase())
    .join(" \u0001 ");
  return words.every((w) => haystack.includes(w));
}

/**
 * A page's search box, started from (and kept in step with) "?q=" in the address,
 * so the header search's "See all" opens the page already filtered.
 */
export function useSearchParam(): [string, (v: string) => void] {
  const search = useSearch();
  const fromUrl = new URLSearchParams(search).get("q") ?? "";
  const [value, setValue] = useState(fromUrl);
  useEffect(() => { setValue(fromUrl); }, [fromUrl]);
  return [value, setValue];
}
