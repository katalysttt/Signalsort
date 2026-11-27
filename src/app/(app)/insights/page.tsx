"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ChevronDown, GitMerge, Info, Lightbulb, Quote, ThumbsUp } from "lucide-react";
import { Badge, Card, Empty, human, Loading, OriginBadge, PriorityBadge, SENTIMENT_COLORS, useApi, PageHeader } from "@/components/ui";
import { AREA_LABELS, type AnalysisResult, type BehaviourPattern, type Insight, type Recommendation } from "@/lib/types";

export default function InsightsPage() {
  const { data, loading } = useApi<{ result: AnalysisResult | null }>("/api/results");
  const { data: recs } = useApi<{ items: Recommendation[] }>("/api/recommendations");
  if (loading && !data) return <Loading />;
  const r = data?.result;
  if (!r) return <Empty title="No insights yet" body="Add feedback and press “Run analysis” to group it into themes, recurring problems and requests." />;
  const recByInsight = new Map((recs?.items ?? []).map((x) => [x.insightKey, x]));
  const issues = r.insights.filter((i) => i.kind !== "praise");
  const praise = r.insights.filter((i) => i.kind === "praise" && !i.key.startsWith("general:"));
  const patternMap = new Map(r.patterns.map((p) => [p.key, p]));

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Insights"
          subtitle="Feedback grouped into recurring themes. Counts and percentages are computed from linked feedback, and every insight traces back to the original quotes."
          tabs={[
            ...(r.combined.length ? [{ label: "Combined", href: "#combined" }] : []),
            { label: "Problems & requests", href: "#issues" },
            ...(praise.length ? [{ label: "Strengths", href: "#strengths" }] : []),
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-navy-400">
          <Badge>{r.totals.analysed} feedback items analysed</Badge>
          <Badge>Run #{r.runId} · {new Date(r.createdAt).toLocaleString()}</Badge>
        </div>
        {r.notes.length > 0 && (
          <div className="mt-3 space-y-1 rounded-xl border border-line bg-white px-4 py-3 text-xs text-navy-500">
            {r.notes.map((n, i) => (
              <div key={i} className="flex gap-2">
                <Info size={14} className="mt-0.5 shrink-0 text-navy-300" />
                {n}
              </div>
            ))}
          </div>
        )}
      </div>

      {r.combined.length > 0 && (
        <section id="combined" className="space-y-3">
          <SectionTitle icon={<GitMerge size={16} />} title="Combined insights" sub="Where what users say and what users do point to the same product area" />
          {r.combined.map((c) => (
            <Card key={c.key} className="overflow-hidden">
              <div className="gradient-hero border-b border-line px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-brand-600">{AREA_LABELS[c.area]}</div>
                    <h3 className="mt-1 text-lg font-semibold text-navy">{c.title}</h3>
                  </div>
                  <Badge tone={c.strength === "strong" ? "brand" : "gray"}>{c.strength === "strong" ? "Strong, consistent signal" : "Moderate signal"}</Badge>
                </div>
              </div>
              <div className="grid gap-0 md:grid-cols-2">
                <div className="border-b border-line p-5 md:border-b-0 md:border-r">
                  <div className="label flex items-center gap-1.5">
                    <Quote size={12} /> What users say
                  </div>
                  <ul className="space-y-3">
                    {c.insightKeys.map((k) => {
                      const ins = r.insights.find((i) => i.key === k);
                      if (!ins) return null;
                      return (
                        <li key={k}>
                          <a href={`#${encodeURIComponent(k)}`} className="text-sm font-medium text-navy hover:text-brand-600">
                            {ins.title}
                          </a>
                          <div className="text-xs text-navy-400">
                            {ins.mentionCount} mention{ins.mentionCount === 1 ? "" : "s"} · {ins.frequency}% of feedback
                          </div>
                          <p className="mt-1 text-sm italic text-navy-500">“{ins.evidence[0]?.quote}”</p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="p-5">
                  <div className="label flex items-center gap-1.5">
                    <Activity size={12} /> What users do
                  </div>
                  <ul className="space-y-3">
                    {c.patternKeys.map((k) => {
                      const p = patternMap.get(k);
                      if (!p) return null;
                      return (
                        <li key={k}>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
                            {p.title} <OriginBadge origin={p.dataOrigin} />
                          </div>
                          <p className="mt-1 text-sm text-navy-500">{p.finding}</p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 border-t border-line bg-amber-50/60 px-5 py-3 text-xs text-amber-900">
                <Info size={14} className="mt-0.5 shrink-0" /> {c.causalityNote}
              </div>
            </Card>
          ))}
        </section>
      )}

      <section id="issues" className="scroll-mt-24 space-y-3">
        <SectionTitle icon={<Lightbulb size={16} />} title="Recurring problems & requests" sub={`${issues.length} themes, ranked by priority score`} />
        {issues.length === 0 && <Empty title="No problems or requests detected" />}
        {issues.map((i) => (
          <InsightCard key={i.key} ins={i} rec={recByInsight.get(i.key)} patterns={r.patterns.filter((p) => recByInsight.get(i.key)?.patternKeys.includes(p.key))} total={r.totals.analysed} />
        ))}
      </section>

      {praise.length > 0 && (
        <section id="strengths" className="scroll-mt-24 space-y-3">
          <SectionTitle icon={<ThumbsUp size={16} />} title="What users appreciate" sub="Strengths to protect when changing the product" />
          <div className="grid gap-3 md:grid-cols-2">
            {praise.map((i) => (
              <Card key={i.key} className="p-5" >
                <div id={i.key} className="scroll-mt-24" />
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-navy">{i.title}</div>
                  <Badge tone="green">{i.mentionCount} mention{i.mentionCount === 1 ? "" : "s"}</Badge>
                </div>
                <div className="mt-1 text-xs text-navy-400">
                  {i.feature} · {i.category}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {i.evidence.slice(0, 3).map((e, n) => (
                    <li key={n} className="border-l-2 border-emerald-200 pl-3 text-sm italic text-navy-500">
                      “{e.quote}”{" "}
                      <Link href={`/inbox`} className="not-italic text-xs text-navy-300 hover:text-brand-600">
                        #{e.feedbackId}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
        <div>
          <h2 className="font-semibold text-navy">{title}</h2>
          {sub && <p className="text-xs text-navy-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function InsightCard({ ins, rec, patterns, total }: { ins: Insight; rec?: Recommendation; patterns: BehaviourPattern[]; total: number }) {
  const sTotal = ins.sentiment.positive + ins.sentiment.negative + ins.sentiment.neutral || 1;
  const negPct = Math.round((ins.sentiment.negative / sTotal) * 100);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (decodeURIComponent(window.location.hash.slice(1)) === ins.key) setOpen(true);
  }, [ins.key]);
  return (
    <Card className="overflow-hidden">
      <div id={ins.key} className="scroll-mt-24" />
      <button className="flex w-full items-start gap-4 p-5 text-left hover:bg-surface/50" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge p={ins.priority} />
            <Badge tone={ins.kind === "problem" ? "red" : "blue"}>{ins.kind === "problem" ? "Problem" : "Feature request"}</Badge>
            {patterns.length > 0 && <Badge tone="brand">Backed by behaviour</Badge>}
          </div>
          <h3 className="mt-2 text-base font-semibold text-navy">{ins.title}</h3>
          {!open && ins.evidence[0] && <p className="mt-1 truncate text-sm italic text-navy-500">“{ins.evidence[0].quote}”</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold text-navy">{ins.mentionCount}</div>
          <div className="text-[11px] text-navy-400">mention{ins.mentionCount === 1 ? "" : "s"}</div>
        </div>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-navy-300 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
      <div className="border-t border-line p-5 pt-4">
      <p className="text-sm text-navy-500">{ins.description} <span className="text-navy-400">({ins.feature} · {ins.category} · score {ins.score}/100)</span></p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Users mentioning" value={ins.mentionCount} sub={`of ${total} feedback items`} />
        <Metric label="Frequency" value={`${ins.frequency}%`} sub={`${ins.sourceCount} source${ins.sourceCount === 1 ? "" : "s"}`} />
        <div className="rounded-xl bg-surface p-3">
          <div className="text-[11px] font-medium text-navy-400">Sentiment of related signals</div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full">
            {(["positive", "neutral", "negative"] as const).map((k) =>
              ins.sentiment[k] ? <div key={k} style={{ width: `${(ins.sentiment[k] / sTotal) * 100}%`, background: SENTIMENT_COLORS[k] }} /> : null,
            )}
          </div>
          <div className="mt-1.5 text-xs text-navy-500">
            {ins.kind === "problem" ? `${negPct}% negative` : `${ins.sentiment.neutral} neutral · ${ins.sentiment.negative} negative`}
          </div>
        </div>
        <Metric label="Severity" value={`${ins.severity}/5`} sub={`Business impact ${ins.businessImpact}/5`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="label">Supporting quotes</div>
          <ul className="space-y-1.5">
            {ins.evidence.slice(0, 4).map((e, n) => (
              <li key={n} className="border-l-2 border-line pl-3 text-sm italic text-navy-500">
                “{e.quote}” <span className="not-italic text-xs text-navy-300">— feedback #{e.feedbackId}{e.sourceName ? ` · ${e.sourceName}` : ""}</span>
              </li>
            ))}
            {ins.evidence.length > 4 && <li className="text-xs text-navy-400">+{ins.evidence.length - 4} more</li>}
          </ul>
          <div className="label mt-4">Potential business impact</div>
          <p className="text-sm text-navy-500">{ins.impact}</p>
        </div>
        <div className="space-y-4">
          {patterns.length > 0 && (
            <div>
              <div className="label">Behavioural evidence</div>
              {patterns.map((p) => (
                <div key={p.key} className="mb-2 rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-navy">
                    <Activity size={14} className="text-electric-500" /> {human(p.type)} <OriginBadge origin={p.dataOrigin} />
                  </div>
                  <p className="mt-1 text-navy-500">{p.finding}</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="label">Recommended solution</div>
            <p className="text-sm text-navy">{ins.recommendation || rec?.whatToChange || "—"}</p>
            {rec && (
              <Link href={`/recommendations#${encodeURIComponent(rec.key)}`} className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                Full recommendation, experiments & metrics →
              </Link>
            )}
          </div>
        </div>
      </div>
      </div>
      )}
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="text-[11px] font-medium text-navy-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-navy">{value}</div>
      {sub && <div className="text-xs text-navy-400">{sub}</div>}
    </div>
  );
}
