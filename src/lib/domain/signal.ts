import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "hard"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const SignalSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  explanation: z.string(),
  /** Verbatim text from the Exhibit that triggered the Signal, when there is one. */
  quote: z.string().optional(),
});
export type Signal = z.infer<typeof SignalSchema>;
