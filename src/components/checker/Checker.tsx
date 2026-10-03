"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/domain/verdict";
import { LIMITS, type Submission } from "@/lib/domain/submission";
import { requestAnalysis } from "@/lib/client/api";
import { resizeImage } from "@/lib/client/resize-image";
import { SAMPLES, type Sample } from "@/lib/samples";
import { VerdictView } from "@/components/verdict/VerdictView";

type Status = { kind: "idle" } | { kind: "loading"; step: string } | { kind: "error"; message: string } | { kind: "done"; verdict: Verdict };

const STEP_INTERVAL_MS = 1600;

export function Checker() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status.kind === "done" || status.kind === "error") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [status.kind]);

  async function run(submission: Submission) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    const steps = [
      ...(submission.image ? ["Reading the screenshot…"] : []),
      "Checking links, senders and wording…",
      "Asking our AI analyst…",
      "Writing up the verdict…",
    ];
    let index = 0;
    setStatus({ kind: "loading", step: steps[0] });
    const timer = setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setStatus((s) => (s.kind === "loading" ? { kind: "loading", step: steps[index] } : s));
    }, STEP_INTERVAL_MS);

    const result = await requestAnalysis(submission, abort.signal);
    clearInterval(timer);
    if (abort.signal.aborted) return;
    setStatus(result.ok ? { kind: "done", verdict: result.verdict } : { kind: "error", message: result.message });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const submission: Submission = {
      text: text.trim() || undefined,
      url: url.trim() || undefined,
      headers: headers.trim() || undefined,
      image: image?.dataUrl,
    };
    if (!submission.text && !submission.url && !submission.headers && !submission.image) {
      setStatus({ kind: "error", message: "Paste a message, a link, email headers or a screenshot to check." });
      return;
    }
    void run(submission);
  }

  function loadSample(sample: Sample) {
    setText(sample.text ?? "");
    setUrl(sample.url ?? "");
    setHeaders(sample.headers ?? "");
    setImage(null);
    setShowMore(Boolean(sample.url || sample.headers));
    void run({ text: sample.text, url: sample.url, headers: sample.headers });
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImage({ dataUrl: await resizeImage(file), name: file.name });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  }

  const loading = status.kind === "loading";

  return (
    <div className="space-y-[var(--space-section)]">
      <form onSubmit={onSubmit} aria-label="Check a message" className="relative rounded-sm border border-rule bg-paper-raised p-5 shadow-[var(--shadow)] sm:p-7">
        <label htmlFor="message" className="block font-display text-2xl">
          Paste the suspicious message
        </label>
        <p id="message-hint" className="mt-1 text-sm text-ink-soft">
          A text, email, DM or what a caller said. Card numbers and codes are hidden before our AI sees anything.
        </p>
        <textarea
          id="message"
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="message-hint"
          maxLength={LIMITS.textChars}
          rows={6}
          placeholder="e.g. “USPS: your parcel is on hold, pay $1.99 at …”"
          className="mt-4 w-full resize-y rounded-sm border border-rule bg-paper p-4 font-mono text-[0.95rem] leading-7 placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <button type="button" aria-expanded={showMore} aria-controls="more-inputs" onClick={() => setShowMore((v) => !v)} className="font-medium underline decoration-rule underline-offset-4 hover:decoration-ink">
            {showMore ? "− Hide" : "+ Add"} a link or email headers
          </button>
          <label className="cursor-pointer font-medium underline decoration-rule underline-offset-4 hover:decoration-ink">
            {image ? "Replace screenshot" : "+ Upload a screenshot"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="sr-only" data-testid="screenshot-input" />
          </label>
          {image && (
            <span className="inline-flex items-center gap-2 rounded-full bg-paper-sunk px-3 py-1 text-ink-soft">
              🖼 {image.name}
              <button type="button" onClick={() => setImage(null)} aria-label="Remove screenshot" className="font-bold hover:text-ink">
                ×
              </button>
            </span>
          )}
        </div>
        {image && (
          <p className="mt-2 text-xs text-ink-faint">
            Screenshots are sent to our AI as-is (we can&apos;t blur pixels), so crop out card numbers or codes first. Nothing is stored.
          </p>
        )}

        {showMore && (
          <div id="more-inputs" className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="url" className="text-sm font-semibold">
                Link from the message
              </label>
              <input id="url" type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={LIMITS.urlChars} placeholder="paste it — we never open it" className="mt-1 w-full rounded-sm border border-rule bg-paper px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none" />
            </div>
            <div>
              <label htmlFor="headers" className="text-sm font-semibold">
                Email headers <span className="font-normal text-ink-faint">(optional, “Show original”)</span>
              </label>
              <textarea id="headers" value={headers} onChange={(e) => setHeaders(e.target.value)} maxLength={LIMITS.headersChars} rows={3} placeholder="From: … Reply-To: … Authentication-Results: …" className="mt-1 w-full rounded-sm border border-rule bg-paper px-3 py-2 font-mono text-xs focus:border-ink focus:outline-none" />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={loading} className="group relative rounded-sm bg-ink px-6 py-3 text-base font-semibold text-paper transition-transform duration-[var(--duration-fast)] hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-wait disabled:opacity-70">
            {loading ? "Checking…" : "Unmask it"}
          </button>
          {loading && (
            <p role="status" aria-live="polite" className="text-sm text-ink-soft">
              <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-scam align-middle motion-reduce:animate-none" />
              {status.step}
            </p>
          )}
        </div>
      </form>

      <section aria-labelledby="samples-heading" className="-mt-[calc(var(--space-section)/2)]">
        <h2 id="samples-heading" className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Or try a real-world example
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <li key={sample.id}>
              <button type="button" onClick={() => loadSample(sample)} disabled={loading} className="group rounded-sm border border-rule bg-paper px-3 py-2 text-left text-sm transition-colors duration-[var(--duration-fast)] hover:border-ink hover:bg-paper-raised disabled:opacity-60">
                <span className="block font-semibold">{sample.label}</span>
                <span className="block text-xs text-ink-faint">{sample.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div ref={resultRef} tabIndex={-1} className="scroll-mt-6 outline-none">
        {status.kind === "error" && (
          <p role="alert" className="rounded-sm border-l-4 border-scam bg-scam-wash px-4 py-3 font-medium">
            {status.message}
          </p>
        )}
        {status.kind === "done" && (
          <div className="space-y-[var(--space-section)]">
            <VerdictView verdict={status.verdict} />
            {status.verdict.label !== "likely_safe" && (
              <a href="#help" className="inline-block rounded-sm border-2 border-scam px-5 py-3 font-semibold text-scam transition-colors duration-[var(--duration-fast)] hover:bg-scam hover:text-paper">
                Already clicked, paid or shared something? Get recovery steps →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
