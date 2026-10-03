export interface Sample {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly text?: string;
  readonly url?: string;
  readonly headers?: string;
}

/** One-click examples for the gallery (FR-12). Synthetic; no real victim data. */
export const SAMPLES: readonly Sample[] = [
  {
    id: "bank-sms",
    label: "Bank alert text",
    kind: "SMS",
    text: "CHASE ALERT: Unusual sign-in detected. Your account has been locked. Verify your identity within 24 hours at chase-secure-verify.top/login or your card will be suspended.",
  },
  {
    id: "delivery",
    label: "Missed delivery fee",
    kind: "SMS",
    text: "USPS: Your package is on hold due to an unpaid $1.99 redelivery fee. Pay now to avoid return to sender: https://usps-redelivery.xyz/pay",
  },
  {
    id: "ceo-gift-card",
    label: "Boss needs gift cards",
    kind: "Email",
    text: "Hi, are you at your desk? I'm in a meeting and can't talk. I need you to buy 6 Apple gift cards ($200 each) for a client today. Keep this between us for now, it's a surprise. Scratch the backs and send me photos of the codes urgently. Thanks, Mark (CEO)",
  },
  {
    id: "crypto",
    label: "Crypto investment tip",
    kind: "DM",
    text: "Hey dear, I've been trading with this platform for 3 months. Guaranteed returns of 30% every week, risk-free. My mentor can help you start with just $500 in USDT. Register at coinbase-pro-earn.com and send me your wallet address.",
  },
  {
    id: "grandparent",
    label: "Grandparent emergency call",
    kind: "Call transcript",
    text: "Grandma, it's me! I was in an accident and the police took my phone, this is my new number. I need $3,000 for bail right away. Please don't tell mom and dad, they'll be so mad. Can you send it by Zelle or buy gift cards?",
  },
  {
    id: "spoofed-email",
    label: "Spoofed PayPal email",
    kind: "Email headers",
    text: "Your PayPal account has been limited. Confirm your account details to restore access.",
    headers: `From: "PayPal Security" <service@paypa1-alerts.com>
Reply-To: resolution-center@gmail.com
Return-Path: <bounce@bulk-mailer.net>
Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=paypa1-alerts.com; dkim=none; dmarc=fail`,
  },
  {
    id: "legit-2fa",
    label: "Real 2FA code (legit)",
    kind: "SMS",
    text: "Your Microsoft verification code is 482913. Don't share this code with anyone. Microsoft will never ask you for it.",
  },
];
