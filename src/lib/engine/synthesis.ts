// Turns per-item analyses + behaviour patterns into insights, combined insights and
// ranked recommendations. All statistics are computed from linked evidence here;
// models only ever supply wording, grouping and 1–5 severity judgements.
import {
  AREA_LABELS,
  type Area,
  type BehaviourPattern,
  type Category,
  type CombinedInsight,
  type Evidence,
  type FeedbackAnalysis,
  type Insight,
  type Priority,
  type Recommendation,
  type Signal,
} from "../types";
import { genericPlaybook, ruleById, type Playbook } from "./taxonomy";
import { matchRule as _m } from "./rules";

export interface AnalysedItem {
  id: number;
  text: string;
  sourceId: number | null;
  sourceName: string | null;
  author: string | null;
  analysis: FeedbackAnalysis;
}

export interface ThemeDraft {
  key: string;
  title: string;
  description: string;
  kind: Insight["kind"];
  feature: string;
  area: Area;
  category: Category;
  severity: number;
  businessImpact: number;
  impact: string;
  recommendation: string;
  engine: string;
  members: { feedbackId: number; signal: Signal }[];
}

export const groupOf = (s: Signal): Insight["kind"] =>
  s.kind === "feature_request" || (s.kind === "expectation" && s.polarity !== "negative")
    ? "feature_request"
    : s.polarity === "positive"
      ? "praise"
      : s.polarity === "negative"
        ? "problem"
        : "feature_request";

/** Rule-based clustering: one theme per (taxonomy topic, kind). */
export function clusterWithRules(items: AnalysedItem[]): ThemeDraft[] {
  const map = new Map<string, ThemeDraft>();
  for (const it of items) {
    for (const s of it.analysis.signals) {
      if (s.polarity === "neutral" && s.kind === "question") continue;
      const rule = ruleById(s.ruleId ?? _m(s.quote).id);
      const kind = groupOf(s);
      const key = `${rule.id}:${kind}`;
      if (!map.has(key)) {
        const v = kind === "praise" ? rule.praise : kind === "feature_request" ? rule.request : rule.problem;
        map.set(key, {
          key,
          title: v.title,
          description: "description" in v ? (v as any).description : `Users highlight ${rule.feature.toLowerCase()} as a strength.`,
          kind,
          feature: rule.feature,
          area: rule.area,
          category: kind === "feature_request" && rule.category === "Other" ? "Other" : rule.category,
          severity: kind === "problem" ? rule.severity : kind === "feature_request" ? 2 : 1,
          businessImpact: rule.business,
          impact:
            kind === "problem"
              ? rule.problem.impact
              : kind === "feature_request"
                ? `Unmet need around ${rule.feature.toLowerCase()}; addressing it could increase engagement.`
                : `A strength to protect when changing ${rule.feature.toLowerCase()}.`,
          recommendation: "",
          engine: "rules",
          members: [],
        });
      }
      map.get(key)!.members.push({ feedbackId: it.id, signal: s });
    }
  }
  return [...map.values()];
}

const sq = (x: number) => Math.round(Math.sqrt(Math.max(0, Math.min(1, x))) * 100);

export function priorityFor(score: number): Priority {
  return score >= 70 ? "P0" : score >= 55 ? "P1" : score >= 40 ? "P2" : "P3";
}

export function scoreOf(feedbackShare: number, severity: number, userShare: number, business: number) {
  const scores = {
    frequency: sq(feedbackShare),
    severity: severity * 20,
    userImpact: sq(userShare),
    businessImpact: business * 20,
  };
  const score = Math.round(0.3 * scores.frequency + 0.3 * scores.severity + 0.2 * scores.userImpact + 0.2 * scores.businessImpact);
  return { scores, score, priority: priorityFor(score) };
}

/** Behaviour patterns that speak to the same experience as a feedback theme. */
export function relatedPatterns(ins: { area: Area; feature: string; kind: Insight["kind"] }, patterns: BehaviourPattern[]) {
  if (ins.kind === "praise") return [];
  return patterns.filter(
    (p) => p.area === ins.area && (p.type !== "low_adoption" || p.title.toLowerCase().includes(ins.feature.toLowerCase())),
  );
}

function patternShare(p: BehaviourPattern) {
  return p.metric.denominator ? p.metric.numerator / p.metric.denominator : 0;
}

export function buildInsights(themes: ThemeDraft[], items: AnalysedItem[], patterns: BehaviourPattern[]): Insight[] {
  const total = items.length || 1;
  const byId = new Map(items.map((i) => [i.id, i]));
  const insights: Insight[] = themes.map((t) => {
    const ids = [...new Set(t.members.map((m) => m.feedbackId))];
    const sources = new Set(ids.map((id) => byId.get(id)?.sourceId ?? `item-${id}`));
    const sentiment = { positive: 0, negative: 0, neutral: 0 };
    for (const m of t.members) sentiment[m.signal.polarity]++;
    const evidence: Evidence[] = t.members.map((m) => ({
      feedbackId: m.feedbackId,
      quote: m.signal.quote,
      polarity: m.signal.polarity,
      sourceName: byId.get(m.feedbackId)?.sourceName ?? null,
    }));
    const related = relatedPatterns(t, patterns);
    const userShare = Math.max(ids.length / total, ...related.map(patternShare), 0);
    const s = scoreOf(ids.length / total, t.severity, userShare, t.businessImpact);
    return {
      key: t.key,
      title: t.title,
      description: t.description,
      kind: t.kind,
      feature: t.feature,
      area: t.area,
      category: t.category,
      mentionCount: ids.length,
      sourceCount: sources.size,
      frequency: Math.round((ids.length / total) * 1000) / 10,
      sentiment,
      evidence,
      impact: t.impact,
      severity: t.kind === "praise" ? 1 : t.severity,
      businessImpact: t.businessImpact,
      recommendation: t.recommendation,
      priority: t.kind === "praise" ? "P3" : s.priority,
      score: t.kind === "praise" ? 0 : s.score,
      engine: t.engine,
    };
  });
  insights.sort((a, b) => (a.kind === "praise" ? 1 : 0) - (b.kind === "praise" ? 1 : 0) || b.score - a.score || b.mentionCount - a.mentionCount);
  return insights;
}

export function buildCombined(insights: Insight[], patterns: BehaviourPattern[]): CombinedInsight[] {
  const out: CombinedInsight[] = [];
  const areas = new Set(patterns.map((p) => p.area));
  for (const area of areas) {
    const ins = insights.filter((i) => i.area === area && i.kind !== "praise");
    const pats = patterns.filter((p) => ins.some((i) => relatedPatterns(i, [p]).length > 0));
    if (!ins.length || !pats.length) continue;
    const negativeIns = ins.filter((i) => i.kind === "problem");
    const strong = negativeIns.length > 0 && pats.some((p) => p.severity >= 4);
    const label = AREA_LABELS[area];
    const said = ins.map((i) => `${i.mentionCount} feedback item${i.mentionCount === 1 ? "" : "s"} on "${i.title.toLowerCase()}"`).join("; ");
    const did = pats.map((p) => p.finding.split(". ")[0].replace(/\.$/, "")).join("; ");
    out.push({
      key: `combined:${area}`,
      area,
      title:
        negativeIns.length > 0
          ? `${label} is creating user friction — feedback and behaviour agree`
          : `Users signal an unmet need in ${label.toLowerCase()} — backed by behaviour`,
      conclusion: `What users say: ${said}. What users do: ${did}.`,
      insightKeys: ins.map((i) => i.key),
      patternKeys: pats.map((p) => p.key),
      strength: strong ? "strong" : "moderate",
      causalityNote:
        "Correlated, not proven: both signals concern the same product area, but this data does not show that the reported issues cause the behaviour. Confirm with a controlled experiment or by linking feedback to the same users' sessions.",
    });
  }
  return out.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === "strong" ? -1 : 1));
}

export function buildRecommendations(
  insights: Insight[],
  patterns: BehaviourPattern[],
  totalFeedback: number,
  llmPlaybooks: Map<string, Playbook & { rationale?: string }> = new Map(),
  engine = "rules",
): Recommendation[] {
  const recs: Recommendation[] = [];
  const coveredPatterns = new Set<string>();
  const total = totalFeedback || 1;
  for (const ins of insights) {
    if (ins.kind === "praise") continue;
    const related = relatedPatterns(ins, patterns);
    related.forEach((p) => coveredPatterns.add(p.key));
    const ruleId = ins.key.split(":")[0];
    const rule = ruleById(ruleId);
    const llm = llmPlaybooks.get(ins.key);
    const pb: Playbook =
      llm ??
      (ins.kind === "feature_request" ? (rule.requestPlaybook ?? genericPlaybook(rule, "feature_request")) : (rule.playbook ?? genericPlaybook(rule, "problem")));
    const userShare = Math.max(ins.mentionCount / total, ...related.map(patternShare), 0);
    const s = scoreOf(ins.mentionCount / total, ins.severity, userShare, ins.businessImpact);
    const behaviourText = related.length
      ? ` Behaviour data: ${related.map((p) => p.finding).join(" ")}`
      : " No behavioural data is linked to this area yet.";
    const quotes = ins.evidence.slice(0, 2).map((e) => `"${e.quote.replace(/[.!]+$/, "")}"`).join(", ");
    recs.push({
      key: `rec:${ins.key}`,
      insightKey: ins.key,
      patternKeys: related.map((p) => p.key),
      title: pb.action ?? (ins.kind === "feature_request" ? `Build: ${ins.title.replace(/^Users want /i, "")}` : `Fix: ${ins.title}`),
      area: ins.area,
      whatIsWrong: `${ins.description} Mentioned in ${ins.mentionCount} of ${totalFeedback} feedback items (${ins.frequency}%), e.g. ${quotes}.`,
      whyItHappens: pb.whyItHappens,
      whoIsAffected: `${ins.mentionCount} user${ins.mentionCount === 1 ? "" : "s"} across ${ins.sourceCount} source${ins.sourceCount === 1 ? "" : "s"} ${ins.mentionCount === 1 ? "mentions" : "mention"} it.${behaviourText}`,
      whatToChange: pb.whatToChange,
      expectedImprovement: pb.expectedImprovement,
      howToMeasure: pb.howToMeasure,
      improvements: pb.improvements,
      experiments: pb.experiments,
      metrics: pb.metrics,
      rationale:
        (llm?.rationale ? llm.rationale + " " : "") +
        `Ranked ${s.priority} (score ${s.score}/100): frequency ${s.scores.frequency}, severity ${s.scores.severity}, user impact ${s.scores.userImpact}, business impact ${s.scores.businessImpact}. ` +
        (related.length ? `Feedback and behaviour point at the same area (${AREA_LABELS[ins.area]}), which raises confidence — this is correlation, not proof of cause.` : `Based on feedback only.`),
      scores: s.scores,
      score: s.score,
      priority: s.priority,
      evidenceFeedbackIds: [...new Set(ins.evidence.map((e) => e.feedbackId))],
      engine: llm ? engine : "rules",
    });
  }
  // Behaviour-only findings become "investigate" recommendations.
  for (const p of patterns) {
    if (coveredPatterns.has(p.key)) continue;
    const s = scoreOf(0, p.severity, patternShare(p), 3);
    recs.push({
      key: `rec:pattern:${p.key}`,
      insightKey: null,
      patternKeys: [p.key],
      title: `Investigate: ${p.title}`,
      area: p.area,
      whatIsWrong: p.finding,
      whyItHappens: `Unknown — there is no user feedback about ${AREA_LABELS[p.area].toLowerCase()} yet. ${p.interpretation}`,
      whoIsAffected: `${p.usersAffected} users in the behaviour data.`,
      whatToChange:
        p.type === "low_adoption"
          ? "Improve discoverability (entry point, onboarding tooltip, release announcement) before deciding whether to invest further."
          : "Collect targeted feedback (in-app micro-survey at this step) and review session recordings to understand the cause.",
      expectedImprovement: "A validated root cause, so the team invests in the right fix.",
      howToMeasure: `Track "${p.metric.label}" (currently ${p.metric.value}%) week over week.`,
      improvements: [{ type: "product", text: "Add an in-app micro-survey at the affected step" }],
      experiments: p.type === "low_adoption" ? ["A/B test a contextual prompt that introduces the feature"] : ["Intercept survey triggered on the observed behaviour"],
      metrics: [p.metric.label],
      rationale: `Generated from behaviour data only (no matching feedback). Ranked ${s.priority} (score ${s.score}/100).`,
      scores: s.scores,
      score: s.score,
      priority: s.priority,
      evidenceFeedbackIds: [],
      engine: "rules",
    });
  }
  return recs.sort((a, b) => b.score - a.score);
}
