// Event ingestion API used by the JavaScript SDK (public/sdk/signalsort.js)
// and by server-side integrations.
//
// POST /api/track
// Headers: x-signalsort-key: <write key>   (or body.writeKey)
// Body: { events: [{ event, userId, sessionId?, properties?, timestamp? }], sdk?: string }
import { q } from "@/lib/db";
import { writeKey } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-signalsort-key",
};

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: CORS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let body: any;
  try {
    // sendBeacon posts text/plain; parse manually to support both.
    body = JSON.parse(await req.text());
  } catch {
    return reply({ error: "Body must be JSON." }, 400);
  }
  const key = req.headers.get("x-signalsort-key") ?? body?.writeKey;
  if (key !== (await writeKey())) return reply({ error: "Invalid write key." }, 401);
  const events = Array.isArray(body?.events) ? body.events : body?.event ? [body] : [];
  if (!events.length) return reply({ error: "No events supplied." }, 400);
  if (events.length > 500) return reply({ error: "Max 500 events per request." }, 413);
  const source = body.sdk ? "sdk" : "api";
  let accepted = 0;
  const rejected: { index: number; reason: string }[] = [];
  const values: unknown[] = [];
  const tuples: string[] = [];
  events.forEach((e: any, index: number) => {
    const name = typeof e?.event === "string" ? e.event.trim() : "";
    const userId = String(e?.userId ?? e?.anonymousId ?? "").trim();
    if (!name || name.length > 100 || !/^[\w.:-]+$/.test(name)) return rejected.push({ index, reason: "invalid event name" });
    if (!userId || userId.length > 200) return rejected.push({ index, reason: "userId or anonymousId required" });
    const props = e.properties && typeof e.properties === "object" && !Array.isArray(e.properties) ? e.properties : {};
    const propsJson = JSON.stringify(props);
    if (propsJson.length > 8000) return rejected.push({ index, reason: "properties too large" });
    let ts = e.timestamp ? new Date(e.timestamp) : new Date();
    if (isNaN(ts.getTime()) || Math.abs(ts.getTime() - Date.now()) > 30 * 86_400_000) ts = new Date();
    const n = values.length;
    values.push(name, userId, e.sessionId ? String(e.sessionId).slice(0, 200) : null, propsJson, ts.toISOString(), source);
    tuples.push(`($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}::jsonb, $${n + 5}::timestamptz, $${n + 6})`);
    accepted++;
  });
  if (tuples.length) {
    await q(`INSERT INTO events(event, user_id, session_id, properties, ts, source) VALUES ${tuples.join(",")}`, values);
  }
  return reply({ accepted, rejected });
}
