import { q } from "@/lib/db";
import { json } from "@/lib/api";
import { behaviourReport } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const includeSimulated = new URL(req.url).searchParams.get("simulated") !== "0";
  const recent = await q<any>(
    `SELECT event, user_id, properties, ts, source FROM events ${includeSimulated ? "" : "WHERE source <> 'simulated'"} ORDER BY received_at DESC, id DESC LIMIT 25`,
  );
  return json({
    report: await behaviourReport(includeSimulated),
    includeSimulated,
    recent: recent.map((r) => ({ event: r.event, userId: r.user_id, properties: r.properties, ts: new Date(r.ts).toISOString(), source: r.source })),
  });
}
