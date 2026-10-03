# PLAN — "Unmask": AI scam & impersonation verifier
ForgeHacks Online 2026 · Track: **AI + Cybersecurity** · Deadline Oct 10 2026 11:00 CDT (internal: Oct 9 11:00, SC-20)

## Context
- Prompt: *"help people recognize, prevent, verify, or respond to scams, impersonation, and fraud enabled by AI or modern technologies."*
- State: scaffolded (Next 16.3.8, React 19.2, AI SDK 7.0.127, `@ai-sdk/openai-compatible`, Vitest 5, Playwright), CI file present. Requirements in `REQUIREMENTS.md` (FR-1..17, NFR-1..9, SC-1..20), assumptions in `ASSUMPTIONS.md`, vocabulary in `CONTEXT.md`, decisions in `docs/adr/`.
- LLM: Featherless (OpenAI-compatible, sponsor credits). Product: paste text / URL / raw headers / screenshot (any combination) → explainable **Verdict** with in-place **Red Flags**, **Verification Plan** via an **Independent Channel**, **Recovery Steps**, and a client-side **Safe Word** generator.

## Skill usage
| Phase | Agency role | Matt Pocock skill |
|---|---|---|
| Intake | `requirements-analyst` (done) | `domain-modeling` → `CONTEXT.md`, ADRs (done) |
| Plan loop | `architect`/`ux-designer`/`ai-pm` input; `plan-critic` + `plan-rubric` until ≥90 | `codebase-design` (deep modules, seams below) |
| Build loop per slice | builder → `robustness-reviewer` → `test-engineer` → `security-auditor` (milestones) → `solution-verifier` (`solution-rubric`) | `tdd` at the agreed seams, `code-review` per slice, `diagnosing-bugs` when stuck |
| Ship | `fde` (`deployment-readiness`), `doc-writer` (+`humanizer`), `launch-comms`, `retrospective` | `writing-for-agents` for STATUS.md / CLAUDE.md |

**Agreed test seams (TDD):** `collectSignals(evidence)`, `redact(text)`, `fuseVerdict(signals, assessment|null)`, `parseAssessment(raw)`, `matchSpans(flags, exhibit)`, `analyzeSubmission(submission, deps)` (model injected), `POST /api/analyze` (route handler with mock model), and E2E through the UI.

## Contracts (zod, `src/lib/domain/`)
- `SubmissionInput { text?, url?, headers?, image? }` — ≥1 required (FR-5, FR-16). `image` = data URL, MIME ∈ {png, jpeg, webp}.
- `Evidence { exhibit, urls[], emails[], phones[], headers?: EmailHeaders, visualCues[], masks[] }` (email domains reuse the `url.*` domain signal ids) — `exhibit` is the redacted text shown back; `masks[]` lists what was masked (type + masked text) for the UI.
- `Signal { id, severity: low|medium|high|hard, title, explanation, quote? }` — `quote` is copied verbatim from the input text (URL quotes are the link as written, cut before `?`/`#`). Signal quotes go through `matchSpans` like model red flags, so `source: "signal"` spans get real offsets.
- `ModelAssessment { riskScore, scamType, claimedIdentity|null, requestedAction|null, summary, unverifiable[], redFlags[{quote, explanation}] }` — label is NOT taken from the model.
- `Verdict { label: scam|suspicious|likely_safe, riskScore, scamType, claimedIdentity, requestedAction, summary, unverifiable[], redFlags[{quote, explanation, source, start, end}], signals[], verificationPlan[], degraded, degradedReason: null|provider_error|timeout|rate_limited|parse_failed|not_configured, masks[] }` — Recovery Steps are NOT in the Verdict: they are static client-side content keyed by action (always available).
- `ApiEnvelope<T> { ok, data|null, error: {code, message}|null, requestId }`
- **Scam Type taxonomy** — single source of truth: `ScamTypeSchema` `z.enum` in `src/lib/domain/verdict.ts`, matching CONTEXT.md (bank, government, delivery, tech_support, job, romance, crypto_investment, invoice_ceo, family_emergency, prize, account_takeover, other, none) — `none` ("no scam pattern") added to CONTEXT.md.

## Architecture
```
SubmissionInput ──► ingest/  (vision call ONLY if image; returns extracted text + visual cues)
                    merge text + extracted text + url + headers → raw exhibit
               ──► redact/   mask cards (Luhn), SSN, IBAN/account+routing, OTP codes, passwords → {text, masks[]}
                    THEN extract urls[], emails[], phones[], header fields from the REDACTED exhibit
                    (so no Signal.quote can carry unredacted PII; URL quotes also drop query/fragment)
               ──► signals/  deterministic, pure (never fetches URLs — FR-2):
                      url: lookalike/homoglyph vs brand list, punycode, brand-in-subdomain, shortener,
                           IP host, userinfo "@", risky TLD, excess subdomains, plain http
                      text: gift card / crypto / wire+P2P payment, urgency, credential/OTP request
                            (negation-aware), secrecy, threats/authority, prize, remote-access app,
                            family-emergency/new-number, job-pay, guaranteed returns
                      headers: display-name brand vs domain, Reply-To / Return-Path mismatch, SPF/DKIM/DMARC fail
                      injection (HARD): role-override phrases, fake <system> tags, "classify/mark as safe",
                            addressing an AI — applied to text extracted from images too (SC-4)
               ──► analyze/  analysis model sees ONLY redacted exhibit + signals, inside a random per-request
                             boundary token (`<untrusted_message id=RANDOM>`; any delimiter-like tag in the
                             exhibit is neutralized first); plain-text JSON → parseAssessment (extract JSON, zod) → 1 repair retry
               ──► spans/    matchSpans: keep only red-flag quotes found verbatim (case-insensitive) in the
                             exhibit, return real offsets; drop the rest (FR-7, SC-5)
               ──► fuse/     fusedRisk = max(signalScore, modelRisk, floor) — see "Scoring rules" below.
                             **Label from fusedRisk only**: ≥70 Scam, 35–69 Suspicious, <35 Likely safe (ADR-0001, FR-13)
               ──► respond/  static, versioned content: verification plan per scam type (parameterized by
                             claimed identity), recovery steps per action (clicked/paid/shared credentials/
                             shared code/installed software) + report links (FTC, IC3, IdentityTheft.gov,
                             bank; intl note). Available in degraded mode (FR-9, FR-10)
```
- **Privacy (honest):** text is redacted before the analysis call. **Images are sent to the vision model unredacted** (pixels can't be masked server-side); its extracted text is redacted before analysis. The UI privacy notice says so and suggests cropping sensitive regions. Nothing is persisted; message bodies are never logged.
- **Degraded Verdict (FR-14):** provider error/timeout/429, second parse failure, or key not configured → `ok: true` with a signals-only Verdict, `degraded: true` + `degradedReason`, clearly labeled. Deterministic fallbacks: ScamType from a signal→type map (gift card + boss/urgency → invoice_ceo, remote-access → tech_support, crypto/guaranteed returns → crypto_investment, family/new number → family_emergency, delivery brands → delivery, bank brands → bank, default other); summary templated from the top 3 signals; generic verification plan for `other`.
- **Image + other input, vision fails:** continue with the remaining input; Verdict gets `unverifiable: ["screenshot could not be read"]` (not degraded unless analysis also fails). Unit-tested.
- **Image-only + vision failure:** never a Verdict. Return `ok: false, code: "image_unreadable"` ("We couldn't read that screenshot — paste the text instead"). E2E-tested.
- **Mock model:** `AI_MOCK=1` enables a deterministic keyword-driven mock. When mock is on (and only then — `env.ts` refuses `AI_MOCK` when `VERCEL_ENV=production`), sentinel tokens in the message select behaviour within one E2E run: `[[mock:fail]]`, `[[mock:timeout]]`, `[[mock:malformed]]` (bad JSON first, valid on repair), `[[mock:vision-fail]]`.
- **Observability:** `src/lib/server/log.ts` structured logger with an allow-list of fields (requestId, inputTypes, per-stage latencyMs, status, degraded, model, repairRetried). `requestId` returned in the envelope.

## Scoring rules (fuse/, unit-tested case by case)
- Severity weights: low 5 · medium 15 · high 30 · hard 50. `signalScore = min(100, Σ weights)` with each signal id counted once.
- Floors: one hard signal → **50** (Suspicious, per ADR-0001); two hard signals, or hard + high → **70** (Scam). Any high → 35.
- Combination rules (FR-13), emitted as an extra hard signal `combo.*`: payment by gift card/crypto/wire + urgency or secrecy; credential/OTP request + brand impersonation (url/header); family-emergency + payment request; `combo.display-name-reply-to` (display-name brand + Reply-To mismatch). Deviation D-2 recorded in ASSUMPTIONS.
- User-content hosts (amazonaws.com, web.app, firebaseapp.com, pages.dev, netlify.app, vercel.app, github.io, windows.net, r2.dev, …) are never official; a brand token on them is impersonation (tested).
- Brand matching (`url.brand-in-subdomain`, emails, phone brand claims) uses whole dot/hyphen-delimited tokens only — `secure-chase-alerts.top` matches, `purchase.example.com` / `pineapple.com` do not (regression-tested). Email addresses found in the body are run through the same domain checks.
- Injection signal is hard (floor 50 alone → never Likely safe, SC-4).

| Signal | Severity |
|---|---|
| url.lookalike-domain (exact after character swaps: paypa1, amaz0n, rn→m), url.brand-in-subdomain (non-common-word brand), url.punycode (decoded label imitates a brand), url.userinfo-trick | hard |
| url.lookalike-domain fuzzy (edit distance 1 for brands < 8 letters, 2 for ≥ 8; allowlist of everyday words: finance, team, mobile, email, apply, horizon…), url.brand-in-subdomain for common-word brands (apple, chase, steam, outlook) | high |
| url.punycode not imitating a brand | medium |
| url.ip-host | high · url.shortener, url.risky-tld, url.user-content-on-official medium · url.excess-subdomains low |
| text.gift-card-payment, text.remote-access, text.guaranteed-returns, text.credential-request, text.secrecy | high |
| text.crypto-payment, text.wire-p2p-payment, text.money-request, text.urgency, text.threat-authority, text.prize, text.job-pay, text.family-emergency | medium |
| header.display-name-brand-mismatch (brand in display name, non-official domain) | hard |
| header.reply-to-mismatch | medium (hard only combined with display-name brand → combo) |
| header.auth-fail (SPF/DKIM/DMARC fail) | high · header.return-path-mismatch low (ESP bounce domains are normal) |
| phone.only-contact-channel (a phone number is the call-to-action and a `brands.ts` token appears in the exhibit) | medium |
| injection.* | hard |

- **Injection normalization** before phrase matching: NFKC, zero-width/bidi removal, homoglyph folding, and base64 blobs ≥ 16 chars decoded and re-scanned. Vision prompt demands verbatim transcription; residual risk (vision model told to omit text) recorded in SECURITY.md STRIDE.
- **Claimed Identity in the Verification Plan:** only inserted if it maps to a curated brand (brands.ts) or a fixed generic noun ("your bank", "the government agency", "your employer", "your family member"); digits, URLs and emails stripped. Unit test: a phone/URL inside `claimedIdentity` never appears in `verificationPlan`.
- **Phones:** extracted numbers are exempt from account/OTP masking (unit test); displayed with a reminder "don't call numbers from the message".

## Limits & budgets (FR-16, NFR-2, NFR-7)
- text ≤ 10 000 chars · headers ≤ 20 KB · url ≤ 2 048 chars · image data URL ≤ 4 MB **encoded** (~3 MB decoded; FR-16's 4 MB cap holds), client-resized to ≤ 1600 px JPEG targeting ≤ 1.5 MB · route rejects larger bodies with an envelope 413; the client also maps Vercel's platform (non-JSON) 413 to the same friendly message.
- Per-request deadline: 18 s text-only, 35 s with image (NFR-2 p95 < 20 s text). Vision gets ≤ 15 s; analysis gets the remainder; the repair retry only runs if ≥ 5 s remain, else degraded. Route `maxDuration = 60`. Calls are sequential (concurrency units).
- Rate limit: in-memory sliding window, 10 req/min/IP, IP from the first `x-forwarded-for` hop (Vercel), else shared `"unknown"` bucket (documented limitation: per-instance).
- `src/lib/server/env.ts` zod-validates env at startup; missing key and mock off → degraded Verdict with `degradedReason: "not_configured"`.
- Security headers in `next.config.ts` `headers()`: HSTS, nosniff, `X-Frame-Options: DENY`, referrer, permissions policy, and CSP `default-src 'self'; script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' only when NODE_ENV=development); style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. Documented trade-off: `'unsafe-inline'` scripts instead of nonces keeps pages static (Next App Router inline bootstrap); no user HTML is ever rendered (React escaping only, no `dangerouslySetInnerHTML`). Fonts self-hosted via `next/font`. Playwright check on `pnpm build && pnpm start`: hydrates with zero CSP console errors.
- UI progress states: "Reading screenshot…", "Checking links…", "Analyzing…".

## UI (ux-designer brief)
"Forensic dossier" editorial: paper off-white + ink, red/amber/green used only for risk; Instrument Serif display + IBM Plex Sans/Mono. The message is rendered as an annotated **Exhibit** with highlighted Red Flags linked to explanations; masked values shown as `[card ••••]` chips. Sample gallery (≥6: bank SMS, fake delivery, CEO gift-card, crypto investment, grandparent call transcript, legit 2FA message) → verdict in ≤3 clicks (SC-15). Grade-8 summary, "what we couldn't verify", and "no scam signals found ≠ safe" wording (FR-6, FR-8). Light + dark, 320→1920, keyboard accessible, reduced motion; verdict region `role="status"`; highlights use underline + label, not color alone (NFR-4). Safe Word: client component, bundled word list, `crypto.getRandomValues`, no network call (FR-11).

## Schedule (vertical slices; commit + tag each; STATUS.md updated)
| Slice | Content | Done by |
|---|---|---|
| **v0.0 preflight** | gitleaks CI job (fetch-depth 0) + bundle-grep step before any public push; git init ✔; `vitest.eval.config.ts` + `pnpm eval` script, evals excluded from default run; `playwright.config.ts`; `gh auth status` / `vercel whoami`; Featherless probe once the key is in `.env.local` (see branch table) | Oct 3 |
| **v0.1 skeleton** | `playwright.config.ts` (webServer `pnpm start` with `AI_MOCK=1`) + first E2E are hard requirements; whole suite green (text signals already implemented); contracts, env validation (`server-only`), logger + requestId, paste text → route → mock/real model → verdict card; ≥1 E2E; gated repo creation + push (CI green) and gated Vercel deploy | Oct 3–4 |
| **v0.2a engine I** | redact, text signals, fuse + degraded, exhibit UI; author ≥30 eval fixtures (dev/holdout split) reused as signal-test fixtures | Oct 4 |
| **v0.2b engine II** | url/header/phone/injection signals + normalization, spans, input limits | Oct 5 |
| **v0.3 multimodal** | screenshot/vision ingest + client resize + privacy notice; URL & header fields; **first live eval run (dev split)** | Oct 6 |
| **v0.4 respond & protect** | verification plan, recovery flow (clicked / gift card / wire-bank transfer / crypto / card payment / shared credentials / shared code / installed software) + report links, safe word, sample gallery, rate limit, security headers | Oct 7 |
| **v0.5a eval** | prompt + signal-rule tuning on the dev split only (holdout untouched; legit fixtures include account confirmation, Zelle receipt, Outlook "mark sender as safe" footer, a sender named Chase), final full-set + holdout run → `evals/RESULTS.md` | Oct 8 AM |
| **v0.5b polish** | design polish, a11y, responsive, Lighthouse (cut first if Oct 8 slips: Lighthouse perf tuning) | Oct 8 PM |
| **v1.0 ship** | redeploy, README, ARCHITECTURE.md + diagram, SECURITY.md, ACCEPTANCE.md, LICENSE (MIT), launch/DEVPOST.md, launch/DEMO-SCRIPT.md, screenshots | Oct 9 09:00 |

**Featherless branch table (v0.0):**
| Condition | Action |
|---|---|
| Key not in `.env.local` by Oct 4 12:00 | keep building on mock through v0.2b; escalate to the user |
| Default `Qwen/Qwen3-VL-30B-A3B-Instruct` unavailable on plan / vision p50 > 8 s | switch `VISION_MODEL` to `Qwen/Qwen3.5-9B` (image_input, cost 1), then `google/gemma-3-12b-it` (gated) |
| Text-only p50 > 8 s over 5 probe calls | re-run the 5-call probe on `Qwen/Qwen3.5-9B` (thinking disabled) and switch only if faster |
| No usable vision model | screenshot input moves to the cut list; no client-side OCR (out of scope) |
| Analysis model returns unparseable JSON > 20% of probe calls | switch `ANALYSIS_MODEL` to `Qwen/Qwen3.6-27B` (cost 2) |

All Qwen3.5/3.6 calls send `chat_template_kwargs: { enable_thinking: false }` via `providerOptions`, and `parseAssessment` strips any `<think>…</think>` before extracting JSON. Concurrency: smoke runs are sequential; a 429 under concurrent judge load shows as the labeled degraded state.

**Probe results (Oct 3, unauthenticated):** `gh` logged in as SebAustin with `repo`+`workflow` scopes ✔ · `vercel whoami` ✔ · `GET /v1/models` 200, 22k models: `Qwen/Qwen3-VL-30B-A3B-Instruct` (ungated, image_input, tool_use, 131k ctx, concurrency_cost 2) chosen for both vision and analysis; `google/gemma-3-27b-it` is gated (cost 2); `Qwen/Qwen3.5-9B` (image_input, cost 1) is the fallback. Keyed calls (JSON reliability, latency, 429) pending `.env.local`.

Coverage thresholds are on from v0.1 and every slice keeps `src/lib` ≥ 80%.

**Cut rule:** if a slice slips past its date, drop in order: stretch (Agentboxd forward-to-inbox) → URL/header input polish → screenshot polish. The text path + signals + respond content are never cut.

`pnpm eval` runs as a Vitest project (`vitest run --config vitest.eval.config.ts`, `EVAL_LIVE=1` for the real model) so `@/` aliases resolve.

## Gated actions (ask first)
Public GitHub repo creation/push · `vercel` link + deploys · anything public (Devpost, YouTube, social). The user adds `FEATHERLESS_API_KEY` to `.env.local` / Vercel env; the key value is never handled by the agent.

## Verification — SC traceability
| SC | Proof | Slice |
|---|---|---|
| SC-1/2/3 | `pnpm eval` on ≥40 labelled items (≥26 scam across all scam types, ≥14 legit); SC-2/3 scored on the **full set**, holdout (≥16 items) metrics reported alongside in `evals/RESULTS.md`: recall ≥85%, FP ≤10%, Suspicious-on-legit ≤20% | v0.5a |
| SC-4 | ≥5 injection fixtures — plain role-override, fake `<system>` tag, base64-encoded, zero-width-obfuscated, image-extracted — never Likely safe; unit (signals+fuse) + eval | v0.2b/v0.5 |
| SC-5 | `matchSpans` unit tests + eval assertion that every displayed span is verbatim in the exhibit | v0.2b |
| SC-6 | `evals/RESULTS.md` committed, quoted in README | v0.5 |
| SC-7 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally + CI | every slice |
| SC-8 | `pnpm test:coverage` thresholds 80% on `src/lib` | v0.2+ |
| SC-9 | redact tests: ≥95% of seeded PII masked, Luhn false-positive test, phone exemption; analyze test asserts masked values (incl. a card number inside a URL query) never reach the model prompt or any `Signal.quote` | v0.2a |
| SC-10 | Playwright: paste, gallery, screenshot, already-paid recovery, safe word (asserts no network call), degraded (`[[mock:fail]]`, `[[mock:timeout]]`, `[[mock:malformed]]` under `AI_MOCK=1`), oversize rejection (route 413 + platform-413 mapping) | v0.2a–v0.4 |
| SC-11 | `security-auditor` SECURITY.md (no CRITICAL/HIGH open) + CI gitleaks job with `fetch-depth: 0` over full history + a CI step after `pnpm build` that greps `.next/static` and fails the job on a match for `FEATHERLESS_API_KEY` and the Featherless key prefix (recorded in SECURITY.md); provider/env modules import `server-only` | v1.0 |
| SC-12 | deployed URL live, no login; `scripts/smoke.ts` 10 live runs p50 < 8 s | v0.1/v1.0 |
| SC-13/14 | Lighthouse (A11y ≥95, BP ≥95, mobile Perf ≥85), axe 0 serious; screenshots at 320/768/1440 light+dark | v0.5 |
| SC-15 | E2E: gallery click → verdict + plan visible in ≤3 clicks | v0.5 |
| SC-16–19 | files present: README, ARCHITECTURE.md (+diagram), SECURITY.md, ACCEPTANCE.md, LICENSE, launch/DEVPOST.md, DEMO-SCRIPT (2:30–3:30), ≥4 screenshots | v1.0 |
| SC-20 | v1.0 tag by Oct 9 11:00 CDT | v1.0 |

## Revision log
- r5 (88/100, cap of 5 rounds reached; all criteria ≥4, Architecture 5): residual defects were code-level and were fixed immediately in the build loop with regression tests: user-content-on-official rule (docs.google.com/forms etc.); fuzzy matching only for brands ≥6 letters + allowlist; injection rule requires "as" + object (footers no longer match); common-word brand display names need brand context ("Chase Miller" ≠ Chase Bank) + brands' sending domains; subdomain exact-swap lookalikes; email addresses never yield userinfo-trick; gitleaks + bundle grep in CI now; coverage branches 80; T-2 aligned; invisible-char regex uses escapes. Plan accepted for build.
- r4 (84/100, REVISE): ASSUMPTIONS T-2/T-4/credential row synced to Qwen3-VL + full-set scoring; signal quotes verbatim-as-written (+tests) and routed through matchSpans; fuzzy lookalike tightened (distance by brand length, allowlist, fuzzy = high; common-word brands high) with regression tests; punycode hard only when imitating a brand; amazonaws removed + user-content-host rule (+test); suite green; thinking disabled + `<think>` stripping on fallbacks; `emails[]` in Evidence; bundle-grep is a failing CI step.
- r3 (81/100, REVISE): probes run and recorded, default model chosen; extraction after redaction + URL quotes without query; whole-token brand matching (bug fixed in url.ts with regression tests); encoded image limit + platform-413 mapping; random delimiter boundary; dev-only unsafe-eval; D-2 + display-name/Reply-To combo; latency branch rows; ≥40-item eval set, full-set scoring; mock-sentinel naming; image+text vision failure; logger to v0.1, gallery to v0.4, v0.5 split; gitleaks fetch-depth + server-only; email-domain checks, phone brand rule, rate-limit IP source.
- r2 (74/100, REVISE): Featherless branch table + key deadline; scoring rules + severity table (one hard → Suspicious, matches ADR-0001); image-only vision failure → error not verdict; claimedIdentity sanitization; deterministic degraded fallbacks; injection normalization (base64/zero-width); eval fixtures moved to v0.2a, live eval at v0.3, holdout split; tooling fixes; CSP directive set; sentinel mock tokens + malformed mode + prod guard; degradedReason; Verdict fields; FR-10 payment types; per-request deadline; phone signals + masking exemption; v0.2 split; a11y + gitleaks.
- r1 (61/100, REVISE): fixed image-before-redaction claim, span mapping after redaction, label-from-fused-score, injection hard signal, combined Submission, preflight slice, dated schedule + cut rule, early deploy, split slices, eval runner, CI-green requirement, FR/SC gaps, limits/budgets, security headers, env validation, mock failure modes, observability, contracts, SC traceability table.
