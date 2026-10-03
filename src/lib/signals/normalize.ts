/** Cyrillic/Greek letters that render like Latin ones, folded to their Latin twin. */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", ԁ: "d", ɡ: "g",
  ӏ: "l", ᴠ: "v", ԝ: "w", ո: "n", α: "a", ε: "e", ο: "o", ρ: "p", τ: "t", υ: "u", ν: "v", κ: "k",
};
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad]/g;

/** Canonical form for matching: NFKC, invisible characters removed, whitespace collapsed, homoglyphs folded, lower-case. */
export function normalizeForMatching(text: string): string {
  return Array.from(
    text
      .normalize("NFKC")
      .replace(INVISIBLE, "")
      .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace runs (defence in depth against ReDoS)
      .replace(/\n{2,}/g, "\n")
      .toLowerCase(),
  )
    .map((ch) => HOMOGLYPHS[ch] ?? ch)
    .join("");
}
