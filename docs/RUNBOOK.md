# Runbook

How to run, configure and troubleshoot Unmask. Design background is in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Run modes

| Mode | Command | Notes |
|---|---|---|
| Local, real model | `pnpm dev` | Needs `FEATHERLESS_API_KEY` in `.env.local`. |
| Local, offline | `AI_MOCK=1 pnpm dev` | Deterministic mock model. No network, no key. Summaries read "(mock analysis)". |
| Local, no key, no mock | `pnpm dev` | Works, but every verdict is degraded with `not_configured`. |
| Production build | `pnpm build && pnpm start` | Serves the real CSP and headers. |
| E2E | `pnpm test:e2e` | Builds, serves on port 3200 with `AI_MOCK=1` and `RATE_LIMIT_PER_MINUTE=1000`. |

Requirements: Node.js 22 or newer (CI uses 24) and pnpm 9. `next dev` allows one dev server per project directory, so stop the old one first if you see "Another next dev server is already running".

## Environment variables

Set in `.env.local` locally and in the Vercel project settings in production. `.env.example` is the template. Values are read per request, except `RATE_LIMIT_PER_MINUTE` (see below).

| Variable | Default | Purpose |
|---|---|---|
| `FEATHERLESS_API_KEY` | none | Featherless API key. Server-only. Missing key and mock off gives degraded `not_configured` verdicts. |
| `VISION_MODEL` | `Qwen/Qwen3-VL-30B-A3B-Instruct` | Model that transcribes screenshots. |
| `ANALYSIS_MODEL` | `Qwen/Qwen3-VL-30B-A3B-Instruct` | Model that produces the assessment. |
| `AI_MOCK` | `0` | `1` uses the mock model. If it is `1` while `VERCEL_ENV=production`, env validation throws and every request returns 500 `internal_error`. Any value other than `1` counts as `0`. |
| `RATE_LIMIT_PER_MINUTE` | `10` | Requests per minute per IP. Non-numeric or non-positive values fall back to 10. |

The real key never goes in git or in a `NEXT_PUBLIC_` variable. CI fails the build if `FEATHERLESS_API_KEY` or a key-like string appears in `.next/static`.

## Quick health check

With the app running (replace the port):

```bash
curl -s -X POST localhost:3000/api/analyze \
  -H 'content-type: application/json' \
  -d '{"text":"Urgent: buy Apple gift cards and keep this between us"}'
```

A healthy reply is `{"ok":true,"data":{...},"error":null,"requestId":"..."}` with `label: "scam"`. Check `data.degraded` and `data.degradedReason`: with a working key both should be `false` and `null`. An empty body `{}` returns a 400 `invalid_input`.

To confirm the key and model access (never paste the key into chat or logs):

```bash
curl -s -H "Authorization: Bearer $FEATHERLESS_API_KEY" https://api.featherless.ai/v1/models | head -c 300
```

A 401 or 403 is a key problem. A 402 or an "insufficient credits / plan" message is a plan problem.

## Switching models

Change `VISION_MODEL` or `ANALYSIS_MODEL`, restart or redeploy, then re-run `EVAL_LIVE=1 pnpm eval` and update `evals/RESULTS.md`. The provider adapter sends `chat_template_kwargs: { enable_thinking: false }` on every call, and `<think>...</think>` blocks are stripped from output, so hybrid reasoning models (Qwen3.5, Qwen3.6) work without extra setup.

Branch table from [PLAN.md](../PLAN.md):

| Condition | Action |
|---|---|
| Key not in `.env.local` by Oct 4 12:00 | Keep building on the mock; escalate to the owner. |
| Default `Qwen/Qwen3-VL-30B-A3B-Instruct` unavailable on the plan, or vision p50 above 8 s | Set `VISION_MODEL=Qwen/Qwen3.5-9B` (image input, concurrency cost 1), then `google/gemma-3-12b-it` (gated) if needed. |
| Text-only p50 above 8 s over 5 probe calls | Re-run the 5-call probe on `Qwen/Qwen3.5-9B` (thinking disabled) and switch only if it is faster. |
| No usable vision model | Move screenshot input to the cut list. There is no client-side OCR. |
| Analysis model returns unparseable JSON in more than 20% of probe calls | Set `ANALYSIS_MODEL=Qwen/Qwen3.6-27B` (concurrency cost 2). |

`google/gemma-3-27b-it` is gated on Featherless. Model IDs and plan access must be confirmed against `GET /v1/models` (see the health check).

## Degraded reasons

A degraded verdict is still a valid 200 response. `degradedReason` says why the AI layer was skipped.

| `degradedReason` | Meaning | What to do |
|---|---|---|
| `not_configured` | No `FEATHERLESS_API_KEY` and mock off. | Set the key and restart or redeploy. Expected in local runs without a key. |
| `provider_error` | The model call failed (network, 4xx or 5xx other than 429). | Check the Featherless status, key validity (401/403), credits (402) and that the model ID exists. Look at the log line for the request. |
| `rate_limited` | Featherless returned 429, usually concurrency units used up. Not the same as Unmask's own per-IP limit. | Calls are sequential, so look for several users at once or other apps on the same key. Wait, or move to a cheaper model (cost 1). |
| `timeout` | A model call used up its time budget (18 s per text request, 35 s with a screenshot, vision capped at 15 s). | Check Featherless latency. Consider a faster model per the branch table. |
| `parse_failed` | The model returned invalid JSON twice, or too little time was left for the repair retry. | Check how often it happens. Above about 20% means switch `ANALYSIS_MODEL` per the branch table. |

Users see the matching notice ("Our AI analyst is unavailable right now", and so on) and a verdict from the fixed checks only. A rise in degraded verdicts is the main signal to watch.

## API errors

| Status and code | Cause | Response |
|---|---|---|
| 400 `invalid_input` | Empty submission, a field over its limit, bad image type, unreadable JSON. | Client problem. The message is user-safe. |
| 413 `payload_too_large` | Body over 4,400,000 bytes. | Smaller image or text. Vercel itself rejects bodies over 4.5 MB with a non-JSON 413, which the UI maps to the same message. |
| 422 `image_unreadable` | Screenshot was the only input and the vision call failed. | Check the vision model. Users can paste the text instead. |
| 429 `rate_limited` | Per-IP limit hit. Has a `Retry-After` header. | See below. |
| 500 `internal_error` | Unexpected exception. | Find the log line with the `requestId` (event `analyze.error`). |

## Rate limit

An in-memory sliding window per server instance, 60 seconds wide. The default is 10 requests per minute per IP, set with `RATE_LIMIT_PER_MINUTE`.

- The value is read once when the server module loads. Change it, then restart or redeploy.
- The key is the first address in `x-forwarded-for`, which Vercel sets. With no such header, all requests share one `unknown` bucket. This is the case for plain local `curl` without that header.
- Each serverless instance has its own counter, so the limit is best-effort and not a hard cap. If abuse appears, move the counter to a shared store (see ASSUMPTIONS A-9). That would be a new design decision.
- The limit counts requests that reach the handler, including invalid ones.

## Logs and monitoring

The handler writes one JSON line per request with `console.info` (status 500 and above use `console.error`). On Vercel, read them in the project's Logs view.

Fields: `ts`, `requestId`, `event` (`analyze.ok`, `analyze.rejected`, `analyze.error`, `analyze.rate_limited`), `status`, `inputTypes`, `latencyMs`, `visionMs`, `analysisMs`, `repairRetried`, `model`, `label`, `degraded`, `degradedReason`, `errorCode`. Message text, URLs and images are never logged, and the logger type allows only these fields.

Worth watching:

- Share of `analyze.ok` lines with `degraded: true`, and which `degradedReason`.
- `latencyMs` against the targets (text p50 under 8 s, p95 under 20 s). Measured live numbers are not recorded yet.
- `repairRetried: true` frequency. A high rate means the model struggles with the JSON format.
- Spikes of `analyze.rate_limited`.

## Rotating the Featherless API key

Rotate on a schedule, after any suspected exposure, or when someone with access leaves.

1. Create a new key in the Featherless dashboard. Keep the old one active for now.
2. Update `FEATHERLESS_API_KEY` in the Vercel project (Production, and Preview if used) and in your local `.env.local`.
3. Redeploy. Vercel applies environment variable changes only to new deployments.
4. Run the health check. `degraded` should be `false`.
5. Revoke the old key in the dashboard.
6. If the old key was exposed, look for it in git history, CI logs and the built client bundle. The CI gitleaks job scans full history, and the bundle grep runs after `pnpm build`.

Never paste the key into chat, tickets or commits.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every verdict says the AI analyst "isn't switched on" | `not_configured`: no key. | Set `FEATHERLESS_API_KEY` or use `AI_MOCK=1`. |
| Every request returns 500 `internal_error` in production | `AI_MOCK=1` is set while `VERCEL_ENV=production`, so env validation throws. The log line has `event: analyze.error`. | Remove `AI_MOCK` from the production environment. |
| Summaries say "(mock analysis)" | The mock is on. | Set `AI_MOCK=0` or remove it. |
| Screenshots fail but text works | Vision model unavailable or too slow. | Switch `VISION_MODEL` per the branch table. |
| Users get "Too many checks" | Per-IP limit. | Wait a minute, or raise `RATE_LIMIT_PER_MINUTE` and redeploy. |
| Big screenshots fail | Over the 4.5 MB platform cap. | The client resizes to 1600 px JPEG. Ask the user to crop. |
| `pnpm test:e2e` hangs on start | Port 3200 busy, or build failing. | Free the port, run `pnpm build` and read the error. |
| Page loads with blank content or CSP errors | Inline script blocked after a header change. | The CSP must allow `'unsafe-inline'` scripts for Next.js. Check `next.config.ts`. |

## Pre-release checks

```bash
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm test:e2e
```

CI runs the same steps plus the bundle secret grep and gitleaks. Security findings and their status are tracked in [SECURITY.md](../SECURITY.md).
