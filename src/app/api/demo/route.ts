// Loads (or clears) the hackathon demonstration scenario.
import { q } from "@/lib/db";
import { json } from "@/lib/api";
import { buildDemoEvents, DEMO_FEEDBACK, DEMO_EVENT_SPEC, DEMO_PRODUCT } from "@/lib/demo";
import { analyseItemsNow, runAnalysis } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  // Replace any previous demo data so the scenario is reproducible.
  await q("DELETE FROM data_sources WHERE type = 'demo' OR (meta->>'simulated') = 'true'");
  await q("DELETE FROM events WHERE source = 'simulated'");
  const [src] = await q<{ id: number }>(
    "INSERT INTO data_sources(name, type, status, item_count, meta) VALUES ($1, 'demo', 'ready', $2, $3::jsonb) RETURNING id",
    [`Demo feedback · ${DEMO_PRODUCT}`, DEMO_FEEDBACK.length, JSON.stringify({ product: DEMO_PRODUCT })],
  );
  const ids: number[] = [];
  for (const f of DEMO_FEEDBACK) {
    const [r] = await q<{ id: number }>(
      "INSERT INTO feedback(text, source_type, source_id, author) VALUES ($1, 'demo', $2, $3) RETURNING id",
      [f.text, src.id, `${f.author} (${f.channel})`],
    );
    ids.push(r.id);
  }
  await analyseItemsNow(ids);

  const events = buildDemoEvents();
  for (let i = 0; i < events.length; i += 400) {
    const chunk = events.slice(i, i + 400);
    const values: unknown[] = [];
    const tuples = chunk.map((e, j) => {
      values.push(e.event, e.userId, e.sessionId, JSON.stringify(e.properties), e.ts);
      const n = j * 5;
      return `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}::jsonb, $${n + 5}::timestamptz, 'simulated')`;
    });
    await q(`INSERT INTO events(event, user_id, session_id, properties, ts, source) VALUES ${tuples.join(",")}`, values);
  }
  await q(
    `INSERT INTO data_sources(name, type, status, item_count, meta) VALUES ('Simulated FoodDash events', 'sdk', 'connected', $1, $2::jsonb)`,
    [events.length, JSON.stringify({ simulated: true, spec: DEMO_EVENT_SPEC })],
  );
  const result = await runAnalysis();
  return json({ ok: true, feedback: ids.length, events: events.length, insights: result.insights.length });
}

export async function DELETE() {
  await q("DELETE FROM feedback");
  await q("DELETE FROM data_sources");
  await q("DELETE FROM events");
  await q("DELETE FROM recommendations");
  await q("DELETE FROM analysis_runs");
  return json({ ok: true });
}
