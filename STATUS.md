# STATUS — Unmask

Resume point for any new session. Read this first, then `PLAN.md`.

## Done (tag v0.2 plus the review-fix commits)
- **Intake and plan:** `REQUIREMENTS.md`, `ASSUMPTIONS.md` (D-1, D-2), `CONTEXT.md`, ADR-0001 and ADR-0002. The plan loop ran 5 rounds and ended at 88/100.
- **Engine (TDD):** signals (URL, text, header, phone, injection with leet/spaced/base64/multilingual handling), combination rules, redaction, fusion with signal floors, span matching, assessment parsing, sanitizing model output, verification plan, degraded fallbacks, recovery content, safe word.
- **Server:** `/api/analyze`, which handles zod validation, 413/415, rate limiting (`RATE_LIMIT_PER_MINUTE`), request IDs, the allow-list logger (error names and status codes, no content), the mock model (refused on Vercel) and the Featherless provider with thinking disabled.
- **UI:** an accessibility pass covering the contrast tokens, native radios, live region, focus management, 44px targets, 320px with no overflow, and reduced motion.
- **Tests:**
  - 132 unit and integration tests at about 89% coverage on `src/lib`.
  - 26 Playwright runs (13 scenarios × desktop/mobile), including axe in light and dark (0 serious violations), a production-CSP check and the 320px overflow check.
  - The eval harness (44 fixtures, dev/holdout split) gives a rules-only baseline of 75% recall and 0% false positives (`evals/RESULTS-offline.md`).
- **Reviews:**
  - ux-designer: 15 fixes applied.
  - security-auditor: `SECURITY.md`, with F-01 HIGH fixed and no CRITICAL or HIGH open. F-05 (provider budget) needs deploy-time configuration.
  - robustness-reviewer: the CRITICAL ReDoS and all HIGH/MEDIUM findings fixed; re-review in progress.
- **Docs:** README, ARCHITECTURE.md with `docs/architecture.svg`, USER-GUIDE.md, docs/RUNBOOK.md, LICENSE, and screenshots in `docs/screenshots/` (taken with the mock; retake with the live model).

## Live
- Repo: https://github.com/SebAustin/unmask · Demo: https://unmask-ivory.vercel.app (rules-only until `FEATHERLESS_API_KEY` is set in Vercel)

## Next
1. **Blocked on the user:** `FEATHERLESS_API_KEY` in `.env.local`. Then:
   - run the keyed probe;
   - run `EVAL_LIVE=1 pnpm eval`, which writes `evals/RESULTS.md`, and fill the README TODO;
   - retake the screenshots without "(mock analysis)".
2. **Gated:** create the public GitHub repo and push (CI), then deploy to Vercel. Set the env vars there, plus a Firewall rate rule and a Featherless spend cap (F-05).
3. `ACCEPTANCE.md` (solution-verifier), `launch/DEVPOST.md`, `launch/DEMO-SCRIPT.md`.

## Run
- Dev server: `pnpm dev`. For an offline mock: `AI_MOCK=1 pnpm dev`. Screenshots: `node scripts/screenshots.mjs` against `AI_MOCK=1 pnpm start -p 3300`.
- Checks: `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`, `pnpm eval`, `pnpm typecheck`, `pnpm lint`.
