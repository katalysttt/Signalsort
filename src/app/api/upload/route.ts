import { err, json } from "@/lib/api";
import { parseFile, storeItems } from "@/lib/ingest";
import type { SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return err("Expected multipart form data.");
  const hint = (form.get("type") as SourceType | null) ?? null;
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!files.length) return err("Attach at least one file.");
  const results = [];
  for (const file of files) {
    if (file.size > MAX) return err(`${file.name} is larger than 15 MB.`);
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const { type, items } = await parseFile(file.name, buf, hint);
      if (!items.length) {
        results.push({ file: file.name, created: 0, error: "No feedback text found in this file." });
        continue;
      }
      const r = await storeItems({ name: file.name, type, meta: { size: file.size, hint } }, items.slice(0, 5000));
      results.push({ file: file.name, type, created: r.ids.length, sourceId: r.sourceId });
    } catch (e: any) {
      results.push({ file: file.name, created: 0, error: `Could not parse file: ${e.message}` });
    }
  }
  return json({ results });
}
