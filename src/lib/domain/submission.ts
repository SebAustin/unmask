import { z } from "zod";

export const LIMITS = {
  textChars: 10_000,
  headersChars: 20_000,
  urlChars: 2_048,
  /** Encoded data-URL length (~3 MB decoded) so the whole body stays under Vercel's 4.5 MB cap. */
  imageDataUrlChars: 4_000_000,
  bodyBytes: 4_400_000,
} as const;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is too long (max ${max.toLocaleString("en-US")} characters).`)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined));

export const SubmissionSchema = z
  .object({
    text: optionalText(LIMITS.textChars, "Message"),
    url: optionalText(LIMITS.urlChars, "Link"),
    headers: optionalText(LIMITS.headersChars, "Email headers"),
    image: z
      .string()
      .max(LIMITS.imageDataUrlChars, "Screenshot is too large. Try a smaller or cropped image.")
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Screenshot must be a PNG, JPEG or WebP image.")
      .optional(),
  })
  .refine((s) => Boolean(s.text || s.url || s.headers || s.image), {
    message: "Paste a message, a link, email headers or a screenshot to check.",
  });
/** A validated Submission (see CONTEXT.md): at least one field is present. */
export interface Submission {
  readonly text?: string;
  readonly url?: string;
  readonly headers?: string;
  readonly image?: string;
}
