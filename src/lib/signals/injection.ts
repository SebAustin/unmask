import type { Signal } from "@/lib/domain/signal";
import { normalizeForMatching } from "./normalize";

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,20}\b(?:all |any |the )?(?:previous|prior|above|earlier|preceding)\b[^.\n]{0,15}\b(?:instructions?|prompts?|rules?|directions?)/,
  /<\/?\s*(?:system|assistant|instructions?|untrusted_message)\b[^>]*>/,
  /\b(?:classify|mark|label|rate|flag|treat)\s+(?:this|the|it|me)?\s*(?:message|email|text|sms|content|request)?\s*as\s+(?:safe|legitimate|not (?:a )?scam|benign|harmless|trusted)\b(?![^.\n]{0,20}\bsender\b)/,
  /\b(?:say|state|respond|answer|output|conclude)\b[^.\n]{0,25}\b(?:this|it)\s+is\s+(?:safe|legitimate|not (?:a )?scam)\b/,
  /\b(?:note|message|instructions?) (?:to|for) (?:the )?(?:ai|llm|model|assistant|scanner|classifier|filter)s?\b/,
  /\b(?:you are|act as) (?:now )?(?:a|an|the) (?:helpful )?(?:ai|assistant|language model)\b/,
  /\bsystem prompt\b/,
];
const BASE64_BLOB = /[A-Za-z0-9+/]{16,}={0,2}/g;

export function injectionSignals(text: string): Signal[] {
  const candidates = [text, ...decodedBase64Blobs(text)];
  for (const candidate of candidates) {
    const normalized = normalizeForMatching(candidate);
    const pattern = INJECTION_PATTERNS.find((p) => p.test(normalized));
    if (!pattern) continue;
    return [
      {
        id: "injection.instructions-to-ai",
        severity: "hard",
        title: "Hidden instructions aimed at AI checkers",
        explanation:
          "The message contains text written to trick AI scam filters into calling it safe. Legitimate messages never do this.",
        quote: candidate === text ? quoteFrom(text, pattern) : undefined,
      },
    ];
  }
  return [];
}

function decodedBase64Blobs(text: string): string[] {
  return Array.from(text.matchAll(BASE64_BLOB), ([blob]) => {
    try {
      const decoded = Buffer.from(blob, "base64").toString("utf8");
      return /^[\x20-\x7e\s]+$/.test(decoded) ? decoded : "";
    } catch {
      return "";
    }
  }).filter(Boolean);
}

/** Returns the original (un-normalized) text of the match when it maps 1:1; otherwise no quote. */
function quoteFrom(text: string, pattern: RegExp): string | undefined {
  const match = text.toLowerCase().match(pattern);
  if (!match || match.index === undefined) return undefined;
  return text.slice(match.index, match.index + match[0].length);
}
