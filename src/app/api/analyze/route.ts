import { handleAnalyze } from "@/lib/server/handler";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleAnalyze(request);
}
