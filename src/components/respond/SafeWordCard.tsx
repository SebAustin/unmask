"use client";

import { useState } from "react";
import { generateSafeWord } from "@/lib/respond/safe-word";

/** Family Safe Word generator. Runs entirely in the browser; nothing is sent anywhere (FR-11). */
export function SafeWordCard() {
  const [word, setWord] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!word) return;
    try {
      await navigator.clipboard.writeText(word);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="safeword-heading" className="relative overflow-hidden rounded-sm bg-ink p-7 text-paper shadow-[var(--shadow)] sm:p-9">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-paper/60">Beat AI voice clones</p>
      <h2 id="safeword-heading" className="mt-2 font-display text-[length:var(--text-title)] leading-tight">
        Make a family safe word
      </h2>
      <p className="mt-3 max-w-prose text-paper/80">
        Scammers can clone a loved one&apos;s voice from a few seconds of audio. Agree on a phrase in person. If an urgent call
        doesn&apos;t know it, hang up and call them back on the number you already have.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setWord(generateSafeWord())}
          className="rounded-sm bg-paper px-4 py-2.5 font-semibold text-ink transition-transform duration-[var(--duration-fast)] hover:-translate-y-0.5 active:translate-y-0"
        >
          {word ? "Generate another" : "Generate a safe word"}
        </button>
        {word && (
          <>
            <output aria-live="polite" data-testid="safe-word" className="font-display text-3xl italic tracking-wide">
              “{word}”
            </output>
            <button type="button" onClick={copy} className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-paper/50">Generated on your device. Share it in person, never by text or email.</p>
    </section>
  );
}
