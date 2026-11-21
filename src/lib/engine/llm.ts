// Thin LLM client (no SDK dependency). Supports OpenAI and Anthropic via env vars.
// Every response is parsed as JSON and validated by the caller; anything that does
// not validate falls back to the deterministic rule engine.

export interface LlmConfig {
  provider: "openai" | "anthropic";
  model: string;
  label: string;
}

export function llmConfig(): LlmConfig | null {
  if (process.env.SIGNALSORT_DISABLE_LLM === "1") return null;
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    return { provider: "openai", model, label: `openai:${model}` };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
    return { provider: "anthropic", model, label: `anthropic:${model}` };
  }
  return null;
}

export async function llmJSON<T = unknown>(cfg: LlmConfig, system: string, user: string, maxTokens = 4000): Promise<T> {
  const text = cfg.provider === "openai" ? await callOpenAI(cfg, system, user, maxTokens) : await callAnthropic(cfg, system, user, maxTokens);
  return parseJson<T>(text);
}

async function callOpenAI(cfg: LlmConfig, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(cfg: LlmConfig, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      system: system + "\nRespond with a single JSON object and nothing else.",
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

export function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("LLM did not return JSON");
  }
}
