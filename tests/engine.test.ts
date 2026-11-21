import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseWithRules } from "../src/lib/engine/rules";
import { analyseBehaviour } from "../src/lib/engine/behaviour";
import { buildCombined, buildInsights, buildRecommendations, clusterWithRules } from "../src/lib/engine/synthesis";
import { verifyQuote } from "../src/lib/engine/llm-stages";
import { splitTranscript, splitPasted, parseRows } from "../src/lib/ingest-pure";
import { buildDemoEvents, DEMO_FEEDBACK } from "../src/lib/demo";

const items = DEMO_FEEDBACK.map((f, i) => ({
  id: i + 1,
  text: f.text,
  sourceId: null,
  sourceName: f.channel,
  author: f.author,
  analysis: analyseWithRules(f.text),
}));

test("mixed sentiment is preserved rather than forced into one class", () => {
  const a = analyseWithRules("I love how easy the dashboard is, but I find it difficult to locate my previous transactions.");
  assert.equal(a.sentiment, "mixed");
  assert.ok(a.signals.some((s) => s.polarity === "positive"));
  const neg = a.signals.find((s) => s.polarity === "negative")!;
  assert.equal(neg.category, "Navigation & discoverability");
  assert.equal(neg.kind, "usability");
});

test("demo feedback is classified as expected", () => {
  const s = items.map((i) => i.analysis.sentiment);
  assert.deepEqual(s, ["mixed", "negative", "negative", "positive", "negative", "neutral"]);
  assert.deepEqual(items[5].analysis.featureRequests, ["Reorder previous meals"]);
});

test("every quote is a verbatim substring of the source text", () => {
  for (const it of items) for (const sig of it.analysis.signals) assert.ok(it.text.includes(sig.quote), sig.quote);
});

test("verifyQuote rejects invented quotes", () => {
  assert.equal(verifyQuote("The payment page keeps freezing.", "The checkout crashes"), null);
  assert.equal(verifyQuote("The payment page keeps freezing.", "payment page keeps freezing"), "payment page keeps freezing");
});

test("behaviour analytics reproduces the scenario numbers exactly", () => {
  const r = analyseBehaviour(buildDemoEvents());
  const checkout = r.funnels.find((f) => f.key === "checkout")!;
  assert.equal(checkout.entered, 100);
  assert.equal(checkout.completed, 58);
  const drop = r.patterns.find((p) => p.type === "funnel_dropoff")!;
  assert.equal(drop.metric.numerator, 42);
  const search = r.patterns.find((p) => p.type === "search_after_visit")!;
  assert.equal(search.metric.numerator, 30);
  assert.equal(search.metric.denominator, 65);
  const repeat = r.patterns.find((p) => p.type === "repeated_action")!;
  assert.equal(repeat.usersAffected, 25);
  assert.equal(r.dataOrigin, "simulated");
});

test("insights, combined insights and recommendations are evidence-linked and ranked", () => {
  const r = analyseBehaviour(buildDemoEvents());
  const insights = buildInsights(clusterWithRules(items), items, r.patterns);
  for (const i of insights) {
    assert.equal(i.mentionCount, new Set(i.evidence.map((e) => e.feedbackId)).size);
    assert.ok(i.evidence.length > 0);
  }
  const combined = buildCombined(insights, r.patterns);
  assert.deepEqual(combined.map((c) => c.area).sort(), ["checkout_payment", "order_history"]);
  assert.ok(combined.every((c) => /not/i.test(c.causalityNote)));
  const recs = buildRecommendations(insights, r.patterns, items.length);
  assert.equal(recs[0].title, "Stabilise the payment page");
  assert.equal(recs[0].priority, "P0");
  for (let k = 1; k < recs.length; k++) assert.ok(recs[k - 1].score >= recs[k].score);
});

test("transcripts keep participant turns and drop interviewer turns", () => {
  const items = splitTranscript("Interviewer: How was checkout?\nAmara: Too many steps and the payment page froze.\nInterviewer: Thanks", "transcript");
  assert.equal(items.length, 1);
  assert.equal(items[0].author, "Amara");
});

test("pasted text splits per line and CSV detects the text column", () => {
  assert.equal(splitPasted("one review here\nanother review here").length, 2);
  const rows = parseRows([{ id: "1", review: "The payment page keeps freezing on me", author: "a" }], false);
  assert.equal(rows[0].text, "The payment page keeps freezing on me");
  assert.equal(rows[0].author, "a");
});
