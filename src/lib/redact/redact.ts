export type MaskType = "card" | "ssn" | "iban" | "account" | "routing" | "code" | "password";

export interface Mask {
  readonly type: MaskType;
  readonly replacement: string;
}

export interface Redaction {
  readonly text: string;
  readonly masks: readonly Mask[];
}

interface MaskRule {
  readonly type: MaskType;
  readonly pattern: RegExp;
  /** Returns the replacement for the matched text, or null to leave it untouched. */
  readonly replace: (match: RegExpExecArray) => string | null;
}

const lastFour = (digits: string) => digits.replace(/\D/g, "").slice(-4);

// Order matters: specific, keyword-anchored rules run before the generic card rule.
const MASK_RULES: readonly MaskRule[] = [
  {
    // "password: X" / "password=X" — but never a link or domain, which is evidence (e.g. "Reset password: paypa1.com").
    type: "password",
    pattern: /\b(password|passcode|passwd|pwd|(?<!(?:boarding|bus|day|season|hall|bus) )pass)( ?[:=] ?)(?!https?:\/\/|www\.|[\w-]+(?:\.[\w-]+)+)(\S+)/gi,
    replace: (m) => `${m[1]}${m[2]}[password]`,
  },
  {
    // "my password is X" — only when X looks like a secret (contains a digit or symbol), not "is about to expire".
    type: "password",
    pattern: /\b(password|passcode)( is )(?!https?:\/\/|www\.|[\w-]+(?:\.[\w-]+)+)(?=\S*[\d!#$%&*@^~])(\S+)/gi,
    replace: (m) => `${m[1]}${m[2]}[password]`,
  },
  {
    type: "code",
    pattern: /\b(code|otp|pin|cvv|cvc|security code)( ?(?:[:=]|is)? ?)(\d{3,8})\b/gi,
    replace: (m) => `${m[1]}${m[2]}[code]`,
  },
  {
    type: "code",
    pattern: /\b\d{4,8}(?=\s+is\s+your\s+(?:\w+\s+){0,2}(?:code|otp|pin)\b)/gi,
    replace: () => "[code]",
  },
  {
    type: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b|(?<=\b(?:ssn|social security(?: number)?)\s*(?:#|:|is)?\s*)\d{9}\b/gi,
    replace: () => "[SSN]",
  },
  {
    type: "iban",
    // Must pass the IBAN mod-97 checksum and must not sit inside a link or domain (robustness H-C).
    pattern: /(?<![\w./:@-])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?(?![\w./:@-])/gi,
    replace: (m) => (isValidIban(m[0]) ? "[IBAN]" : null),
  },
  {
    type: "routing",
    pattern: /\b(routing(?: (?:number|no\.?|#))? ?:? ?)(\d{9})\b/gi,
    replace: (m) => `${m[1]}[routing number]`,
  },
  {
    type: "account",
    pattern: /\b((?:account|acct|a\/c)(?: (?:number|no\.?|#))? ?[:#]? ?)(\d{6,17})\b/gi,
    replace: (m) => `${m[1]}[account ••••${lastFour(m[2])}]`,
  },
  {
    type: "card",
    // 13–19 digits, optionally grouped by spaces or dashes; never preceded by "+" (phone numbers).
    pattern: /(?<![+\d])\d(?:[ .-]?\d){12,18}(?!\d)/g,
    replace: (m) => (passesLuhn(m[0].replace(/\D/g, "")) ? `[card ••••${lastFour(m[0])}]` : null),
  },
];

export function redact(input: string): Redaction {
  let text = input;
  const masks: Mask[] = [];
  for (const rule of MASK_RULES) {
    text = text.replace(new RegExp(rule.pattern.source, rule.pattern.flags), (...args) => {
      const match = toExecArray(args);
      const replacement = rule.replace(match);
      if (replacement === null) return match[0];
      masks.push({ type: rule.type, replacement: replacement.slice(replacement.indexOf("[")) });
      return replacement;
    });
  }
  return { text, masks };
}

/** Rebuilds a RegExpExecArray-like array from String.replace callback arguments. */
function toExecArray(args: unknown[]): RegExpExecArray {
  const firstNonString = args.findIndex((a, i) => i > 0 && typeof a !== "string" && a !== undefined);
  const groups = args.slice(0, firstNonString) as string[];
  return Object.assign(groups, { index: args[firstNonString] as number, input: "" }) as unknown as RegExpExecArray;
}

/** ISO 13616 mod-97 check: move the first four characters to the end, letters → numbers, remainder must be 1. */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/ /g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return digits.length > 0 && sum % 10 === 0;
}
