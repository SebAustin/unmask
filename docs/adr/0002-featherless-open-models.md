# Open-weight models via Featherless instead of a frontier API

We call open-weight models (vision: Gemma 3 27B; analysis: configurable) through Featherless's OpenAI-compatible API. That uses the hackathon's sponsor credits and shows the approach works without a frontier-model budget. The trade-off is weaker structured output and vision quality, which is why output is zod-validated with one repair retry and why the deterministic signal layer does most of the explainable work.
