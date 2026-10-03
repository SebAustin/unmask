import type { Severity, Signal } from "@/lib/domain/signal";

interface TextRule {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  readonly explanation: string;
  readonly pattern: RegExp;
  /** When this matches the sentence around the hit, the hit is ignored (e.g. "do not share this code"). */
  readonly unless?: RegExp;
}

const TEXT_RULES: readonly TextRule[] = [
  {
    id: "text.gift-card-payment",
    severity: "high",
    title: "Asks for payment in gift cards",
    explanation: "No real business, boss or government agency takes payment in gift cards. This is the most common scam payment method.",
    pattern: /\b(?:(?:apple|google play|itunes|steam|amazon|ebay|target|walmart|razer gold)\s+)?gift\s?cards?\b|\b(?:google play|itunes|steam)\s+cards?\b/i,
  },
  {
    id: "text.crypto-payment",
    severity: "medium",
    title: "Asks for payment in cryptocurrency",
    explanation: "Crypto payments can't be reversed, which is why scammers prefer them.",
    pattern: /\b(?:bitcoin|btc|usdt|tether|ethereum|crypto(?:currency)?|wallet address|bitcoin atm)\b/i,
  },
  {
    id: "text.wire-p2p-payment",
    severity: "medium",
    title: "Pushes a hard-to-reverse payment",
    explanation: "Wire transfers and payment apps like Zelle or Cash App work like cash: once sent, the money is usually gone.",
    pattern: /\b(?:wire transfer|wire the|zelle|venmo|cash ?app|western union|moneygram)\b/i,
  },
  {
    id: "text.money-request",
    severity: "medium",
    title: "Asks you to send money",
    explanation: "Any unexpected request for money deserves a check through a channel you already trust.",
    pattern: /\b(?:(?:i|we) need (?:the |some )?money|send (?:me |us )?(?:the )?money|need \$\d[\d,]*|lend me \$?\d)/i,
  },
  {
    id: "text.urgency",
    severity: "medium",
    title: "Creates false urgency",
    explanation: "Pressure to act right now is designed to stop you from thinking or checking.",
    pattern: /\b(?:urgent(?:ly)?|immediately|right away|act now|final (?:notice|warning)|within \d+ (?:hours?|minutes?)|(?:will be|has been) (?:suspended|locked|closed|disabled)|expires? today|last chance)\b/i,
  },
  {
    id: "text.threat-authority",
    severity: "medium",
    title: "Threatens legal or official consequences",
    explanation: "Agencies like the police or tax office don't threaten arrest by text, email or phone call.",
    pattern: /\b(?:warrant|arrest(?:ed)?|lawsuit|legal action|police|deport(?:ation|ed)?|tax debt|court summons|jail)\b/i,
  },
  {
    id: "text.credential-request",
    severity: "high",
    title: "Asks for a code, password or login",
    explanation: "Real companies never ask you to send or read out a verification code or password.",
    pattern: /\b(?:(?:send|tell|give|share|read|forward|reply with|confirm)\b[^.!?\n]{0,30}\b(?:code|otp|pin|password|passcode)|(?:verify|confirm|update) your (?:account|identity|login|password|card details)|login details)\b/i,
    unless: /\b(?:do not|don't|never|won't ever|will never)\s+(?:\w+\s+){0,2}(?:share|give|tell|send|forward)\b/i,
  },
  {
    id: "text.secrecy",
    severity: "high",
    title: "Asks you to keep it secret",
    explanation: "Being told not to tell family, friends or your bank is a hallmark of scams.",
    pattern: /\b(?:keep (?:this|it) (?:between us|quiet|secret|confidential)|don'?t tell (?:anyone|your|my|mom|mum|dad)|do not tell (?:anyone|your)|don'?t (?:call|contact) (?:the bank|your bank|anyone|mom|mum|dad|your (?:parents|family)))\b/i,
  },
  {
    id: "text.remote-access",
    severity: "high",
    title: "Asks you to install remote-access software",
    explanation: "Remote-access apps give a stranger full control of your device and accounts.",
    pattern: /\b(?:anydesk|teamviewer|ultraviewer|screenconnect|quick ?assist|remote access|remote desktop)\b/i,
  },
  {
    id: "text.prize",
    severity: "medium",
    title: "Promises a prize you didn't enter",
    explanation: "You can't win a lottery or giveaway you never entered, and real prizes never require a fee.",
    pattern: /\b(?:you(?:'ve| have) won|winner|claim your (?:prize|reward)|lottery|sweepstakes)\b/i,
  },
  {
    id: "text.job-pay",
    severity: "medium",
    title: "Offers easy money for little work",
    explanation: "High pay for simple online tasks is the bait in job and task scams.",
    pattern: /\b(?:earn \$?\d[\d,]*\s*(?:\/|per|a)\s*(?:day|hour|week)|no experience (?:needed|required)|work from home[^.!?\n]{0,40}\$\d|task-based|optimi[sz]e (?:apps|products) for commission)\b/i,
  },
  {
    id: "text.guaranteed-returns",
    severity: "high",
    title: "Promises guaranteed investment returns",
    explanation: "No legitimate investment can guarantee profits. This is the core lie of investment scams.",
    pattern: /\b(?:guaranteed (?:returns?|profits?|income)|double your (?:money|investment|crypto)|risk[- ]free (?:investment|returns?|profit))\b/i,
  },
  {
    id: "text.family-emergency",
    severity: "medium",
    title: "Family emergency or 'new number' story",
    explanation: "Scammers pose as a relative in trouble, or claim to have a new number, to rush you into sending money. AI voice cloning makes these calls sound real.",
    pattern: /\b(?:(?:mum|mom|dad|grandma|grandpa|nana|granny)[,!]?\s+(?:it'?s me|i lost my phone|this is my new number)|(?:lost|broke) my phone|(?:this is )?my new number|in (?:an accident|jail|the hospital)[^.!?\n]{0,40}(?:money|bail|pay)|need (?:bail|money for bail))\b/i,
  },
];

export function textSignals(text: string): Signal[] {
  const signals: Signal[] = [];
  for (const rule of TEXT_RULES) {
    const match = firstUnnegatedMatch(text, rule);
    if (match === null) continue;
    signals.push({
      id: rule.id,
      severity: rule.severity,
      title: rule.title,
      explanation: rule.explanation,
      quote: match,
    });
  }
  return signals;
}

function firstUnnegatedMatch(text: string, rule: TextRule): string | null {
  const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
  for (const match of text.matchAll(global)) {
    if (!rule.unless) return match[0];
    const sentence = sentenceAround(text, match.index ?? 0, match[0].length);
    if (!rule.unless.test(sentence)) return match[0];
  }
  return null;
}

const CLAUSE_BREAKS = [".", "!", "?", ",", ";", "\n"];

/** The clause around a match, so "Don't worry, send me the code" isn't read as a negation of "send". */
function sentenceAround(text: string, index: number, length: number): string {
  const start = Math.max(0, ...CLAUSE_BREAKS.map((c) => text.lastIndexOf(c, index)));
  const endCandidates = CLAUSE_BREAKS.map((c) => text.indexOf(c, index + length)).filter((i) => i >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;
  return text.slice(start, end);
}
