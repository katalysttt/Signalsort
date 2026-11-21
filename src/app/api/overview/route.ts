import { q } from "@/lib/db";
import { json } from "@/lib/api";
import { behaviourReport, latestResult } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sent, cats, srcs, unanalysed] = await Promise.all([
    q<any>("SELECT sentiment, count(*)::int AS n FROM feedback WHERE sentiment IS NOT NULL GROUP BY sentiment"),
    q<any>("SELECT category, count(*)::int AS n FROM feedback WHERE category IS NOT NULL GROUP BY category ORDER BY n DESC"),
    q<any>("SELECT source_type, count(*)::int AS n FROM feedback GROUP BY source_type ORDER BY n DESC"),
    q<any>("SELECT count(*)::int AS n FROM feedback WHERE analysis IS NULL"),
  ]);
  const sentiment = { positive: 0, negative: 0, neutral: 0, mixed: 0 } as Record<string, number>;
  sent.forEach((r) => (sentiment[r.sentiment] = r.n));
  const total = Object.values(sentiment).reduce((a, b) => a + b, 0);
  const result = await latestResult();
  const behaviour = await behaviourReport(true);
  const recs = await q<any>("SELECT status, count(*)::int AS n FROM recommendations WHERE active GROUP BY status");
  // Signal-level positive/negative counts (keeps mixed items' halves visible).
  const signalRows = await q<any>(
    `SELECT s->>'polarity' AS polarity, count(*)::int AS n FROM feedback, jsonb_array_elements(analysis->'signals') s GROUP BY 1`,
  );
  const signals: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
  signalRows.forEach((r) => (signals[r.polarity] = r.n));
  // Most recent analysis may be older than the newest feedback.
  const [latestFeedback] = await q<any>("SELECT max(created_at) AS t FROM feedback");
  const dailyFeedback = await q<any>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, count(*)::int AS n,
            count(*) FILTER (WHERE sentiment IN ('negative','mixed'))::int AS neg
     FROM feedback GROUP BY 1 ORDER BY 1`,
  );
  const matrix = await q<any>(
    "SELECT category, sentiment, count(*)::int AS n FROM feedback WHERE category IS NOT NULL AND sentiment IS NOT NULL GROUP BY 1, 2",
  );
  const [range] = await q<any>(
    `SELECT least((SELECT min(created_at) FROM feedback), (SELECT min(ts) FROM events)) AS min,
            greatest((SELECT max(created_at) FROM feedback), (SELECT max(ts) FROM events)) AS max`,
  );
  return json({
    totals: { feedback: total, unanalysed: unanalysed[0]?.n ?? 0 },
    sentiment,
    signals,
    categories: cats.map((c) => ({ category: c.category, count: c.n })),
    sources: srcs.map((s) => ({ source: s.source_type, count: s.n })),
    result,
    stale: !!(result && latestFeedback?.t && new Date(latestFeedback.t) > new Date(result.createdAt)),
    behaviour: {
      totals: behaviour.totals,
      dataOrigin: behaviour.dataOrigin,
      daily: behaviour.daily,
      funnels: behaviour.funnels,
      features: behaviour.features,
    },
    recommendationStatus: Object.fromEntries(recs.map((r) => [r.status, r.n])),
    dailyFeedback: dailyFeedback.map((d) => ({ date: d.date, feedback: d.n, negative: d.neg })),
    matrix: matrix.map((m) => ({ category: m.category, sentiment: m.sentiment, count: m.n })),
    range: { from: range?.min ? new Date(range.min).toISOString() : null, to: range?.max ? new Date(range.max).toISOString() : null },
  });
}
