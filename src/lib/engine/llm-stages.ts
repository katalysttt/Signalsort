// LLM-powered pipeline stages. Each stage validates the model output against the
// submitted data (quotes must be verbatim, ids must exist, enums must match) and
// returns null / drops items that fail, so the caller can fall back to rules.
import { AREAS, CATEGORIES, type Area, type Category, type FeedbackAnalysis, type Signal, type SignalKind } from "../types";
import { llmJSON, type LlmConfig } from "./llm";
import { sentimentFromSignals } from "./rules";
import type { Playbook } from "./taxonomy";

const KINDS: SignalKind[] = ["praise", "problem", "usability", "feature_request", "expectation", "question"];

const ANALYSE_SYSTEM = `You are SignalSort, a product-research analyst. You analyse raw user feedback for product managers.
Rules:
- Split each feedback item into one or more signals. Keep mixed sentiment: a single item can contain a positive and a negative signal.
- "quote" MUST be copied verbatim from the feedback text (an exact substring). Never paraphrase quotes.
- Distinguish feature requests (something new users want) from problems (something broken or frustrating).
- Suggestions and wishes without a complaint are polarity "neutral" with kind "feature_request".
- Never invent facts, numbers or users. Only describe what the text says.
- category must be one of: ${CATEGORIES.join(" | ")}
- area must be one of: ${AREAS.join(" | ")}
- kind must be one of: ${KINDS.join(" | ")}
- polarity must be one of: positive | negative | neutral`;

interface RawAnalysis {
  id: number;
  summary: string;
  mainIssue: string;
  signals: { polarity: string; kind: string; label: string; quote: string; feature: string; area: string; category: string }[];
  featureRequests?: string[];
  usabilityProblems?: string[];
  unmetNeeds?: string[];
  suggestedSolutions?: string[];
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Returns the verbatim substring of `text` matching `quote`, or null. */
export function verifyQuote(text: string, quote: string): string | null {
  if (!quote) return null;
  const q = quote.trim().replace(/^["“']|["”']$/g, "");
  const i = text.indexOf(q);
  if (i >= 0) return text.slice(i, i + q.length);
  const nt = norm(text);
  const nq = norm(q);
  const j = nt.indexOf(nq);
  if (j >= 0 && nq.length > 3) {
    // Map back to the original by locating first & last words.
    const words = q.split(/\s+/);
    const first = text.toLowerCase().indexOf(words[0].toLowerCase());
    const lastWord = words[words.length - 1].toLowerCase();
    const last = text.toLowerCase().indexOf(lastWord, first);
    if (first >= 0 && last >= first) return text.slice(first, last + lastWord.length);
  }
  return null;
}

export async function analyseBatchLLM(cfg: LlmConfig, items: { id: number; text: string }[]): Promise<Map<number, FeedbackAnalysis>> {
  const user = `Analyse each feedback item. Return JSON: {"items":[{"id":number,"summary":string (<= 25 words),"mainIssue":string,"signals":[{"polarity","kind","label" (short normalised description, e.g. "Poor transaction discoverability"),"quote","feature" (specific product feature or experience),"area","category"}],"featureRequests":string[],"usabilityProblems":string[],"unmetNeeds":string[],"suggestedSolutions":string[]}]}

Feedback items:
${items.map((it) => `<item id="${it.id}">\n${it.text.slice(0, 4000)}\n</item>`).join("\n")}`;
  const raw = await llmJSON<{ items: RawAnalysis[] }>(cfg, ANALYSE_SYSTEM, user, 6000);
  const out = new Map<number, FeedbackAnalysis>();
  const byId = new Map(items.map((i) => [i.id, i.text]));
  for (const r of raw.items ?? []) {
    const text = byId.get(Number(r.id));
    if (!text) continue;
    const signals: Signal[] = [];
    for (const s of r.signals ?? []) {
      const quote = verifyQuote(text, s.quote);
      if (!quote) continue; // reject non-verbatim evidence
      const polarity = (["positive", "negative", "neutral"].includes(s.polarity) ? s.polarity : "neutral") as Signal["polarity"];
      signals.push({
        polarity,
        kind: (KINDS.includes(s.kind as SignalKind) ? s.kind : polarity === "positive" ? "praise" : polarity === "negative" ? "problem" : "question") as SignalKind,
        label: String(s.label || "").slice(0, 120) || "Unlabelled signal",
        quote,
        feature: String(s.feature || "General experience").slice(0, 80),
        area: (AREAS.includes(s.area as Area) ? s.area : "general") as Area,
        category: (CATEGORIES.includes(s.category as Category) ? s.category : "Other") as Category,
      });
    }
    if (!signals.length) continue;
    const neg = signals.find((s) => s.polarity === "negative");
    out.set(Number(r.id), {
      engine: cfg.label,
      summary: String(r.summary || "").slice(0, 400),
      sentiment: sentimentFromSignals(signals),
      primaryCategory: (neg ?? signals[0]).category,
      mainIssue: String(r.mainIssue || (neg ?? signals[0]).label).slice(0, 200),
      signals,
      featureRequests: (r.featureRequests ?? []).map(String).slice(0, 10),
      usabilityProblems: (r.usabilityProblems ?? []).map(String).slice(0, 10),
      unmetNeeds: (r.unmetNeeds ?? []).map(String).slice(0, 10),
      suggestedSolutions: (r.suggestedSolutions ?? []).map(String).slice(0, 10),
    });
  }
  return out;
}

export interface LlmTheme {
  title: string;
  description: string;
  kind: "problem" | "feature_request" | "praise";
  feature: string;
  area: Area;
  category: Category;
  severity: number;
  businessImpact: number;
  impact: string;
  recommendation: string;
  signalIds: string[];
}

export async function clusterThemesLLM(
  cfg: LlmConfig,
  signals: { sid: string; polarity: string; kind: string; label: string; feature: string; area: string; quote: string }[],
): Promise<LlmTheme[]> {
  const system = `You are SignalSort's theme-extraction stage. Group user-feedback signals into distinct, non-overlapping themes.
Rules:
- Merge signals that describe the same underlying issue, request or praise, even if worded differently or from different interviews.
- Never create duplicate themes for the same issue. Keep problems, feature requests and praise in separate themes.
- Every signal id may appear in at most one theme. Only use ids that exist.
- Do NOT output counts, percentages or statistics; they are computed from the data afterwards.
- severity (1-5): how badly the issue blocks users. businessImpact (1-5): likely effect on revenue/retention.
- area must be one of: ${AREAS.join(" | ")}; category one of: ${CATEGORIES.join(" | ")}.`;
  const user = `Return JSON {"themes":[{"title","description","kind":"problem"|"feature_request"|"praise","feature","area","category","severity","businessImpact","impact" (one sentence),"recommendation" (one sentence),"signalIds":[...]}]}

Signals:
${signals.map((s) => `${s.sid} | ${s.polarity}/${s.kind} | ${s.feature} | ${s.label} | "${s.quote.slice(0, 220)}"`).join("\n")}`;
  const raw = await llmJSON<{ themes: any[] }>(cfg, system, user, 8000);
  const valid = new Set(signals.map((s) => s.sid));
  const used = new Set<string>();
  const out: LlmTheme[] = [];
  for (const t of raw.themes ?? []) {
    const ids = (t.signalIds ?? []).map(String).filter((id: string) => valid.has(id) && !used.has(id));
    if (!ids.length) continue;
    ids.forEach((id: string) => used.add(id));
    out.push({
      title: String(t.title || "Untitled theme").slice(0, 140),
      description: String(t.description || "").slice(0, 500),
      kind: ["problem", "feature_request", "praise"].includes(t.kind) ? t.kind : "problem",
      feature: String(t.feature || "General experience").slice(0, 80),
      area: AREAS.includes(t.area) ? t.area : "general",
      category: CATEGORIES.includes(t.category) ? t.category : "Other",
      severity: clamp(Number(t.severity) || 3),
      businessImpact: clamp(Number(t.businessImpact) || 3),
      impact: String(t.impact || "").slice(0, 300),
      recommendation: String(t.recommendation || "").slice(0, 400),
      signalIds: ids,
    });
  }
  return out;
}

export async function recommendationsLLM(
  cfg: LlmConfig,
  items: { key: string; title: string; kind: string; feature: string; quotes: string[]; behaviour: string[] }[],
): Promise<Map<string, Playbook & { rationale?: string }>> {
  const system = `You are SignalSort's recommendation stage, advising a product team.
For each problem or request, produce an evidence-based recommendation.
Rules:
- Base everything ONLY on the quotes and behavioural findings provided. Do not invent statistics or users.
- "whyItHappens" must be phrased as a hypothesis to validate (start with "Hypothesis:").
- Behavioural findings show correlation, not causation; say so where relevant.
- improvements[].type is one of product | feature | ux | workflow.`;
  const user = `Return JSON {"recommendations":[{"key","action" (short imperative title, <= 8 words),"whyItHappens","whatToChange","expectedImprovement","howToMeasure","improvements":[{"type","text"}],"experiments":[string],"metrics":[string],"rationale"}]}

${items
  .map(
    (i) => `## key=${i.key}
Title: ${i.title} (${i.kind}; feature: ${i.feature})
Quotes:
${i.quotes.map((q) => `- "${q}"`).join("\n")}
Behavioural findings:
${i.behaviour.length ? i.behaviour.map((b) => `- ${b}`).join("\n") : "- none"}`,
  )
  .join("\n\n")}`;
  const raw = await llmJSON<{ recommendations: any[] }>(cfg, system, user, 8000);
  const out = new Map<string, Playbook & { rationale?: string }>();
  const keys = new Set(items.map((i) => i.key));
  for (const r of raw.recommendations ?? []) {
    if (!keys.has(r.key) || !r.whatToChange || !r.howToMeasure) continue;
    out.set(r.key, {
      action: r.action ? String(r.action).slice(0, 80) : undefined,
      whyItHappens: String(r.whyItHappens || ""),
      whatToChange: String(r.whatToChange),
      expectedImprovement: String(r.expectedImprovement || ""),
      howToMeasure: String(r.howToMeasure),
      improvements: (r.improvements ?? [])
        .filter((x: any) => x && x.text)
        .slice(0, 6)
        .map((x: any) => ({ type: ["product", "feature", "ux", "workflow"].includes(x.type) ? x.type : "product", text: String(x.text) })),
      experiments: (r.experiments ?? []).map(String).slice(0, 5),
      metrics: (r.metrics ?? []).map(String).slice(0, 6),
      rationale: r.rationale ? String(r.rationale) : undefined,
    });
  }
  return out;
}

function clamp(n: number) {
  return Math.max(1, Math.min(5, Math.round(n)));
}
