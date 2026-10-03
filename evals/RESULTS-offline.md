# Eval results — rules only (no model)

Generated 2026-10-03T22:03:58.374Z by `pnpm eval` over 44 hand-written fixtures (28 scam, 16 legit). SC-2/3 are scored on the full set; the holdout split was not used for tuning.

| Metric | Target | Full set | Holdout |
|---|---|---|---|
| Scam recall (Scam or Suspicious) | ≥ 85% | 75.0% | 50.0% |
| Scams labelled "Scam" | — | 50.0% | 41.7% |
| False positives (legit → Scam) | ≤ 10% | 0.0% | 0.0% |
| Legit → Suspicious | ≤ 20% | 0.0% | 0.0% |
| Injection fixtures never "Likely safe" | 5/5 | 5/5 | |
| Degraded verdicts | 0 (live) | 44 | 19 |
| p50 latency (ms) | < 8000 (live) | 0 | 0 |

Misses: `s05-ssa`, `s07-dhl`, `s10-job-task`, `s14-crypto-pig`, `s16-invoice`, `s18-hi-mum`, `s22-toll`

| Fixture | Split | Expected | Verdict | Risk | Type | Degraded | ms |
|---|---|---|---|---|---|---|---|
| s01-bank-lock | dev | scam | suspicious | 60 | bank | not_configured | 10 |
| s02-bank-call | holdout | scam | scam | 95 | other | not_configured | 1 |
| s03-bank-otp | dev | scam | suspicious | 35 | bank | not_configured | 1 |
| s04-irs | dev | scam | suspicious | 60 | other | not_configured | 0 |
| s05-ssa | holdout | scam | likely_safe | 30 | none | not_configured | 0 |
| s06-usps | dev | scam | scam | 80 | delivery | not_configured | 1 |
| s07-dhl | holdout | scam | likely_safe | 15 | none | not_configured | 0 |
| s08-techsupport | dev | scam | suspicious | 45 | tech_support | not_configured | 0 |
| s09-techrefund | holdout | scam | suspicious | 35 | tech_support | not_configured | 0 |
| s10-job-task | dev | scam | likely_safe | 15 | none | not_configured | 0 |
| s11-job-check | holdout | scam | scam | 80 | invoice_ceo | not_configured | 0 |
| s12-romance | dev | scam | scam | 95 | other | not_configured | 1 |
| s13-crypto | dev | scam | scam | 95 | crypto_investment | not_configured | 0 |
| s14-crypto-pig | holdout | scam | likely_safe | 15 | none | not_configured | 0 |
| s15-ceo | dev | scam | scam | 100 | invoice_ceo | not_configured | 10 |
| s16-invoice | holdout | scam | likely_safe | 0 | none | not_configured | 0 |
| s17-grandparent | dev | scam | scam | 100 | family_emergency | not_configured | 0 |
| s18-hi-mum | holdout | scam | likely_safe | 15 | none | not_configured | 0 |
| s19-prize | dev | scam | scam | 100 | other | not_configured | 0 |
| s20-paypal-email | holdout | scam | scam | 100 | account_takeover | not_configured | 1 |
| s21-netflix | dev | scam | suspicious | 45 | other | not_configured | 0 |
| s22-toll | holdout | scam | likely_safe | 0 | none | not_configured | 0 |
| s23-voicemail-clone | dev | scam | scam | 100 | other | not_configured | 0 |
| s24-inj-plain | dev | scam | scam | 95 | other | not_configured | 1 |
| s25-inj-system | holdout | scam | scam | 80 | other | not_configured | 0 |
| s26-inj-base64 | dev | scam | suspicious | 65 | invoice_ceo | not_configured | 0 |
| s27-inj-zerowidth | holdout | scam | scam | 95 | account_takeover | not_configured | 0 |
| s28-inj-image | dev | scam | scam | 100 | delivery | not_configured | 22 |
| l01-2fa | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l02-lunch | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l03-amazon-ship | holdout | legit | likely_safe | 0 | none | not_configured | 0 |
| l04-signup-confirm | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l05-zelle-receipt | holdout | legit | likely_safe | 15 | none | not_configured | 0 |
| l06-outlook-footer | dev | legit | likely_safe | 0 | none | not_configured | 1 |
| l07-chase-miller | holdout | legit | likely_safe | 0 | none | not_configured | 0 |
| l08-pwreset | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l09-dentist | holdout | legit | likely_safe | 0 | none | not_configured | 0 |
| l10-google-doc | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l11-utility | holdout | legit | likely_safe | 0 | none | not_configured | 0 |
| l12-school | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l13-bank-statement | holdout | legit | likely_safe | 0 | none | not_configured | 1 |
| l14-ride | dev | legit | likely_safe | 0 | none | not_configured | 0 |
| l15-colleague-urgent | holdout | legit | likely_safe | 15 | none | not_configured | 0 |
| l16-team-newsletter | dev | legit | likely_safe | 0 | none | not_configured | 0 |
