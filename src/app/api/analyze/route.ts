import { err, json } from "@/lib/api";
import { runAnalysis } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const result = await runAnalysis({ force: !!body.force });
    return json({ ok: true, runId: result.runId, engine: result.engine, insights: result.insights.length, notes: result.notes });
  } catch (e: any) {
    return err(`Analysis failed: ${e.message}`, 500);
  }
}
