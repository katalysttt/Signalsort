import { q } from "@/lib/db";
import { err, json, mapFeedback } from "@/lib/api";
import { latestResult } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const rows = await q(
    `SELECT f.*, ds.name AS source_name FROM feedback f LEFT JOIN data_sources ds ON ds.id = f.source_id WHERE f.id = $1`,
    [id],
  );
  if (!rows[0]) return err("Not found", 404);
  const result = await latestResult();
  const insights = (result?.insights ?? [])
    .filter((i) => i.evidence.some((e) => e.feedbackId === id))
    .map((i) => ({ key: i.key, title: i.title, kind: i.kind, priority: i.priority }));
  return json({ item: mapFeedback(rows[0]), insights });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  await q("DELETE FROM feedback WHERE id = $1", [id]);
  return json({ ok: true });
}
