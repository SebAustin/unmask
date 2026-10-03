import "server-only";

/** Only these fields may be logged. Message content never is (NFR-1). */
export interface LogFields {
  readonly requestId: string;
  readonly event: "analyze.ok" | "analyze.rejected" | "analyze.error" | "analyze.rate_limited";
  readonly status: number;
  readonly inputTypes?: readonly string[];
  readonly latencyMs?: number;
  readonly visionMs?: number | null;
  readonly analysisMs?: number | null;
  readonly degraded?: boolean;
  readonly degradedReason?: string | null;
  readonly model?: string;
  readonly repairRetried?: boolean;
  readonly label?: string;
  readonly errorCode?: string;
}

export function logEvent(fields: LogFields): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...fields });
  if (fields.status >= 500) console.error(line);
  else console.info(line);
}
