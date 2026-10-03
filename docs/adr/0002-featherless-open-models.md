# Open-weight models via Featherless instead of a frontier API

We call open-weight models (by default `Qwen/Qwen3-VL-30B-A3B-Instruct` for both vision and analysis; configurable via env) through Featherless's OpenAI-compatible API. That uses the hackathon's sponsor credits and shows the approach works without a frontier-model budget. The trade-off is weaker structured output and vision quality, which is why output is zod-validated with one repair retry and why the deterministic signal layer does most of the explainable work.
