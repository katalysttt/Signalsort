// File & text ingestion: turns uploads into feedback items.
import Papa from "papaparse";
import { q } from "./db";
import { analyseItemsNow } from "./pipeline";
import { parseRows, splitPasted, splitTranscript, type ParsedItem } from "./ingest-pure";
export { parseRows, splitPasted, splitTranscript, type ParsedItem };
import type { SourceType } from "./types";

export async function parseFile(name: string, buf: Buffer, hint: SourceType | null): Promise<{ type: SourceType; items: ParsedItem[] }> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || ext === "tsv") {
    const parsed = Papa.parse<Record<string, unknown>>(buf.toString("utf8"), { header: true, skipEmptyLines: true });
    const type = hint === "survey" ? "survey" : "csv";
    return { type, items: parseRows(parsed.data, type === "survey") };
  }
  if (ext === "xls") {
    throw new Error("Legacy .xls files are not supported. In Excel, use File → Save As → .xlsx (or .csv) and upload again.");
  }
  if (ext === "xlsx") {
    const type = hint === "survey" ? "survey" : "excel";
    return { type, items: parseRows(await xlsxRows(buf), type === "survey") };
  }
  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    const kind = hint === "support" ? "support" : "transcript";
    return { type: "pdf", items: splitTranscript((text as string[]).join("\n"), kind) };
  }
  // txt / md / vtt / anything else = transcript-style text
  const text = buf.toString("utf8").replace(/^WEBVTT.*$/m, "").replace(/^\d{2}:\d{2}:\d{2}\.\d{3} --> .*$/gm, "");
  if (hint === "paste" || hint === "text") return { type: "text", items: splitPasted(text).map((t) => ({ text: t })) };
  const kind = hint === "support" ? "support" : "transcript";
  return { type: kind, items: splitTranscript(text, kind) };
}

export async function storeItems(
  source: { name: string; type: SourceType; meta?: Record<string, unknown> },
  items: ParsedItem[],
): Promise<{ sourceId: number; ids: number[] }> {
  const [src] = await q<{ id: number }>(
    "INSERT INTO data_sources(name, type, status, item_count, meta) VALUES ($1, $2, 'processing', $3, $4::jsonb) RETURNING id",
    [source.name, source.type, items.length, JSON.stringify(source.meta ?? {})],
  );
  const ids: number[] = [];
  for (const it of items) {
    const [row] = await q<{ id: number }>(
      "INSERT INTO feedback(text, source_type, source_id, author, created_at) VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now())) RETURNING id",
      [it.text, source.type, src.id, it.author ?? null, it.createdAt ?? null],
    );
    ids.push(row.id);
  }
  try {
    await analyseItemsNow(ids);
    await q("UPDATE data_sources SET status = 'ready' WHERE id = $1", [src.id]);
  } catch (e: any) {
    await q("UPDATE data_sources SET status = 'error', meta = meta || $2::jsonb WHERE id = $1", [src.id, JSON.stringify({ error: String(e.message) })]);
  }
  return { sourceId: src.id, ids };
}

/** Reads the first worksheet of an .xlsx file into header-keyed rows (ExcelJS). */
export async function xlsxRows(buf: Buffer): Promise<Record<string, unknown>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const text = (v: any): string => {
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object") {
      if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join("");
      if ("text" in v) return String(v.text);
      if ("result" in v) return text(v.result);
    }
    return String(v);
  };
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = text(cell.value).trim() || `Column ${col}`));
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rec: Record<string, unknown> = {};
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = text(row.getCell(col).value);
      if (v) any = true;
      rec[h] = v;
    });
    if (any) rows.push(rec);
  }
  return rows;
}
