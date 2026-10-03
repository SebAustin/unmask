import type { Verdict } from "@/lib/domain/verdict";
import { SCAM_TYPE_LABELS } from "@/lib/domain/verdict";
import { Exhibit } from "./Exhibit";

const LABEL_COPY = {
  scam: { word: "Scam", tone: "text-scam", line: "Treat this as fraud. Don't click, pay or reply." },
  suspicious: { word: "Suspicious", tone: "text-warn", line: "Don't act on it until you've verified it yourself." },
  likely_safe: {
    word: "Likely safe",
    tone: "text-safe",
    line: "We found no scam signals — that's not a guarantee. Stay careful with links and payments.",
  },
} as const;

const DEGRADED_COPY: Record<NonNullable<Verdict["degradedReason"]>, string> = {
  provider_error: "Our AI analyst is unavailable right now",
  timeout: "Our AI analyst took too long to answer",
  rate_limited: "Our AI analyst is busy right now",
  parse_failed: "Our AI analyst gave an unusable answer",
  not_configured: "The AI analyst isn't switched on right now",
};

export function VerdictView({ verdict }: { verdict: Verdict }) {
  const copy = LABEL_COPY[verdict.label];
  return (
    <article aria-labelledby="verdict-heading" className="animate-rise grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      <div className="min-w-0 space-y-8">
        <header className="flex flex-wrap items-start gap-x-8 gap-y-5">
          <h2
            id="verdict-heading"
            tabIndex={-1}
            className={`stamp animate-stamp inline-block max-w-full scroll-mt-6 rounded-sm px-4 py-2 font-display text-[clamp(2rem,11vw,3.75rem)] uppercase leading-none outline-none ${copy.tone}`}
          >
            {copy.word}
          </h2>
          <div className="min-w-[12rem] flex-1">
            <RiskMeter score={verdict.riskScore} tone={copy.tone} />
            <p className="mt-3 text-lg font-medium leading-snug">{copy.line}</p>
            <a href="#verify-heading" className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              What to do next: how to check safely ↓
            </a>
          </div>
        </header>

        {verdict.degraded && verdict.degradedReason && (
          <p className="rounded-sm border-l-4 border-warn bg-warn-wash px-4 py-3 text-sm">
            <strong>{DEGRADED_COPY[verdict.degradedReason]}.</strong> This verdict comes from our automatic checks only, so it
            may miss subtle scams.
          </p>
        )}

        <section aria-label="Summary" className="space-y-4">
          <p className="font-display text-2xl leading-snug sm:text-[1.7rem]">{verdict.summary}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-y border-rule py-4 text-sm sm:grid-cols-3">
            <Fact term="Type of scam" value={SCAM_TYPE_LABELS[verdict.scamType]} />
            <Fact term="Claims to be" value={verdict.claimedIdentity ?? "Not stated"} />
            <Fact term="Wants you to" value={verdict.requestedAction ?? "Nothing specific"} />
          </dl>
        </section>

        <Exhibit text={verdict.exhibit} redFlags={verdict.redFlags} />

        {verdict.masks.length > 0 && (
          <p className="text-sm text-ink-soft">
            🔒 We hid {verdict.masks.length} sensitive value{verdict.masks.length > 1 ? "s" : ""} (
            {[...new Set(verdict.masks.map((m) => m.type))].join(", ")}) before our AI saw the message.
          </p>
        )}
        {verdict.phones.length > 0 && (
          <p className="text-sm text-ink-soft">
            ☎️ Don&apos;t call {verdict.phones.length > 1 ? "the numbers" : "the number"} in this message (
            <span className="font-mono [overflow-wrap:anywhere]">{verdict.phones.join(", ")}</span>). Look up the official number yourself.
          </p>
        )}
      </div>

      <div className="min-w-0 space-y-10">
        <section aria-labelledby="flags-heading">
          <h2 id="flags-heading" className="font-display text-[length:var(--text-title)] leading-tight">
            Red flags
          </h2>
          {verdict.redFlags.length === 0 && verdict.signals.length === 0 ? (
            <p className="mt-3 text-ink-soft">No red flags found in the text.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {verdict.redFlags.map((flag, i) => (
                <li key={`${flag.start}`} id={`flag-${i + 1}`} className="grid scroll-mt-6 grid-cols-[2rem_minmax(0,1fr)] gap-2">
                  <span className="font-display text-2xl leading-none text-scam">{i + 1}</span>
                  <div>
                    <q className="font-mono text-sm text-ink-soft [overflow-wrap:anywhere]">{flag.quote}</q>
                    <p className="mt-1 leading-snug">{flag.explanation}</p>
                  </div>
                </li>
              ))}
              {verdict.signals
                .filter((s) => !s.quote || !verdict.redFlags.some((f) => f.quote.toLowerCase() === s.quote?.toLowerCase()))
                .map((signal) => (
                  <li key={signal.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
                    <span aria-hidden="true" className="font-display text-2xl leading-none text-warn">
                      •
                    </span>
                    <div>
                      <p className="font-semibold leading-snug">{signal.title}</p>
                      <p className="mt-0.5 text-sm leading-snug text-ink-soft">{signal.explanation}</p>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="verify-heading" className="rounded-sm border border-rule bg-paper-raised p-6 shadow-[var(--shadow)]">
          <h2 id="verify-heading" className="scroll-mt-6 font-display text-[length:var(--text-title)] leading-tight">
            How to check safely
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 marker:font-semibold marker:text-ink-faint">
            {verdict.verificationPlan.map((step) => (
              <li key={step} className="pl-1 leading-snug">
                {step}
              </li>
            ))}
          </ol>
          {verdict.unverifiable.length > 0 && (
            <div className="mt-5 border-t border-rule pt-4 text-sm text-ink-soft">
              <p className="font-semibold text-ink">What we couldn&apos;t verify</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {verdict.unverifiable.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function RiskMeter({ score, tone }: { score: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold uppercase tracking-[0.16em] text-ink-faint">Risk</span>
        <span className={`font-display text-3xl leading-none ${tone}`}>
          {score}
          <span className="text-base text-ink-faint">/100</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Risk score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={`${score} out of 100`}
        className={`mt-2 h-2.5 overflow-hidden rounded-full border border-current bg-paper-sunk ${tone}`}
      >
        <div
          className="h-full origin-left rounded-full bg-current transition-transform duration-700 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${Math.max(0.02, score / 100)})` }}
        />
      </div>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">{term}</dt>
      <dd className="mt-0.5 font-medium leading-snug [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
