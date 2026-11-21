import { q } from "@/lib/db";
import { err, json, mapFeedback } from "@/lib/api";
import { splitPasted, splitTranscript, storeItems } from "@/lib/ingest";
import type { SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = new URL(req.url).searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (s.get("q")) add("(f.text ILIKE ? )", `%${s.get("q")}%`);
  if (s.get("sentiment")) add("f.sentiment = ?", s.get("sentiment"));
  if (s.get("category")) add("f.category = ?", s.get("category"));
  if (s.get("source")) add("f.source_type = ?", s.get("source"));
  if (s.get("sourceId")) add("f.source_id = ?", Number(s.get("sourceId")));
  if (s.get("priority")) add("f.priority = ?", s.get("priority"));
  if (s.get("from")) add("f.created_at >= ?::timestamptz", s.get("from"));
  if (s.get("to")) add("f.created_at < (?::date + 1)", s.get("to"));
  if (s.get("ids")) add("f.id = ANY(?::int[])", s.get("ids")!.split(",").map(Number));
  const rows = await q(
    `SELECT f.*, ds.name AS source_name FROM feedback f LEFT JOIN data_sources ds ON ds.id = f.source_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY f.created_at DESC, f.id DESC LIMIT 1000`,
    params,
  );
  return json({ items: rows.map(mapFeedback) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) return err("Provide feedback text.");
  if (body.text.length > 500_000) return err("Text is too large (max 500k characters).");
  const type: SourceType = ["paste", "transcript", "support", "survey"].includes(body.sourceType) ? body.sourceType : "paste";
  const items =
    type === "transcript" || type === "support"
      ? splitTranscript(body.text, type)
      : splitPasted(body.text).map((t) => ({ text: t, author: body.author ?? null }));
  if (!items.length) return err("No feedback could be extracted from the text.");
  const labels: Record<string, string> = {
    paste: "Pasted feedback",
    transcript: "Interview transcript",
    support: "Support conversation",
    survey: "Survey responses",
  };
  const name = String(body.name || `${labels[type]} · ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`).slice(0, 120);
  const r = await storeItems({ name, type }, items);
  return json({ sourceId: r.sourceId, created: r.ids.length, ids: r.ids });
}
