# ASSUMPTIONS

Each entry gives what was assumed, why, and how to override. Dated 2026-10-03.

## Product and scope

| ID | Assumption | Why | Override |
|---|---|---|---|
| A-1 | Solo builder, about 7 days, with an AI-agent pipeline doing the implementation. | Matches `PLAN.md`. | Cut scope in the order: stretch, then URL/headers polish, then screenshot polish. |
| A-2 | No accounts, auth, database or storage of any kind. | Privacy is a core trust feature, and it removes data-protection scope. | Add an optional opt-in history only after v1.0, with a new privacy review. |
| A-3 | English-only UI and prompts. | Time. The eval set is also English. | Add locale files. The prompts and taxonomy are locale-agnostic by design. |
| A-4 | Primary demo persona is the older adult / caregiver (P1). P2 and P3 are served by fixtures, taxonomy and sample gallery, not dedicated UIs. | Strongest story for the AI + Cybersecurity judges (FTC and IC3 age data). | Reorder the gallery or the demo script. |
| A-5 | The app never fetches submitted URLs. | Avoids SSRF and malware exposure, and keeps latency low. | Stretch: add a server-side fetch behind an allow-listed egress proxy. |
| A-6 | Report and recovery links are US-centric: reportfraud.ftc.gov, ic3.gov, IdentityTheft.gov, bank fraud lines. The UI adds a short international note: UK Action Fraud, Canada Anti-Fraud Centre, Australia Scamwatch, and "your national consumer-protection agency". | The track sponsors and the statistics are US-based, and a verified list of every country is too costly. | Add a country selector backed by a small JSON table of report links. |
| A-7 | Statistics cited are FTC Consumer Sentinel 2025 ($15.9B) and FBI IC3 2025 ($20.877B). Both were re-verified by web search on 2026-10-03. | The numbers must be accurate for judges. | Re-check the URLs in REQUIREMENTS.md section 1 before the final README edit. |
| A-8 | "Likely safe" never means "verified safe". Copy is "no scam signals found". | Avoids a false-assurance harm. | None; this is a product principle. |
| A-9 | Rate limiting is in-memory per IP and best-effort. | No external store is allowed (A-2) and it is good enough for a demo. | Swap to Vercel KV/Upstash if abuse appears. |

## Technical defaults

| ID | Assumption | Why | Override |
|---|---|---|---|
| T-1 | Stack: Next.js 16 App Router, TypeScript strict, Tailwind v4, AI SDK 7 with `@ai-sdk/openai-compatible`, zod, Vitest, Playwright, pnpm, Node 24 on Vercel. | Taken from the brief and `PLAN.md`. | The architect may change it if a package version is unavailable. Confirm the versions on Day 1 and record any change here. |
| T-2 | `Qwen/Qwen3-VL-30B-A3B-Instruct` (ungated, image input, concurrency cost 2) is used for both `VISION_MODEL` and `ANALYSIS_MODEL`. Fallbacks, with thinking disabled (see the PLAN branch table): for vision, `Qwen/Qwen3.5-9B` then `google/gemma-3-12b-it`; for analysis, `Qwen/Qwen3.5-9B` (latency) or `Qwen/Qwen3.6-27B` (JSON reliability). | It is a mixture-of-experts model with about 3B active parameters, so it is fast. `google/gemma-3-27b-it` is gated. | Set the env vars. Re-run the eval after any change and update `evals/RESULTS.md`. |
| T-3 | Deployment target is Vercel (Hobby/free tier is enough). Request body cap is 4.5 MB. Function timeout is the plan default, so the route sets `maxDuration` explicitly. | Next.js on Vercel is the lowest-friction path. | Another host would need new body and timeout limits. |
| T-4 | Eval set is hand-authored, synthetic or paraphrased (no real victim data), at least 40 items (≥26 scam, ≥14 legit). Dev/holdout split about 60/40. SC-2/3 are scored on the full set, with holdout metrics reported alongside. | Avoids PII and licensing issues. | Add public corpora (e.g. phishing datasets) as extra, clearly labelled items. |
| T-5 | Brand list for lookalike detection is a curated list of about 50 to 100 brands (banks, carriers, retailers, government, crypto exchanges). | Small and deterministic. | Extend the JSON file. |
| T-6 | The repo is public under the MIT licence, hosted under the user's GitHub account. | A hackathon requirement. | Choose another licence. |
| T-7 | The user records and uploads the demo video and submits on Devpost. The agent only drafts the text and the script. | `PLAN.md` gated actions. | None. |

## Credential-scope preflight

Validate every row on Day 1, before slice 1 is considered done. A scope problem found on deploy day
costs the project.

| Service | Credential | Required scope / permission | How to verify now (never paste key values into chat, logs or git) |
|---|---|---|---|
| Featherless (LLM + vision) | `FEATHERLESS_API_KEY` (user supplies, `.env.local` plus Vercel env). | Inference only: chat completions with tool/JSON output and image input. No write or admin scope is needed. The plan or credits must cover the chosen models, and the account's concurrency units must allow at least 1 vision call and 1 text call run sequentially. | (1) `curl -s -H "Authorization: Bearer $FEATHERLESS_API_KEY" https://api.featherless.ai/v1/models` returns 200 and lists `Qwen/Qwen3-VL-30B-A3B-Instruct` and `Qwen/Qwen3.5-9B` (the catalog is public and was checked on Oct 3). (2) One text chat completion returns JSON. (3) One image chat completion returns extracted text. (4) Note the 429/concurrency behavior and measured latency in `STATUS.md`. A 401 or 403 means a key problem. A 402 or an "insufficient credits / plan" message means a plan problem. |
| GitHub | Authenticated `gh` CLI or git credential on the user's machine. | Create a public repo and push (`repo`, or `public_repo` plus repo creation). Workflows are included in the push, so a classic PAT also needs the `workflow` scope, or a fine-grained token needs Actions and Contents read/write. | `gh auth status` shows the account and the scopes. `gh repo create --public` is a gated action that needs user approval. |
| Vercel | `vercel login` session (or `VERCEL_TOKEN`). The user adds env vars. | Deploy to a personal scope. Project create, link and env-var write, and production deploy. The token must belong to the account that will own the project. | `vercel whoami` returns the account. `vercel link` succeeds in a dry run. Confirm that "Hobby" limits (4.5 MB body, function duration) are acceptable (T-3). Production deploy is a gated action. |
| Devpost | The user's own login. | Submit the project. | Not automated. The user confirms that the account exists, and that they are registered for ForgeHacks Online 2026 and on the team. |
| Video host (YouTube, Vimeo or Loom) | The user's own login. | Upload the video as public or unlisted-but-public-link. The link must open without a login. | The user uploads a 10-second test video and opens its link in a private window. |
| Agentboxd (stretch only) | Not needed unless the stretch goal is pursued. | n/a | Skip. If it is pursued later, add a row for its key and scope. |
| Other external APIs | None. There are no URL reputation, WHOIS or search APIs (A-5). | n/a | n/a |

Secrets policy: the key is server-only (`process.env`), validated at startup (fail fast with a clear
message), and a CI grep guards the repo and client bundle. The agent never reads or prints the key.
Rotate it if it is ever exposed.

## Open items to confirm (not blocking)

- Exact Featherless model IDs, plus Qwen3-VL latency and JSON reliability (keyed probe) (R-1, R-2).
- Whether the user wants the safe-word phrase list to be a bundled word list (assumed) or LLM-generated.
- Whether the hackathon requires the video to be hosted on a specific platform (assumed: any public link).

## Deviations recorded during planning
- **D-1 (FR-15):** screenshots are sent to the vision model unredacted, because pixels can't be masked server-side. Text extracted from them is redacted before the analysis call. The UI privacy notice says so and suggests cropping sensitive regions.
- **D-2 (FR-13):** Reply-To domain mismatch on its own is a medium signal, not hard. Email service providers and helpdesks routinely use a Reply-To on a different domain. It becomes hard only when combined with brand impersonation in the display name (`combo.display-name-reply-to`).
