# STATUS — Unmask

Resume point for any new session. Read this first, then `PLAN.md`.

## Done
- Intake: `REQUIREMENTS.md`, `ASSUMPTIONS.md`, `CONTEXT.md`, `docs/adr/0001`, `0002`.
- Plan loop: 5 rounds, final 88/100 (cap reached). Residual defects were fixed in code with regression tests.
- Engine (TDD, `src/lib`): url/text/header/phone/injection signals, combo rules, redaction, fusion with signal floors, span matching, assessment parsing, prompt with random boundary, verification plan with identity sanitizing, degraded fallbacks, recovery content, safe word.
- Pipeline: `analyzeSubmission` covers vision, redaction, signals, model, repair retry, fusion and spans; timeouts and every failure path are tested.
- Server: `/api/analyze` with zod validation, 413 handling, rate limit, request ID, an allow-list logger, a mock model (`AI_MOCK=1` plus `[[mock:*]]` sentinels) and the Featherless provider with thinking disabled.
- UI: hero, checker form (text, link, headers, screenshot with client resize), sample gallery, verdict (stamp, risk meter, annotated exhibit, red flags, verification plan), recovery panel, safe-word card, security headers and CSP.
- Tests: 106 unit/integration tests at 89.7% statement coverage on `src/lib`; 20 Playwright E2E tests (desktop and mobile) against a production build.

## In progress / next
1. **Blocked on the user:** `FEATHERLESS_API_KEY` in `.env.local`. Then run the keyed probe (JSON reliability, latency, 429) and record the results here.
2. Eval set (≥40 items) in `evals/`, `pnpm eval`, and `evals/RESULTS.md`.
3. Review loop: robustness-reviewer, security-auditor (`SECURITY.md`) and a ux-designer review.
4. Gated: create the GitHub repo and push (CI), then the Vercel deploy.
5. Docs: README, ARCHITECTURE.md + diagram, ACCEPTANCE.md, LICENSE, launch/DEVPOST.md, launch/DEMO-SCRIPT.md, screenshots.

## Run
- `pnpm dev`: local dev server. Set `AI_MOCK=1` for the offline mock.
- `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`.
