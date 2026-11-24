import { db } from "@/lib/db";
import { json, writeKey } from "@/lib/api";
import { llmConfig } from "@/lib/engine/llm";
import { sitePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = llmConfig();
  const d = await db();
  return json({
    engine: cfg ? cfg.label : "rules",
    engineLabel: cfg ? `${cfg.provider === "openai" ? "OpenAI" : "Anthropic"} · ${cfg.model}` : "Built-in rule engine (no LLM key set)",
    database: d.kind === "postgres" ? "PostgreSQL (DATABASE_URL)" : "Embedded Postgres (PGlite, ./data/pg)",
    writeKey: await writeKey(),
    passwordProtected: !!sitePassword(),
  });
}
