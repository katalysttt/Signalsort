// Analysis pipeline orchestration:
// raw data → cleaning → sentiment → theme extraction → issue identification →
// pattern detection (behaviour) → prioritisation → recommendations.
import { q } from "./db";
import { cleanText } from "./ingest-pure";
export { cleanText };
import { analyseBehaviour, type BehaviourReport } from "./engine/behaviour";
import { llmConfig } from "./engine/llm";
import { analyseBatchLLM, clusterThemesLLM, recommendationsLLM } from "./engine/llm-stages";
import { analyseWithRules, RULES_ENGINE } from "./engine/rules";
import {
  buildCombined,
  buildInsights,
  buildRecommendations,
  clusterWithRules,
  groupOf,
  relatedPatterns,
  type AnalysedItem,
  type ThemeDraft,
} from "./engine/synthesis";
import type { AnalysisResult, FeedbackAnalysis, Sentiment, TrackedEvent } from "./types";

export async function loadEvents(includeSimulated = true): Promise<TrackedEvent[]> {
  const rows = await q<any>(
    `SELECT event, user_id, session_id, properties, ts, source FROM events ${includeSimulated ? "" : "WHERE source <> 'simulated'"} ORDER BY ts ASC LIMIT 200000`,
  );
  return rows.map((r) => ({
    event: r.event,
    userId: r.user_id,
    sessionId: r.session_id,
    properties: r.properties ?? {},
    ts: new Date(r.ts).toISOString(),
    source: r.source,
  }));
}

export async function behaviourReport(includeSimulated = true): Promise<BehaviourReport> {
  return analyseBehaviour(await loadEvents(includeSimulated));
}

export async function runAnalysis(opts: { force?: boolean } = {}): Promise<AnalysisResult> {
  const cfg = llmConfig();
  const engine = cfg?.label ?? RULES_ENGINE;
  const notes: string[] = [];
  const [run] = await q<{ id: number }>("INSERT INTO analysis_runs(engine) VALUES ($1) RETURNING id", [engine]);
  try {
    // 1-3. Clean + per-item analysis (sentiment, signals, categories) for new items.
    const rows = await q<any>(
      `SELECT f.id, f.text, f.source_id, f.author, f.analysis, s.name AS source_name
       FROM feedback f LEFT JOIN data_sources s ON s.id = f.source_id ORDER BY f.id`,
    );
    const todo = rows.filter((r) => opts.force || !r.analysis || (r.analysis.engine !== engine && r.analysis.engine !== "manual"));
    const analysed = new Map<number, FeedbackAnalysis>();
    if (cfg && todo.length) {
      for (let i = 0; i < todo.length; i += 12) {
        const batch = todo.slice(i, i + 12).map((r) => ({ id: r.id, text: cleanText(r.text) }));
        try {
          const res = await analyseBatchLLM(cfg, batch);
          res.forEach((v, k) => analysed.set(k, v));
        } catch (e: any) {
          notes.push(`LLM analysis failed for a batch (${e.message.slice(0, 120)}); rule engine used for those items.`);
        }
      }
    }
    let fallbacks = 0;
    for (const r of todo) {
      let a = analysed.get(r.id);
      if (!a) {
        a = analyseWithRules(cleanText(r.text));
        if (cfg) fallbacks++;
      }
      const sentiment: Sentiment = a.sentiment;
      await q("UPDATE feedback SET analysis = $1::jsonb, sentiment = $2, category = $3, analyzed_at = now() WHERE id = $4", [
        JSON.stringify(a),
        sentiment,
        a.primaryCategory,
        r.id,
      ]);
      r.analysis = a;
    }
    if (fallbacks) notes.push(`${fallbacks} item(s) fell back to the rule engine because the model output could not be verified against the source text.`);

    const items: AnalysedItem[] = rows
      .filter((r) => r.analysis)
      .map((r) => ({ id: r.id, text: r.text, sourceId: r.source_id, sourceName: r.source_name, author: r.author, analysis: r.analysis }));

    // 5. Behaviour pattern detection.
    const report = await behaviourReport(true);
    if (report.dataOrigin === "simulated" || report.dataOrigin === "mixed")
      notes.push("Behavioural findings include simulated demo events; they are labelled wherever shown.");

    // 4. Theme extraction / issue identification.
    let themes: ThemeDraft[] = [];
    if (cfg && items.length) {
      try {
        const sigs: { sid: string; feedbackId: number; idx: number }[] = [];
        const payload = items.flatMap((it) =>
          it.analysis.signals.map((s, idx) => {
            const sid = `${it.id}.${idx}`;
            sigs.push({ sid, feedbackId: it.id, idx });
            return { sid, polarity: s.polarity, kind: s.kind, label: s.label, feature: s.feature, area: s.area, quote: s.quote };
          }),
        );
        const llmThemes = await clusterThemesLLM(cfg, payload);
        const sigMap = new Map(sigs.map((s) => [s.sid, s]));
        const used = new Set<string>();
        themes = llmThemes.map((t) => {
          t.signalIds.forEach((id) => used.add(id));
          return {
            key: `${t.area}:${t.kind}:${t.feature.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            title: t.title,
            description: t.description,
            kind: t.kind,
            feature: t.feature,
            area: t.area,
            category: t.category,
            severity: t.severity,
            businessImpact: t.businessImpact,
            impact: t.impact,
            recommendation: t.recommendation,
            engine,
            members: t.signalIds.map((id) => {
              const s = sigMap.get(id)!;
              const it = items.find((x) => x.id === s.feedbackId)!;
              return { feedbackId: s.feedbackId, signal: it.analysis.signals[s.idx] };
            }),
          };
        });
        // Signals the model left out are clustered by rules so no evidence is lost.
        const leftovers = items
          .map((it) => ({ ...it, analysis: { ...it.analysis, signals: it.analysis.signals.filter((_, idx) => !used.has(`${it.id}.${idx}`)) } }))
          .filter((it) => it.analysis.signals.length);
        const extra = clusterWithRules(leftovers);
        for (const t of extra) {
          const existing = themes.find((x) => x.key === t.key);
          if (existing) existing.members.push(...t.members);
          else themes.push(t);
        }
        // Merge accidental duplicate keys from the model.
        const merged = new Map<string, ThemeDraft>();
        for (const t of themes) {
          const m = merged.get(t.key);
          if (m) m.members.push(...t.members);
          else merged.set(t.key, t);
        }
        themes = [...merged.values()];
      } catch (e: any) {
        notes.push(`LLM theme extraction failed (${e.message.slice(0, 120)}); rule-based clustering used.`);
        themes = clusterWithRules(items);
      }
    } else {
      themes = clusterWithRules(items);
    }
    void groupOf;

    // 6. Prioritisation.
    const insights = buildInsights(themes, items, report.patterns);
    const combined = buildCombined(insights, report.patterns);

    // 7. Recommendations (LLM wording when available, playbooks otherwise).
    let playbooks = new Map();
    if (cfg) {
      const targets = insights.filter((i) => i.kind !== "praise").slice(0, 12);
      if (targets.length) {
        try {
          playbooks = await recommendationsLLM(
            cfg,
            targets.map((i) => ({
              key: i.key,
              title: i.title,
              kind: i.kind,
              feature: i.feature,
              quotes: i.evidence.slice(0, 6).map((e) => e.quote),
              behaviour: relatedPatterns(i, report.patterns).map((p) => `${p.finding} [${p.dataOrigin} data]`),
            })),
          );
        } catch (e: any) {
          notes.push(`LLM recommendation stage failed (${e.message.slice(0, 120)}); playbook recommendations used.`);
        }
      }
    }
    const recs = buildRecommendations(insights, report.patterns, items.length, playbooks, engine);

    // Persist recommendations, keeping PM decisions (status) across runs.
    await q("UPDATE recommendations SET active = false");
    for (const r of recs) {
      await q(
        `INSERT INTO recommendations(key, data, score, run_id, active, updated_at) VALUES ($1, $2::jsonb, $3, $4, true, now())
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, score = EXCLUDED.score, run_id = EXCLUDED.run_id, active = true`,
        [r.key, JSON.stringify(r), r.score, run.id],
      );
    }

    // Feedback priority = highest priority of any insight it supports.
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
    const prio = new Map<number, keyof typeof order>();
    for (const ins of insights) {
      if (ins.kind === "praise") continue;
      for (const e of ins.evidence) {
        const cur = prio.get(e.feedbackId);
        if (!cur || order[ins.priority] < order[cur]) prio.set(e.feedbackId, ins.priority);
      }
    }
    await q("UPDATE feedback SET priority = NULL");
    for (const [id, p] of prio) await q("UPDATE feedback SET priority = $1 WHERE id = $2", [p, id]);

    const sentiment: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    const categories: Record<string, number> = {};
    for (const it of items) {
      sentiment[it.analysis.sentiment]++;
      categories[it.analysis.primaryCategory] = (categories[it.analysis.primaryCategory] ?? 0) + 1;
    }
    const result: AnalysisResult = {
      runId: run.id,
      engine,
      createdAt: new Date().toISOString(),
      totals: { feedback: rows.length, analysed: items.length, sentiment, categories },
      insights,
      patterns: report.patterns,
      combined,
      notes,
    };
    await q("UPDATE analysis_runs SET status = 'done', result = $1::jsonb, finished_at = now() WHERE id = $2", [JSON.stringify(result), run.id]);
    return result;
  } catch (e: any) {
    await q("UPDATE analysis_runs SET status = 'error', error = $1, finished_at = now() WHERE id = $2", [String(e?.message ?? e), run.id]);
    throw e;
  }
}

export async function latestResult(): Promise<AnalysisResult | null> {
  const rows = await q<{ result: AnalysisResult }>("SELECT result FROM analysis_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1");
  return rows[0]?.result ?? null;
}

/** Analyse a single item immediately (used on submission so the inbox shows results right away). */
export async function analyseItemsNow(ids: number[]) {
  if (!ids.length) return;
  const cfg = llmConfig();
  const rows = await q<any>(`SELECT id, text FROM feedback WHERE id = ANY($1::int[])`, [ids]);
  let llm = new Map<number, FeedbackAnalysis>();
  if (cfg) {
    for (let i = 0; i < rows.length; i += 12) {
      try {
        const res = await analyseBatchLLM(cfg, rows.slice(i, i + 12).map((r) => ({ id: r.id, text: cleanText(r.text) })));
        res.forEach((v, k) => llm.set(k, v));
      } catch {
        /* fall back below */
      }
    }
  }
  for (const r of rows) {
    const a = llm.get(r.id) ?? analyseWithRules(cleanText(r.text));
    await q("UPDATE feedback SET analysis = $1::jsonb, sentiment = $2, category = $3, analyzed_at = now() WHERE id = $4", [
      JSON.stringify(a),
      a.sentiment,
      a.primaryCategory,
      r.id,
    ]);
  }
}
