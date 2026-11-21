import { q } from "@/lib/db";
import { json, writeKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await q<any>(
    `SELECT s.*, (SELECT count(*)::int FROM feedback f WHERE f.source_id = s.id) AS live_count
     FROM data_sources s ORDER BY s.created_at DESC`,
  );
  const ev = await q<any>(
    `SELECT source, count(*)::int AS n, count(DISTINCT user_id)::int AS users, max(received_at) AS last
     FROM events GROUP BY source`,
  );
  return json({
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      status: s.status,
      itemCount: s.live_count,
      createdAt: new Date(s.created_at).toISOString(),
      meta: s.meta,
    })),
    eventStreams: ev.map((e) => ({ source: e.source, events: e.n, users: e.users, lastReceived: e.last ? new Date(e.last).toISOString() : null })),
    writeKey: await writeKey(),
  });
}

export async function DELETE(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const events = u.searchParams.get("events");
  if (id) await q("DELETE FROM data_sources WHERE id = $1", [Number(id)]);
  if (events && ["sdk", "api", "simulated"].includes(events)) await q("DELETE FROM events WHERE source = $1", [events]);
  return json({ ok: true });
}
