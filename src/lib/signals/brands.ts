/**
 * Brands commonly impersonated in phishing, mapped to the registrable domains they really use.
 * The key is the token we look for inside lookalike domains.
 */
export const BRANDS: Readonly<Record<string, readonly string[]>> = {
  paypal: ["paypal.com", "paypal.me"],
  apple: ["apple.com", "icloud.com", "email.apple.com"],
  icloud: ["icloud.com", "apple.com"],
  amazon: ["amazon.com", "amazonses.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.in"],
  microsoft: ["microsoft.com", "live.com", "outlook.com", "office.com"],
  outlook: ["outlook.com", "live.com", "microsoft.com"],
  office365: ["office.com", "microsoft.com"],
  google: ["google.com", "gmail.com", "youtube.com"],
  gmail: ["gmail.com", "google.com"],
  netflix: ["netflix.com"],
  chase: ["chase.com", "jpmorganchase.com"],
  bankofamerica: ["bankofamerica.com", "bofa.com"],
  wellsfargo: ["wellsfargo.com"],
  citibank: ["citi.com", "citibank.com"],
  capitalone: ["capitalone.com"],
  americanexpress: ["americanexpress.com", "aexp.com"],
  amex: ["americanexpress.com"],
  barclays: ["barclays.co.uk", "barclays.com", "barclaycard.co.uk"],
  hsbc: ["hsbc.com", "hsbc.co.uk"],
  santander: ["santander.com", "santander.co.uk"],
  usps: ["usps.com"],
  fedex: ["fedex.com"],
  dhl: ["dhl.com"],
  royalmail: ["royalmail.com"],
  irs: ["irs.gov"],
  coinbase: ["coinbase.com"],
  binance: ["binance.com"],
  venmo: ["venmo.com"],
  zelle: ["zellepay.com"],
  cashapp: ["cash.app", "squareup.com"],
  facebook: ["facebook.com", "fb.com", "meta.com", "facebookmail.com"],
  instagram: ["instagram.com"],
  whatsapp: ["whatsapp.com", "whatsapp.net"],
  docusign: ["docusign.com", "docusign.net"],
  walmart: ["walmart.com"],
  steam: ["steampowered.com", "steamcommunity.com"],
  verizon: ["verizon.com"],
  tmobile: ["t-mobile.com"],
};

export const OFFICIAL_DOMAINS: ReadonlySet<string> = new Set(Object.values(BRANDS).flat());

/** Hosts where anyone can publish a page; a brand name on them is never official. */
export const USER_CONTENT_HOSTS: ReadonlySet<string> = new Set([
  "amazonaws.com", "web.app", "firebaseapp.com", "pages.dev", "netlify.app", "vercel.app",
  "github.io", "windows.net", "r2.dev", "glitch.me", "herokuapp.com", "weebly.com", "wixsite.com",
  "blogspot.com", "googleusercontent.com",
]);

/** Places on official domains where anyone can publish a form or page. */
export const USER_CONTENT_ON_OFFICIAL: readonly { host: string; pathPrefix: string }[] = [
  { host: "docs.google.com", pathPrefix: "/forms" },
  { host: "forms.gle", pathPrefix: "/" },
  { host: "sites.google.com", pathPrefix: "/" },
  { host: "drive.google.com", pathPrefix: "/" },
  { host: "forms.office.com", pathPrefix: "/" },
  { host: "1drv.ms", pathPrefix: "/" },
];

/** Brands that are also everyday words; seeing them in an address is suspicious, not conclusive. */
export const COMMON_WORD_BRANDS: ReadonlySet<string> = new Set(["apple", "chase", "steam", "outlook"]);

/** Ordinary words within a typo or two of a brand name; never treated as look-alikes. */
export const LOOKALIKE_ALLOWLIST: ReadonlySet<string> = new Set([
  "team", "stream", "finance", "mobile", "email", "apply", "maple", "ample", "phase", "case",
  "chaise", "venue", "horizon", "hello", "cello", "jello", "steal", "steak", "steel", "beam",
  "dream", "cream", "mail", "gmbh", "apples", "chased", "chaser", "chess", "zeal", "image",
  "google", "doodle", "noodle", "goggle", "inflix", "venom", "paypal", "staple", "simple",
  "purple", "people", "office", "binary", "binder", "amazing", "amazed", "stem", "seam", "chose",
  "belle", "steamy", "netflux",
]);

/** How each brand key is written for people. */
const BRAND_DISPLAY: Readonly<Record<string, string>> = {
  paypal: "PayPal", apple: "Apple", icloud: "Apple", amazon: "Amazon", microsoft: "Microsoft",
  outlook: "Microsoft", office365: "Microsoft", google: "Google", gmail: "Google", netflix: "Netflix",
  chase: "Chase", bankofamerica: "Bank of America", wellsfargo: "Wells Fargo", citibank: "Citi",
  capitalone: "Capital One", americanexpress: "American Express", amex: "American Express",
  barclays: "Barclays", hsbc: "HSBC", santander: "Santander", usps: "USPS", fedex: "FedEx", dhl: "DHL",
  royalmail: "Royal Mail", irs: "the IRS", coinbase: "Coinbase", binance: "Binance", venmo: "Venmo",
  zelle: "Zelle", cashapp: "Cash App", facebook: "Facebook", instagram: "Instagram",
  whatsapp: "WhatsApp", docusign: "DocuSign", walmart: "Walmart", steam: "Steam", verizon: "Verizon",
  tmobile: "T-Mobile",
};

export function brandDisplayName(brand: string): string {
  return BRAND_DISPLAY[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}
