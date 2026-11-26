// Deterministic rule-based analysis engine. Used when no LLM key is configured,
// and as a per-item fallback when an LLM response fails validation.
import type { FeedbackAnalysis, Sentiment, Signal, SignalKind, SignalPolarity } from "../types";
import { FALLBACK_RULE, RULES, type TopicRule } from "./taxonomy";

export const RULES_ENGINE = "rules";

const POSITIVE = [
  /\blove(d|s)?\b/, /\blike(d|s)?\b/, /\benjoy/, /\beasy\b/, /\beasily\b/, /\bsimple\b/, /\bgreat\b/, /\bgood\b/,
  /\bawesome\b/, /\bexcellent\b/, /\bamazing\b/, /\bfast\b/, /\bquick(ly)?\b/, /\bsmooth\b/, /\bintuitive\b/,
  /\bhelpful\b/, /\buseful\b/, /\bconvenient\b/, /\breliable\b/, /\bclear\b/, /\bnice\b/, /\bperfect\b/,
  /\bbest\b/, /\bfantastic\b/, /\bappreciate/, /\bseamless/, /\buser[- ]friendly\b/, /\bthank/, /\bhappy\b/,
  /\bdelicious\b/, /\bfresh\b/, /\bon time\b/,
];
const NEGATIVE = [
  /\bslow\b/, /too long/, /takes? (so |too )?long/, /\bfreez/, /\bcrash/, /\bbug/, /\bbroken\b/, /\bcan'?t\b/,
  /\bcannot\b/, /\bcouldn'?t\b/, /\bunable\b/, /\bdifficult/, /\bhard to\b/, /\bconfus/, /\bfrustrat/, /\bannoy/,
  /\babandon/, /\bhate/, /\bterrible\b/, /\bawful\b/, /\bpoor(ly)?\b/, /\bbad\b/, /\berrors?\b/, /\bfail/,
  /\bstuck\b/, /\bfroze\b/, /\bspins? forever/, /nothing happens/, /\bgave up\b/, /\blag/, /\bexpensive\b/, /\boverpriced\b/, /\bmissing\b/, /too many/, /\bnever\b/, /\bworst\b/,
  /\bdisappoint/, /\blate\b/, /\bcold\b/, /\bwrong\b/, /\bdoesn'?t work/, /\bnot working\b/, /\buseless\b/,
  /\bkeeps? (freezing|crashing|closing|failing|logging)/, /\bwaste/, /\bcomplicated\b/, /\bclunky\b/,
  /\bunresponsive\b/, /\bhidden\b/, /\bburied\b/, /\bridiculous\b/, /\bforever\b/, /\bspam/,
];
const REQUEST = [
  /\bi wish\b/, /\bwish (i|we|you|there)\b/, /would be (nice|great|good|helpful|awesome)/, /\bplease (add|make|let|allow|bring)/,
  /\bwould love (to|a|an|it if)\b/, /\bshould (have|add|let|allow|include|offer)\b/, /\bcan you (add|make|please)/,
  /\bfeature request\b/, /\bwant(ed)? to be able to\b/, /\bneed a way\b/, /\badd an? (option|way|button|feature)/,
  /\bit'?d be (nice|great|good)/, /\bhope (you|they) (add|will)/, /\bif only\b/, /\bit would help if\b/,
];
const EXPECTATION = [/\bexpected\b/, /\bsupposed to\b/, /\bshould be able to\b/, /\bthought it would\b/];
const USABILITY = [
  /can'?t find|cannot find|couldn'?t find|hard to find|unable to find/, /\blocate\b/, /too many steps/, /\bconfus/,
  /\bhard to (use|understand|navigate)/, /\bdifficult to\b/, /\bnavigat/, /\bhidden\b/, /\bburied\b/, /\bcomplicated\b/,
  /\bclunky\b/, /\bnot clear\b/, /\bunclear\b/,
];
const NEGATORS = /\b(not|never|no|isn'?t|wasn'?t|aren'?t|don'?t|doesn'?t|hardly)\s+(\w+\s+)?$/;

/** Split text into clause spans (start/end indices into the original string). */
export function clauseSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  // Sentence boundaries, then contrastive connectors.
  // "…froze and I couldn't…": "and" followed by a new subject starts a new clause.
  const splitter = /(?<=[.!?])\s+|[;\n]+|,?\s+\b(?=(?:but|however|although|though|except|whereas|yet)\b)|,?\s+and\s+(?=(?:i|i'm|i've|i'd|the|it|it's|my|they|there|this|that|we|you)\b)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = splitter.exec(text))) {
    if (m.index > last) spans.push({ start: last, end: m.index });
    last = m.index + m[0].length;
    if (m[0].length === 0) splitter.lastIndex++;
  }
  if (last < text.length) spans.push({ start: last, end: text.length });
  return spans
    .map((s) => trimSpan(text, s))
    .filter((s) => s.end - s.start >= 3 && /[a-z]/i.test(text.slice(s.start, s.end)));
}

function trimSpan(text: string, s: { start: number; end: number }) {
  let { start, end } = s;
  while (start < end && /[\s,.;:!?"'“”-]/.test(text[start])) start++;
  while (end > start && /[\s,;:"'“”-]/.test(text[end - 1])) end--;
  // Drop a leading contrastive connector from the quote ("but delivery…" → "delivery…") only if it is not the full span.
  const lead = /^(but|however|although|though|except|whereas|yet)\b[,\s]*/i.exec(text.slice(start, end));
  if (lead && lead[0].length < end - start) start += lead[0].length;
  return { start, end };
}

function countHits(clause: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const re = new RegExp(p.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(clause))) {
      const before = clause.slice(Math.max(0, m.index - 20), m.index);
      n += NEGATORS.test(before) ? -1 : 1;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return n;
}

export function matchRule(clause: string): TopicRule {
  for (const r of RULES) {
    if (r.match.test(clause) && (!r.requires || r.requires.test(clause))) return r;
  }
  return FALLBACK_RULE;
}

export function analyseClause(clause: string): Omit<Signal, "quote"> & { score: number } {
  const lower = clause.toLowerCase();
  const pos = countHits(lower, POSITIVE);
  const neg = countHits(lower, NEGATIVE);
  const isRequest = REQUEST.some((p) => p.test(lower));
  const isExpectation = EXPECTATION.some((p) => p.test(lower));
  const isQuestion = /\?\s*$/.test(clause.trim());
  // A negated positive ("not easy") counts as negative.
  const netPos = Math.max(0, pos);
  const netNeg = Math.max(0, neg) + Math.max(0, -pos);

  let polarity: SignalPolarity = "neutral";
  let kind: SignalKind = "question";
  if (isRequest) {
    // Suggestions are neutral unless they also carry a clear complaint.
    polarity = netNeg >= 2 ? "negative" : "neutral";
    kind = "feature_request";
  } else if (netNeg > netPos) {
    polarity = "negative";
    kind = USABILITY.some((p) => p.test(lower)) ? "usability" : isExpectation ? "expectation" : "problem";
  } else if (netPos > netNeg) {
    polarity = "positive";
    kind = "praise";
  } else if (isExpectation) {
    polarity = "neutral";
    kind = "expectation";
  } else {
    polarity = "neutral";
    kind = isQuestion ? "question" : "question";
  }
  const rule = matchRule(clause);
  const label =
    kind === "feature_request" || kind === "expectation"
      ? rule.request.label
      : polarity === "positive"
        ? rule.praise.label
        : polarity === "negative"
          ? rule.problem.label
          : `Observation about ${rule.feature.toLowerCase()}`;
  return {
    polarity,
    kind,
    label,
    feature: rule.feature,
    area: rule.area,
    category: rule.category,
    score: netPos - netNeg,
    ruleId: rule.id,
  } as any;
}

export function sentimentFromSignals(signals: Pick<Signal, "polarity">[]): Sentiment {
  const p = signals.some((s) => s.polarity === "positive");
  const n = signals.some((s) => s.polarity === "negative");
  if (p && n) return "mixed";
  if (p) return "positive";
  if (n) return "negative";
  return "neutral";
}

export interface RuleSignal extends Signal {
  ruleId: string;
}

export function analyseWithRules(text: string): FeedbackAnalysis & { signals: RuleSignal[] } {
  const spans = clauseSpans(text);
  const signals: RuleSignal[] = [];
  for (const s of spans) {
    const quote = text.slice(s.start, s.end);
    const a = analyseClause(quote) as any;
    // Skip contentless neutral fragments (e.g. "Hi", "Thanks.") that match no topic.
    if (a.polarity === "neutral" && a.kind === "question" && a.ruleId === "general" && !/\?/.test(quote)) continue;
    const sig: RuleSignal = {
      polarity: a.polarity,
      kind: a.kind,
      label: a.label,
      quote,
      feature: a.feature,
      area: a.area,
      category: a.category,
      ruleId: a.ruleId,
    };
    // Merge consecutive clauses on the same topic + polarity into one signal.
    const prev = signals[signals.length - 1];
    if (prev && prev.ruleId === sig.ruleId && prev.polarity === sig.polarity && prev.kind === sig.kind) {
      const startPrev = text.indexOf(prev.quote);
      if (startPrev >= 0 && s.end > startPrev) {
        prev.quote = text.slice(startPrev, s.end);
        continue;
      }
    }
    signals.push(sig);
  }
  // Context-only clauses ("That's where it gets annoying.") inherit the topic of a
  // neighbouring clause with the same polarity, then merge into it.
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i];
    if (s.ruleId !== "general" || s.polarity === "neutral") continue;
    const nb = [signals[i + 1], signals[i - 1]].find((x) => x && x.ruleId !== "general" && x.polarity === s.polarity);
    if (!nb) continue;
    const a = text.indexOf(s.quote);
    const b = text.indexOf(nb.quote);
    if (a < 0 || b < 0) continue;
    nb.quote = text.slice(Math.min(a, b), Math.max(a + s.quote.length, b + nb.quote.length));
    signals.splice(i, 1);
    i--;
  }
  if (signals.length === 0) {
    const rule = matchRule(text);
    signals.push({
      polarity: "neutral",
      kind: "question",
      label: `Observation about ${rule.feature.toLowerCase()}`,
      quote: text.trim().slice(0, 300),
      feature: rule.feature,
      area: rule.area,
      category: rule.category,
      ruleId: rule.id,
    });
  }

  const sentiment = sentimentFromSignals(signals);
  const negatives = signals.filter((s) => s.polarity === "negative");
  const requests = signals.filter((s) => s.kind === "feature_request");
  const positives = signals.filter((s) => s.polarity === "positive");
  const main = negatives[0] ?? requests[0] ?? positives[0] ?? signals[0];
  const primaryCategory = main.category;

  const parts: string[] = [];
  if (positives.length) parts.push(`appreciates ${list(positives.map((s) => s.label.toLowerCase()))}`);
  if (negatives.length) parts.push(`reports ${list(negatives.map((s) => s.label.toLowerCase()))}`);
  if (requests.length) parts.push(`requests ${list(requests.map((s) => s.label.toLowerCase()))}`);
  const neutral = signals.filter((s) => s.polarity === "neutral" && s.kind !== "feature_request");
  if (!parts.length && neutral.length) parts.push(`comments on ${list(neutral.map((s) => s.feature.toLowerCase()))}`);
  const summary = cap(`User ${parts.join("; ")}.`);

  const solutions: string[] = [];
  for (const s of [...negatives, ...requests]) {
    const rule = RULES.find((r) => r.id === s.ruleId);
    const pb = s.kind === "feature_request" ? (rule?.requestPlaybook ?? rule?.playbook) : rule?.playbook;
    if (pb) solutions.push(pb.improvements[0].text);
    else if (rule) solutions.push(`Investigate and improve ${rule.feature.toLowerCase()}`);
  }

  return {
    engine: RULES_ENGINE,
    summary,
    sentiment,
    primaryCategory,
    mainIssue: main.label,
    signals,
    featureRequests: requests.map((s) => s.label),
    usabilityProblems: signals.filter((s) => s.kind === "usability").map((s) => s.label),
    unmetNeeds: signals.filter((s) => s.kind === "expectation" || s.kind === "feature_request").map((s) => s.label),
    suggestedSolutions: [...new Set(solutions)],
  };
}

function list(xs: string[]) {
  const u = [...new Set(xs)];
  if (u.length <= 1) return u.join("");
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
