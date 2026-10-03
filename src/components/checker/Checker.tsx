"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/domain/verdict";
import { LIMITS, type Submission } from "@/lib/domain/submission";
import { requestAnalysis } from "@/lib/client/api";
import { resizeImage } from "@/lib/client/resize-image";
import { SAMPLES, type Sample } from "@/lib/samples";
import { VerdictView } from "@/components/verdict/VerdictView";

type Status =
  | { kind: "idle" }
  | { kind: "loading"; step: string }
  | { kind: "error"; message: string; field?: "message" }
  | { kind: "done"; verdict: Verdict };

const STEP_INTERVAL_MS = 1600;
const COUNTER_FROM = Math.round(LIMITS.textChars * 0.8);
const LABEL_WORDS = { scam: "Scam", suspicious: "Suspicious", likely_safe: "Likely safe" } as const;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Checker() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status.kind === "loading" || status.kind === "idle") return;
    if (status.kind === "error" && status.field === "message") {
      messageRef.current?.focus();
      return;
    }
    resultRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    document.getElementById("verdict-heading")?.focus({ preventScroll: true });
  }, [status]);

  useEffect(() => () => stopTimer(), []);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function run(submission: Submission) {
    controller.current?.abort();
    stopTimer();
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
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" }));
    timer.current = setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setStatus((s) => (s.kind === "loading" ? { kind: "loading", step: steps[index] } : s));
    }, STEP_INTERVAL_MS);

    const result = await requestAnalysis(submission, abort.signal);
    if (abort.signal.aborted) return;
    stopTimer();
    setStatus(
      result.ok
        ? { kind: "done", verdict: result.verdict }
        : { kind: "error", message: `${result.message} Your message is still in the box.` },
    );
  }

  function cancel() {
    controller.current?.abort();
    stopTimer();
    setStatus({ kind: "idle" });
  }

  const loading = status.kind === "loading";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const submission: Submission = {
      text: text.trim() || undefined,
      url: url.trim() || undefined,
      headers: headers.trim() || undefined,
      image: image?.dataUrl,
    };
    if (!submission.text && !submission.url && !submission.headers && !submission.image) {
      setStatus({ kind: "error", field: "message", message: "Paste a message, a link, email headers or a screenshot to check." });
      return;
    }
    void run(submission);
  }

  function loadSample(sample: Sample) {
    if (loading) return;
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

  const messageError = status.kind === "error" && status.field === "message";
  const announcement =
    status.kind === "loading"
      ? `Checking: ${status.step}`
      : status.kind === "done"
        ? `Result: ${LABEL_WORDS[status.verdict.label]}, risk ${status.verdict.riskScore} out of 100. Verification steps below.`
        : "";
  const linkClass = "inline-flex min-h-11 items-center px-1 font-medium underline decoration-rule-strong underline-offset-4 hover:decoration-ink";

  return (
    <div className="space-y-[var(--space-section)]">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <form onSubmit={onSubmit} aria-label="Check a message" className="relative rounded-sm border border-rule bg-paper-raised p-5 shadow-[var(--shadow)] sm:p-7">
        <label htmlFor="message" className="block font-display text-2xl">
          Paste the suspicious message
        </label>
        <p id="message-hint" className="mt-1 text-sm text-ink-soft">
          A text, email, DM or what a caller said. Card numbers and codes are hidden before our AI sees anything.
        </p>
        <textarea
          id="message"
          ref={messageRef}
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={messageError ? "message-hint message-error" : "message-hint"}
          aria-invalid={messageError || undefined}
          maxLength={LIMITS.textChars}
          rows={6}
          placeholder="e.g. “USPS: your parcel is on hold, pay $1.99 at …”"
          className="mt-4 w-full resize-y rounded-sm border border-rule-strong bg-paper p-4 font-mono text-[0.95rem] leading-7 placeholder:text-ink-faint focus-visible:border-ink"
        />
        {text.length >= COUNTER_FROM && (
          <p className="mt-1 text-right text-xs text-ink-faint">
            {text.length.toLocaleString("en-US")} / {LIMITS.textChars.toLocaleString("en-US")}
          </p>
        )}
        {messageError && (
          <p id="message-error" role="alert" className="mt-2 text-sm font-medium text-scam">
            {status.message}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm">
          <button type="button" aria-expanded={showMore} aria-controls="more-inputs" onClick={() => setShowMore((v) => !v)} className={linkClass}>
            {showMore ? "− Hide" : "+ Add"} a link or email headers
          </button>
          <label className={`${linkClass} cursor-pointer rounded-sm focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]`}>
            {image ? "Replace screenshot" : "+ Upload a screenshot"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="sr-only" data-testid="screenshot-input" />
          </label>
          {image && (
            <span className="inline-flex items-center gap-1 rounded-full bg-paper-sunk py-0.5 pl-3 pr-1 text-ink-soft">
              🖼 {image.name}
              <button type="button" onClick={() => setImage(null)} aria-label="Remove screenshot" className="inline-flex size-8 items-center justify-center rounded-full font-bold hover:text-ink">
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
              <input id="url" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} maxLength={LIMITS.urlChars} placeholder="paste it — we never open it" className="mt-1 w-full rounded-sm border border-rule-strong bg-paper px-3 py-2.5 font-mono text-sm focus-visible:border-ink" />
            </div>
            <div>
              <label htmlFor="headers" className="text-sm font-semibold">
                Email headers <span className="font-normal text-ink-faint">(optional, “Show original”)</span>
              </label>
              <textarea id="headers" autoCapitalize="off" spellCheck={false} value={headers} onChange={(e) => setHeaders(e.target.value)} maxLength={LIMITS.headersChars} rows={3} placeholder="From: … Reply-To: … Authentication-Results: …" className="mt-1 w-full rounded-sm border border-rule-strong bg-paper px-3 py-2 font-mono text-xs focus-visible:border-ink" />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" aria-disabled={loading} className="min-h-11 rounded-sm bg-ink px-6 py-3 text-base font-semibold text-paper transition-transform duration-[var(--duration-fast)] hover:-translate-y-0.5 active:translate-y-0 aria-disabled:cursor-wait aria-disabled:opacity-70">
            {loading ? "Checking…" : "Check this message"}
          </button>
          {loading && (
            <button type="button" onClick={cancel} className={linkClass}>
              Cancel
            </button>
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
              <button type="button" onClick={() => loadSample(sample)} aria-disabled={loading} className="min-h-11 rounded-sm border border-rule-strong bg-paper px-3 py-2 text-left text-sm transition-colors duration-[var(--duration-fast)] hover:border-ink hover:bg-paper-raised aria-disabled:opacity-60">
                <span className="block font-semibold">{sample.label}</span>
                <span className="block text-xs text-ink-faint">{sample.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div ref={resultRef} className="scroll-mt-6">
        {status.kind === "loading" && (
          <div aria-hidden="true" className="flex min-h-48 items-center gap-4 rounded-sm border border-dashed border-rule-strong p-6 text-ink-soft">
            <span className="inline-block size-3 animate-pulse rounded-full bg-scam motion-reduce:animate-none" />
            <p className="font-display text-2xl">{status.step}</p>
          </div>
        )}
        {status.kind === "error" && !messageError && (
          <p role="alert" className="rounded-sm border-l-4 border-scam bg-scam-wash px-4 py-3 font-medium">
            {status.message}
          </p>
        )}
        {status.kind === "done" && (
          <div className="space-y-[var(--space-section)]">
            <VerdictView verdict={status.verdict} />
            {status.verdict.label !== "likely_safe" && (
              <a href="#help" className="inline-flex min-h-11 items-center rounded-sm border-2 border-scam px-5 py-3 font-semibold text-scam transition-colors duration-[var(--duration-fast)] hover:bg-scam hover:text-paper">
                Already clicked, paid or shared something? Get recovery steps →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
