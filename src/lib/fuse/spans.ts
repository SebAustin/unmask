import type { RedFlag } from "@/lib/domain/verdict";

export interface CandidateFlag {
  readonly quote: string;
  readonly explanation: string;
  readonly source: RedFlag["source"];
}

/**
 * Anchors Red Flags to the Exhibit. Only quotes that appear verbatim (ignoring case) survive,
 * so nothing invented by the model is ever highlighted.
 */
export function matchSpans(candidates: readonly CandidateFlag[], exhibit: string): RedFlag[] {
  const kept: RedFlag[] = [];
  for (const candidate of candidates) {
    const needle = candidate.quote.trim();
    if (!needle) continue;
    // Search the original string: toLowerCase() can change length ("İ") and shift offsets.
    const match = new RegExp(escapeRegExp(needle), "i").exec(exhibit);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (kept.some((flag) => start < flag.end && flag.start < end)) continue;
    kept.push({
      quote: exhibit.slice(start, end),
      explanation: candidate.explanation,
      source: candidate.source,
      start,
      end,
    });
  }
  return kept.sort((a, b) => a.start - b.start);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
