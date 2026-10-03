/**
 * Recovery Steps: static, reviewed content keyed by what the person already did (FR-10).
 * Deliberately not model-generated, so it is always available and never hallucinated.
 */
export type EngagementAction =
  | "clicked"
  | "gift_card"
  | "bank_transfer"
  | "crypto"
  | "card_payment"
  | "shared_credentials"
  | "shared_code"
  | "installed_software";

export interface ReportLink {
  readonly label: string;
  readonly href: string;
}

export interface RecoveryGuide {
  readonly action: EngagementAction;
  readonly label: string;
  readonly steps: readonly string[];
}

export const RECOVERY_GUIDES: readonly RecoveryGuide[] = [
  {
    action: "clicked",
    label: "I clicked the link",
    steps: [
      "Close the page. Don't enter anything else on it.",
      "If you typed a password there, change it now on the real website (type the address yourself), and anywhere you reuse it.",
      "Turn on two-step verification for that account.",
      "Run your device's built-in security scan and install pending updates.",
    ],
  },
  {
    action: "gift_card",
    label: "I paid with gift cards",
    steps: [
      "Contact the gift card company right away using the number on the back of the card or their official website. Tell them the card was used in a scam and ask for a refund.",
      "Keep the cards and receipts — the card numbers are the evidence.",
      "Report the scam to the FTC and your local police.",
    ],
  },
  {
    action: "bank_transfer",
    label: "I sent a wire or bank transfer (incl. Zelle)",
    steps: [
      "Call your bank immediately using the number on your card or statement. Say the word 'fraud' and ask them to recall or reverse the transfer.",
      "For international wires, also ask the bank to send a SWIFT recall request.",
      "Report it to the FBI's IC3 within 72 hours — that improves the chance of freezing the money.",
    ],
  },
  {
    action: "crypto",
    label: "I sent cryptocurrency",
    steps: [
      "Contact the exchange or app you used to send it and report the receiving wallet as fraud.",
      "Write down the transaction ID, wallet address, amount and time.",
      "Report to the FBI's IC3 and the FTC. Beware of 'recovery services' that promise to get it back for a fee — they are a second scam.",
    ],
  },
  {
    action: "card_payment",
    label: "I paid with a debit or credit card",
    steps: [
      "Call your card issuer using the number on the back of your card. Dispute the charge and ask for a new card number.",
      "Watch your statements for new unknown charges over the next few months.",
    ],
  },
  {
    action: "shared_credentials",
    label: "I gave my password or personal details",
    steps: [
      "Change the password on the real site (and anywhere you reuse it), then sign out of all other sessions.",
      "Turn on two-step verification.",
      "If you shared your Social Security number or ID details, visit IdentityTheft.gov for a personal recovery plan and consider freezing your credit with the three credit bureaus.",
    ],
  },
  {
    action: "shared_code",
    label: "I shared a verification code",
    steps: [
      "Sign in to that account now (through the official app) and change the password. Check recovery email, phone number and linked devices for changes.",
      "If it was a bank code, call your bank immediately using the number on your card.",
      "If you can't get in, use the service's official account-recovery page.",
    ],
  },
  {
    action: "installed_software",
    label: "I installed an app or let someone connect",
    steps: [
      "Disconnect from the internet, then uninstall the remote-access app (AnyDesk, TeamViewer, etc.).",
      "From a different, trusted device, change your email and banking passwords.",
      "Call your bank to warn them, and have the device checked or reset by a repair shop you choose.",
    ],
  },
];

export const REPORT_LINKS: readonly ReportLink[] = [
  { label: "FTC — ReportFraud.ftc.gov", href: "https://reportfraud.ftc.gov/" },
  { label: "FBI — Internet Crime Complaint Center (IC3)", href: "https://www.ic3.gov/" },
  { label: "IdentityTheft.gov — recovery plan", href: "https://www.identitytheft.gov/" },
  { label: "Forward scam texts to 7726 (SPAM) — US carriers", href: "https://www.ctia.org/consumer-resources/how-to-report-spam" },
];

export const INTERNATIONAL_NOTE =
  "Outside the US: contact your bank first, then your national fraud center (for example Action Fraud in the UK, the Canadian Anti-Fraud Centre, or Scamwatch in Australia).";
