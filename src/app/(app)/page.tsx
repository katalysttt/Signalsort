"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CalendarDays, GitMerge, MessageSquareQuote, Rocket, Sparkles } from "lucide-react";
import { AreaTrend, Heatmap, Sparkline } from "@/components/charts";
import {
  Badge,
  Card,
  Empty,
  KpiCard,
  Loading,
  OriginBadge,
  PageHeader,
  Pill,
  PriorityBadge,
  ProgressList,
  refreshAll,
  Segmented,
  SENTIMENT_COLORS,
  Spinner,
  TONES,
  useApi,
} from "@/components/ui";
import type { AnalysisResult } from "@/lib/types";

type Metric = "users" | "events" | "feedback";

export default function Overview() {
  const { data, loading } = useApi<any>("/api/overview");
  const { data: recs } = useApi<any>("/api/recommendations");
  const [seeding, setSeeding] = useState(false);
  const [metric, setMetric] = useState<Metric>("users");
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setRunning(!!(e as CustomEvent).detail);
    window.addEventListener("signalsort:running", h);
    return () => window.removeEventListener("signalsort:running", h);
  }, []);

  async function loadDemo() {
    setSeeding(true);
    await fetch("/api/demo", { method: "POST" });
    setSeeding(false);
    refreshAll();
  }

  if (loading && !data) return <Loading />;
  if (!data) return null;
  const result: AnalysisResult | null = data.result;
  const total = data.totals.feedback;
  const b = data.behaviour;
  const hasEvents = b.totals.events > 0;

  const header = (
    <PageHeader
      title="Product intelligence overview"
      subtitle="What users are saying, what they actually do, and what your team should do next."
      tabs={[
        { label: "Overview", href: "/", active: true },
        { label: "Feedback", href: "/inbox" },
        { label: "Behaviour", href: "/behaviour" },
        { label: "Recommendations", href: "/recommendations" },
      ]}
      meta={
        result ? (
          <>
            <span className={`h-1.5 w-1.5 rounded-full ${data.stale ? "bg-amber-500" : "bg-emerald-500"}`} />
            {data.stale ? "New data since last analysis" : `Analysed ${new Date(result.createdAt).toLocaleString()}`}
          </>
        ) : undefined
      }
      actions={
        <>
          {data.range?.from && (
            <Pill>
              <CalendarDays size={15} className="text-navy-400" />
              {fmtRange(data.range.from, data.range.to)}
            </Pill>
          )}
          <button className="btn-primary py-2.5" onClick={() => window.dispatchEvent(new Event("signalsort:run"))} disabled={running}>
            {running ? <Spinner /> : <Sparkles size={16} />} Run analysis
          </button>
        </>
      }
    />
  );

  if (!total && !hasEvents) {
    return (
      <div className="space-y-6">
        {header}
        <Empty
          title="No user signals yet"
          body="Add feedback, upload transcripts or CSVs, or connect the tracking SDK. To see the full journey right away, load the FoodDash demo scenario (6 reviews + simulated behavioural events)."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={loadDemo} disabled={seeding}>
                {seeding ? <Spinner /> : <Rocket size={16} />} Load FoodDash demo
              </button>
              <Link href="/sources" className="btn-secondary">
                Add your own data
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const s = data.sentiment;
  const pct = (k: string) => (total ? Math.round(((s[k] ?? 0) / total) * 100) : 0);
  const insights = result?.insights ?? [];
  const issues = insights.filter((i) => i.kind !== "praise");
  const problems = insights.filter((i) => i.kind === "problem");
  const requests = insights.filter((i) => i.kind === "feature_request");
  const topProblem = [...problems].sort((a, b2) => b2.mentionCount - a.mentionCount || b2.score - a.score)[0];
  const topRequest = [...requests].sort((a, b2) => b2.mentionCount - a.mentionCount || b2.score - a.score)[0];
  const highPriority = issues.filter((i) => i.priority === "P0" || i.priority === "P1");
  const topRec = recs?.items?.find((r: any) => r.status !== "rejected" && r.status !== "implemented");
  const checkout = b.funnels.find((f: any) => f.key === "checkout") ?? b.funnels[0];

  // Merge daily series for the trend chart (each metric shown on its own, never dual-axis).
  const days = new Map<string, any>();
  for (const d of b.daily) days.set(d.date, { date: d.date, users: d.users, events: d.events, feedback: 0 });
  for (const d of data.dailyFeedback) days.set(d.date, { users: 0, events: 0, ...(days.get(d.date) ?? { date: d.date }), feedback: d.feedback });
  const trend = [...days.values()].sort((a, b2) => a.date.localeCompare(b2.date));
  const metricMeta: Record<Metric, { name: string; color: string }> = {
    users: { name: "Active users", color: "#6d55ee" },
    events: { name: "Events", color: "#2a78d6" },
    feedback: { name: "Feedback items", color: "#e07b1f" },
  };

  const categories: string[] = [...new Set<string>(data.categories.map((c: any) => c.category))];
  const cell = (r: string, c: string) => data.matrix.find((m: any) => m.category === r && m.sentiment === c)?.count ?? 0;

  return (
    <div className="space-y-5">
      {header}

      {(data.stale || data.totals.unanalysed > 0 || !result) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} />
          {result ? "New data has arrived since the last analysis run." : "Feedback has been analysed item by item. Run the full analysis to generate insights and recommendations."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Feedback analysed"
          tone="violet"
          value={total}
          href="/inbox"
          chart={<Sparkline data={data.dailyFeedback} dataKey="feedback" color={TONES.violet.stroke} />}
          hint={`${pct("positive")}% positive · ${pct("negative")}% negative · ${pct("neutral")}% neutral · ${pct("mixed")}% mixed`}
        />
        <KpiCard
          label="Active users"
          tone="mint"
          value={b.totals.users}
          href="/behaviour"
          chart={<Sparkline data={b.daily} dataKey="users" color={TONES.mint.stroke} />}
          hint={
            <span className="flex items-center gap-1.5">
              {b.totals.sessions} sessions
            </span>
          }
        />
        <KpiCard
          label={checkout ? `${checkout.name} conversion` : "Conversion"}
          tone="peach"
          value={checkout ? `${checkout.conversionPct}%` : "—"}
          href="/behaviour"
          chart={checkout && <MiniFunnel steps={checkout.steps} />}
          hint={checkout ? `${checkout.entered - checkout.completed} of ${checkout.entered} users did not complete` : "No funnel events yet"}
        />
        <KpiCard
          label="Issues identified"
          tone="sky"
          value={problems.length + requests.length}
          href="/insights"
          chart={<PriorityBars issues={issues} />}
          hint={`${highPriority.length} high priority · ${problems.length} problem${problems.length === 1 ? "" : "s"} · ${requests.length} request${requests.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-navy">Activity overview</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-navy-400">
                <span className="h-2 w-2 rounded-full" style={{ background: metricMeta[metric].color }} /> {metricMeta[metric].name} per day
                {metric !== "feedback" && <OriginBadge origin={b.dataOrigin} />}
              </div>
            </div>
            <Segmented<Metric>
              value={metric}
              onChange={setMetric}
              options={[
                { value: "users", label: "Users" },
                { value: "events", label: "Events" },
                { value: "feedback", label: "Feedback" },
              ]}
            />
          </div>
          <div className="px-2 pb-3 pt-2">
            {trend.length ? (
              <AreaTrend data={trend} series={[{ key: metric, name: metricMeta[metric].name, color: metricMeta[metric].color }]} />
            ) : (
              <p className="p-6 text-sm text-navy-400">No activity yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold text-navy">Sentiment breakdown</h3>
            <Link href="/inbox" className="text-xs font-medium text-brand-600 hover:underline">
              Inbox
            </Link>
          </div>
          <div className="px-5 pb-5 pt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-semibold tracking-tight text-navy">{total}</span>
              <span className="text-xs text-navy-400">feedback items</span>
            </div>
            <div className="mt-4">
              <ProgressList
                rows={(["positive", "mixed", "neutral", "negative"] as const).map((k) => ({
                  label: k.charAt(0).toUpperCase() + k.slice(1),
                  value: s[k] ?? 0,
                  color: SENTIMENT_COLORS[k],
                }))}
              />
            </div>
            <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-xs text-navy-500">
              {data.signals.positive} positive, {data.signals.negative} negative and {data.signals.neutral} neutral signals. Mixed items keep both halves.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold text-navy">Top issues</h3>
            <Link href="/insights" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              View all insights <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto px-5 pb-4 pt-3">
            {issues.length ? (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="bg-[#f6f4ff] text-xs text-navy-500">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Issue</th>
                    <th className="px-3 py-2.5 text-right font-medium">Mentions</th>
                    <th className="px-3 py-2.5 text-right font-medium">Frequency</th>
                    <th className="px-3 py-2.5 font-medium">Evidence</th>
                    <th className="rounded-r-lg px-3 py-2.5 text-right font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {issues.slice(0, 6).map((i) => (
                    <tr key={i.key} className="hover:bg-surface/60">
                      <td className="px-3 py-3">
                        <a href={`/insights#${encodeURIComponent(i.key)}`} className="font-medium text-navy hover:text-brand-600">
                          {i.title}
                        </a>
                        <div className="text-xs text-navy-400">{i.kind === "problem" ? "Problem" : "Feature request"} · {i.feature}</div>
                      </td>
                      <td className="px-3 py-3 text-right text-navy">{i.mentionCount}</td>
                      <td className="px-3 py-3 text-right text-navy-500">{i.frequency}%</td>
                      <td className="px-3 py-3">
                        {(result?.combined ?? []).some((c) => c.insightKeys.includes(i.key)) ? <Badge tone="brand">Feedback + behaviour</Badge> : <Badge>Feedback</Badge>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <PriorityBadge p={i.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-6 text-sm text-navy-400">Run analysis to identify issues.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-5 pt-5">
            <h3 className="text-sm font-semibold text-navy">Sentiment by category</h3>
            <p className="mt-0.5 text-xs text-navy-400">Feedback items per primary category</p>
          </div>
          <div className="px-4 pb-4 pt-3">
            {categories.length ? (
              <Heatmap
                rows={categories}
                cols={["positive", "neutral", "mixed", "negative"]}
                colLabels={{ positive: "Pos", neutral: "Neu", mixed: "Mix", negative: "Neg" }}
                value={cell}
              />
            ) : (
              <p className="text-sm text-navy-400">No categorised feedback yet.</p>
            )}
          </div>
        </Card>
      </div>

      {result && result.combined.length > 0 && (
        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
              <GitMerge size={16} className="text-brand-600" /> Where feedback and behaviour agree
            </h3>
            <Link href="/insights#combined" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {result.combined.slice(0, 2).map((c) => (
              <div key={c.key} className="rounded-xl border border-[#ece6fb] bg-gradient-to-br from-[#f6f3ff] to-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-navy">{c.title}</div>
                  <Badge tone={c.strength === "strong" ? "brand" : "gray"}>{c.strength === "strong" ? "Strong signal" : "Moderate"}</Badge>
                </div>
                <p className="mt-2 text-sm text-navy-500">{c.conclusion}</p>
                <p className="mt-2 text-xs italic text-navy-400">{c.causalityNote}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <HighlightCard
          icon={<AlertTriangle size={16} />}
          tone="rose"
          label="Most frequently reported problem"
          title={topProblem?.title}
          meta={topProblem && `${topProblem.mentionCount} mention${topProblem.mentionCount === 1 ? "" : "s"} · ${topProblem.frequency}% of feedback`}
          quote={topProblem?.evidence[0] && `“${topProblem.evidence[0].quote}”`}
          badge={topProblem && <PriorityBadge p={topProblem.priority} />}
        />
        <HighlightCard
          icon={<MessageSquareQuote size={16} />}
          tone="sky"
          label="Most requested feature"
          title={topRequest?.title}
          meta={topRequest && `${topRequest.mentionCount} request${topRequest.mentionCount === 1 ? "" : "s"}`}
          quote={topRequest?.evidence[0] && `“${topRequest.evidence[0].quote}”`}
          badge={topRequest && <PriorityBadge p={topRequest.priority} />}
        />
        <HighlightCard
          icon={<Sparkles size={16} />}
          tone="violet"
          label="Recommended next action"
          title={topRec?.title}
          meta={topRec && `Score ${topRec.score}/100 · ${topRec.status.replace("_", " ")}`}
          quote={topRec?.whatToChange}
          badge={topRec && <PriorityBadge p={topRec.priority} />}
          href="/recommendations"
        />
      </div>
    </div>
  );
}

function MiniFunnel({ steps }: { steps: { users: number }[] }) {
  const max = steps[0]?.users || 1;
  return (
    <div className="flex h-full items-end justify-end gap-1">
      {steps.map((s, i) => (
        <div key={i} className="w-4 rounded-t" style={{ height: `${Math.max(8, (s.users / max) * 100)}%`, background: TONES.peach.stroke, opacity: 0.45 + 0.55 * (s.users / max) }} />
      ))}
    </div>
  );
}

function PriorityBars({ issues }: { issues: { priority: string }[] }) {
  const counts = ["P0", "P1", "P2", "P3"].map((p) => issues.filter((i) => i.priority === p).length);
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-full items-end justify-end gap-1" title={`P0 ${counts[0]} · P1 ${counts[1]} · P2 ${counts[2]} · P3 ${counts[3]}`}>
      {counts.map((c, i) => (
        <div key={i} className="flex w-4 flex-col items-center justify-end">
          <div className="w-full rounded-t" style={{ height: `${Math.max(3, (c / max) * 30)}px`, background: TONES.sky.stroke, opacity: 1 - i * 0.2 }} />
          <span className="mt-0.5 text-[8px] text-navy-400">P{i}</span>
        </div>
      ))}
    </div>
  );
}

function HighlightCard({
  icon,
  tone,
  label,
  title,
  meta,
  quote,
  badge,
  href,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  label: string;
  title?: string;
  meta?: React.ReactNode;
  quote?: string;
  badge?: React.ReactNode;
  href?: string;
}) {
  const t = TONES[tone];
  const body = (
    <Card className="h-full p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-navy-400">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>{icon}</span>
          {label}
        </div>
        {badge}
      </div>
      {title ? (
        <>
          <div className="mt-3 font-semibold text-navy">{title}</div>
          {meta && <div className="mt-0.5 text-xs text-navy-400">{meta}</div>}
          {quote && <p className="mt-3 line-clamp-3 text-sm text-navy-500">{quote}</p>}
        </>
      ) : (
        <div className="mt-3 text-sm text-navy-400">Nothing identified yet.</div>
      )}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function fmtRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${f.toLocaleDateString("en-GB", o)} – ${t.toLocaleDateString("en-GB", { ...o, year: "numeric" })}`;
}
