"use client";

import { useState } from "react";
import { INTERNATIONAL_NOTE, RECOVERY_GUIDES, REPORT_LINKS, type EngagementAction } from "@/lib/respond/recovery";

/** "I already clicked / paid / shared" — ordered steps by action, always available (FR-10). */
export function RecoveryPanel() {
  const [action, setAction] = useState<EngagementAction | null>(null);
  const guide = RECOVERY_GUIDES.find((g) => g.action === action);

  return (
    <section aria-labelledby="recovery-heading" className="space-y-5">
      <div>
        <h2 id="recovery-heading" className="font-display text-[length:var(--text-title)] leading-tight">
          Already clicked, paid or shared something?
        </h2>
        <p className="mt-1 text-ink-soft">Act fast — the first hour matters most. Pick what happened:</p>
      </div>
      <div role="radiogroup" aria-label="What happened" className="flex flex-wrap gap-2">
        {RECOVERY_GUIDES.map((g) => (
          <button
            key={g.action}
            type="button"
            role="radio"
            aria-checked={action === g.action}
            onClick={() => setAction(g.action)}
            className="rounded-full border border-rule bg-paper-raised px-3.5 py-1.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:border-ink-soft aria-checked:border-ink aria-checked:bg-ink aria-checked:text-paper"
          >
            {g.label}
          </button>
        ))}
      </div>

      {guide && (
        <div className="animate-rise rounded-sm border-l-4 border-scam bg-paper-raised p-5 shadow-[var(--shadow)]">
          <h3 className="font-semibold">{guide.label} — do this now:</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 leading-snug">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-5 border-t border-rule pt-4">
            <p className="text-sm font-semibold">Report it</p>
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {REPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">{INTERNATIONAL_NOTE}</p>
          </div>
        </div>
      )}
    </section>
  );
}
