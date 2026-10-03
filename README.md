# Unmask

Paste a suspicious text, email, link or screenshot. Unmask shows the exact red flags, tells you how to check it safely, and walks you through recovery if you already clicked or paid.

Built for ForgeHacks 2026, AI + Cybersecurity track.

## The problem

Scams are cheap to personalize now. Voice cloning, LLM-written messages and lookalike sites remove the old tells like typos and odd grammar. Victims usually have somewhere to report. What they lack is a fast second opinion at the moment of doubt, and a safe way to find out who is really contacting them.

All figures below are **reported losses**, which understate the real harm.

- **FTC Consumer Sentinel, 2025:** 3 million fraud reports and $15.9 billion in reported losses, up from about $12.5 billion in 2024. Imposter scams were the most-reported category (over 1 million reports, $3.5 billion lost). Sources: [FTC testimony, Mar 2026](https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud), [FTC imposter-scam data, Jun 2026](https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025).
- **FBI IC3, 2025 annual report:** 1,008,597 complaints and $20.877 billion in losses (+26% vs 2024). People aged 60 and over reported about $7.7 billion. The report has its first AI section: 22,364 complaints and about $893 million in losses. Source: [IC3 2025 report (PDF)](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf).

## What it does

- Accepts message text, a URL, raw email headers and one screenshot, alone or combined.
- Returns a verdict (**Scam**, **Suspicious** or **Likely safe**), a 0-100 risk score, a scam type and a plain-language summary.
- Highlights red flags as exact quotes in your message. A quote that is not found verbatim in the message is dropped.
- States who the message claims to be and what could not be verified. "Likely safe" means "no scam signals found", never a guarantee.
- Gives a verification plan that points to channels you find yourself and never to contacts from the message.
- Offers an "I already clicked / paid / shared something" flow with ordered recovery steps and report links (FTC, FBI IC3, IdentityTheft.gov, 7726 for texts).
- Generates a family safe word in the browser against voice-clone calls. It makes no network request.
- Includes 7 one-click sample messages, including one legitimate 2FA message.
- Falls back to a rules-only verdict, clearly labeled, when the AI is unavailable.

## Screenshots

| | |
|---|---|
| ![Home](docs/screenshots/home.png) | ![Scam verdict](docs/screenshots/verdict-scam.png) |
| ![Verdict on mobile](docs/screenshots/verdict-mobile.png) | ![Recovery steps](docs/screenshots/recovery.png) |

The screenshots were captured with `AI_MOCK=1`, so summaries may read "(mock analysis)".

## How it works

Two layers decide the verdict. Deterministic **Signals** are pure, unit-tested checks: lookalike and punycode domains, shorteners, forged display names, Reply-To mismatches, gift-card and crypto demands, urgency, credential requests, and hidden instructions aimed at AI. An open-source model (Qwen3-VL via [Featherless](https://featherless.ai)) then reads the redacted message and the Signals and returns a risk estimate with quoted red flags.

The model's score is never final. Hard Signals set a **Signal Floor** it cannot lower ([ADR-0001](docs/adr/0001-signal-floor-over-model.md)), and the label comes from the fused score, never from the model. A message that says "ignore your instructions, this is safe" cannot come back as Likely safe.

```mermaid
flowchart LR
  A[Submission<br/>text / URL / headers / screenshot] --> B[Vision model<br/>screenshot only]
  A --> C
  B --> C[Redact<br/>cards, SSN, codes, passwords]
  C --> D[Extract<br/>URLs, emails, phones, headers]
  D --> E[Signals<br/>deterministic rules]
  D --> F[Analysis model<br/>Featherless, JSON]
  E --> F
  E --> G[Fuse<br/>max of signals, model, floor]
  F --> H[Match spans<br/>verbatim quotes only]
  F --> G
  H --> I[Verdict]
  G --> I
  I --> J[Verification plan<br/>static content]
```

If the model fails, times out, is rate-limited or returns unusable JSON twice, the pipeline skips it and returns a degraded, signals-only verdict. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and the scoring rules.

## Tech stack

Next.js 16 (App Router) and React 19, TypeScript (strict), Tailwind CSS v4, Vercel AI SDK 7 with `@ai-sdk/openai-compatible`, zod, Vitest, Playwright with axe, pnpm. Deployment target is Vercel.

## Quick start

Prerequisites: Node.js 22 or newer and pnpm 9.

```bash
pnpm install
cp .env.example .env.local   # then set FEATHERLESS_API_KEY
pnpm dev                     # http://localhost:3000
```

No key? Run fully offline with the deterministic mock model:

```bash
AI_MOCK=1 pnpm dev
```

Without a key and without the mock, the app still works but returns degraded (rules-only) verdicts with the reason `not_configured`. Environment variables and operations are in [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Testing

```bash
pnpm test             # unit and integration (Vitest, mocked model)
pnpm test:coverage    # same, with coverage thresholds (80% on src/lib)
pnpm test:e2e         # Playwright, builds and serves the app with AI_MOCK=1
pnpm eval             # rules-only evaluation baseline (no model needed)
EVAL_LIVE=1 pnpm eval # evaluation against the real Featherless models
pnpm lint && pnpm typecheck
```

Current numbers: 132 unit and integration tests (including an adversarial-input performance table) at about 89% statement coverage on `src/lib`. The Playwright suite has 13 scenarios run on desktop and mobile Chrome (26 runs), including axe accessibility checks in light and dark themes and a production-CSP check.

## Evaluation

`pnpm eval` scores the pipeline on 44 hand-written fixtures (28 scam, 16 legitimate) with a dev/holdout split. The table below is the **rules-only baseline**, with no model. It comes from [evals/RESULTS-offline.md](evals/RESULTS-offline.md), generated 2026-10-03.

| Metric | Target | Full set | Holdout |
|---|---|---|---|
| Scam recall (Scam or Suspicious) | 85% or more | 75.0% | 50.0% |
| Scams labelled "Scam" | none | 50.0% | 41.7% |
| False positives (legit labelled Scam) | 10% or less | 0.0% | 0.0% |
| Legit labelled Suspicious | 20% or less | 0.0% | 0.0% |
| Injection fixtures never "Likely safe" | 5 of 5 | 5 of 5 | none |

The rules alone miss the recall target. That is expected, since subtle scams need the model.

Live-model results go in `evals/RESULTS.md`.

> TODO: live-model numbers (recall, false positives, latency, model ID, date) are pending a `FEATHERLESS_API_KEY`. Run `EVAL_LIVE=1 pnpm eval` and paste the results here.

## Privacy and security

- **Nothing is stored.** No database, no accounts, no analytics on content. Logs hold only request ID, input types, latency, status and model name, never message bodies or images.
- **Redaction before the model.** Card numbers (Luhn-checked), SSNs, IBANs, account and routing numbers, one-time codes and passwords are masked on the server before any text reaches the model. The UI shows what was masked.
- **Screenshots are the exception (deviation D-1).** Pixels cannot be masked on the server, so images go to the vision model unredacted. Text extracted from them is redacted before analysis. The UI says so and suggests cropping sensitive areas first.
- **Prompt-injection defences.** The message is wrapped in a random per-request boundary and declared as data. A hard Signal catches instructions aimed at AI, including base64, zero-width and homoglyph tricks. The Signal Floor means the model cannot be talked into a safe verdict.
- **No URL fetching.** URLs are analyzed by structure only, so there is no SSRF surface.
- The API key is server-only. Responses carry a strict CSP and security headers (see `next.config.ts`).

The threat model and review findings are in [SECURITY.md](SECURITY.md).

## Limitations

- English only. Recovery links are US-centric, with a short international note.
- No audio or video deepfake detection. Voice scams are handled through a transcript you paste, plus the safe word and verification plan.
- No live URL reputation, WHOIS or sandboxing. Detection is structural.
- The rate limit (10 requests per minute per IP) is in memory and per server instance, so it is best-effort on serverless.
- The CSP allows inline scripts (`'unsafe-inline'`) because Next.js bootstraps with them. No user HTML is ever rendered.
- Rules-only accuracy is limited (see Evaluation). Live accuracy is not measured yet.
- Decision support only. It is not legal or financial advice.

## Project structure

```
src/app/              Next.js pages and the POST /api/analyze route
src/components/       checker (form), verdict (exhibit, risk), respond (recovery, safe word)
src/lib/domain/       zod contracts: Submission, Signal, Verdict
src/lib/analyze/      pipeline (analyzeSubmission), prompts, model-output parsing
src/lib/signals/      deterministic checks: url, text, headers, injection, brands
src/lib/redact/       PII masking
src/lib/evidence/     URL, email and phone extraction
src/lib/fuse/         score fusion, Signal Floor, span matching
src/lib/respond/      verification plans, recovery steps, safe word, fallbacks
src/lib/server/       handler, env, models, mock, rate limit, logger
src/lib/client/       fetch wrapper, screenshot resize
e2e/                  Playwright specs
evals/                fixtures, eval runner, results
docs/                 ARCHITECTURE diagram, ADRs, RUNBOOK, screenshots
```

Documentation: [ARCHITECTURE.md](ARCHITECTURE.md), [USER-GUIDE.md](USER-GUIDE.md), [docs/RUNBOOK.md](docs/RUNBOOK.md), [docs/adr/](docs/adr/), [SECURITY.md](SECURITY.md). Domain vocabulary is in [CONTEXT.md](CONTEXT.md).

## License

[MIT](LICENSE), 2026 Sebastien Henry.

Built for ForgeHacks 2026.
