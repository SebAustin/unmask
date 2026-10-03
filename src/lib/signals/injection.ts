import type { Signal } from "@/lib/domain/signal";
import { normalizeForMatching } from "./normalize";

// Every whitespace run sits between mandatory tokens: optional groups adjacent to \s* caused
// catastrophic backtracking on long space runs (ReDoS, see SECURITY.md / robustness review C1).
const INJECTION_PATTERNS: readonly RegExp[] = [
  /(?<!\b(?:never|not|don't|won't|do not)\b[^.,;\n-]{0,30})\b(?:ignore|disregard|forget|override)\b[^.\n]{0,20}\b(?:previous|prior|above|earlier|preceding)\b[^.\n]{0,15}\b(?:instructions?|prompts?|rules?|directions?)/,
  // A tag, not an address: "<system@x.com>" and Message-IDs like "<assistant.abc@google.com>" don't match.
  /<\/?[ ]?(?:system|assistant|instructions?|untrusted_message)(?:[ >/]|$)/,
  /\b(?:classify|mark|label|rate|flag|treat)(?: (?:this|the|it|me))?(?: (?:message|email|text|sms|content|request))? as (?:safe|legitimate|not (?:a )?scam|benign|harmless|trusted)\b(?![^.\n]{0,20}\bsender\b)/,
  /\b(?:say|state|respond|answer|output|conclude)\b[^.\n]{0,25}\b(?:this|it) is (?:safe|legitimate|not (?:a )?scam)\b/,
  /\b(?:note|message|instructions?) (?:to|for) (?:the )?(?:ai|llm|language model|ai model|ai assistant|spam filter|scam filter|classifier|scanner)s?\b/,
  /\b(?:you are now|act as|you are) (?:a|an|the) (?:helpful )?(?:ai(?: assistant)?|language model|chatbot)\b/,
  /\b(?:ignore|reveal|print|show|override)\b[^.\n]{0,15}\bsystem prompt\b/,
  // Aimed at an automated reviewer AND asking for a safe/low outcome ("rate this 0-5 stars" alone is a survey).
  /\b(?:automated|ai|automatic) (?:reviewer|review|scanner|checker|filter|moderator)s?\b[^.\n]{0,40}\b(?:rate|score|mark|classify|treat)\b[^.\n]{0,20}\b(?:safe|legitimate|benign|0|zero|low risk|not (?:a )?scam)\b/,
  /\b(?:tell|inform|advise) the (?:reader|user|recipient)\b[^.\n]{0,40}\b(?:official|real|verified|legitimate) (?:support |help |fraud |customer )?(?:number|line|phone|site|website|link|contact)\b/,
  /\bignora (?:las |todas las )?instrucciones (?:anteriores|previas)\b/,
  /\bignore[sz]? (?:les |toutes les )?instructions (?:pr[ée]c[ée]dentes|ant[ée]rieures)\b/,
];
const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
const BASE64_BLOB = /[A-Za-z0-9+/]{16,}={0,2}/g;

export function injectionSignals(text: string): Signal[] {
  const candidates = [text, ...decodedBase64Blobs(text)];
  for (const candidate of candidates) {
    const normalized = normalizeForMatching(candidate);
    // Spaced letters must be collapsed BEFORE whitespace normalization, while 2+ spaces still mark word breaks.
    const variants = [normalized, foldLeet(normalized), normalizeForMatching(collapseSpacedLetters(candidate))];
    const pattern = INJECTION_PATTERNS.find((p) => variants.some((v) => p.test(v)));
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

function foldLeet(text: string): string {
  return text.replace(/[0134573@$]/g, (ch) => LEET[ch] ?? ch);
}

/** "i g n o r e  p r e v i o u s" → "ignore previous": single letters joined; double spaces stay word breaks. */
function collapseSpacedLetters(text: string): string {
  return text.replace(/(?<![^\s])(?:\w [^\S\n]?){2,}\w(?![^\s])/g, (run) => run.split(/ {2,}/).map((w) => w.replace(/ /g, "")).join(" "));
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
  const lower = text.toLowerCase();
  if (lower.length !== text.length) return undefined; // lower-casing changed offsets ("İ"); no quote rather than a wrong one
  const match = lower.match(pattern);
  if (!match || match.index === undefined) return undefined;
  return text.slice(match.index, match.index + match[0].length);
}
