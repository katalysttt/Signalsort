import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSetting, setSetting } from "./db";

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function writeKey(): Promise<string> {
  let k = await getSetting<string | null>("writeKey", null);
  if (!k) {
    k = `ss_live_${crypto.randomBytes(12).toString("hex")}`;
    await setSetting("writeKey", k);
  }
  return k;
}

export function mapFeedback(r: any) {
  return {
    id: r.id,
    text: r.text,
    sourceType: r.source_type,
    sourceId: r.source_id,
    sourceName: r.source_name ?? null,
    author: r.author,
    createdAt: new Date(r.created_at).toISOString(),
    analysis: r.analysis,
    sentiment: r.sentiment,
    category: r.category,
    priority: r.priority,
  };
}
