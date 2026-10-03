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
    type: "password",
    pattern: /\b(password|passcode|pwd)(\s*(?::|is)\s*)(\S+)/gi,
    replace: (m) => `${m[1]}${m[2]}[password]`,
  },
  {
    type: "code",
    pattern: /\b(code|otp|pin)(\s*(?::|is)\s*)(\d{4,8})\b/gi,
    replace: (m) => `${m[1]}${m[2]}[code]`,
  },
  {
    type: "code",
    pattern: /\b\d{4,8}(?=\s+is\s+your\s+(?:\w+\s+){0,2}(?:code|otp|pin)\b)/gi,
    replace: () => "[code]",
  },
  {
    type: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replace: () => "[SSN]",
  },
  {
    type: "iban",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    replace: () => "[IBAN]",
  },
  {
    type: "routing",
    pattern: /\b(routing(?:\s+(?:number|no\.?|#))?\s*:?\s*)(\d{9})\b/gi,
    replace: (m) => `${m[1]}[routing number]`,
  },
  {
    type: "account",
    pattern: /\b(account(?:\s+(?:number|no\.?|#))?\s*:?\s*)(\d{6,17})\b/gi,
    replace: (m) => `${m[1]}[account ••••${lastFour(m[2])}]`,
  },
  {
    type: "card",
    // 13–19 digits, optionally grouped by spaces or dashes; never preceded by "+" (phone numbers).
    pattern: /(?<![+\d])\d(?:[ -]?\d){12,18}(?!\d)/g,
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
