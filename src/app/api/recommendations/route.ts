import { q } from "@/lib/db";
import { err, json } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUSES = ["proposed", "accepted", "rejected", "in_progress", "implemented"];

export async function GET() {
  const rows = await q<any>("SELECT key, data, status, status_note, updated_at FROM recommendations WHERE active = true ORDER BY score DESC");
  return json({
    items: rows.map((r) => ({ ...r.data, status: r.status, statusNote: r.status_note, updatedAt: new Date(r.updated_at).toISOString() })),
  });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.key || !STATUSES.includes(body.status)) return err("Provide key and a valid status.");
  const rows = await q(
    "UPDATE recommendations SET status = $1, status_note = $2, updated_at = now() WHERE key = $3 RETURNING key",
    [body.status, body.note ? String(body.note).slice(0, 1000) : null, body.key],
  );
  if (!rows.length) return err("Recommendation not found", 404);
  return json({ ok: true });
}
