"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CalendarDays, GitMerge, MessageSquareQuote, Rocket, Sparkles } from "lucide-react";
import { Sparkline } from "@/components/charts";
import {
  Card,
  Empty,
  KpiCard,
  Loading,
  PageHeader,
  Pill,
  PriorityBadge,
  ProgressList,
  refreshAll,
  SENTIMENT_COLORS,
  Spinner,
  TONES,
  useApi,
} from "@/components/ui";
import type { AnalysisResult } from "@/lib/types";

export default function Overview() {
  const { data, loading } = useApi<any>("/api/overview");
  const { data: recs } = useApi<any>("/api/recommendations");
  const [seeding, setSeeding] = useState(false);
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
          body="Add feedback, upload transcripts or CSVs, or connect the tracking SDK. To see the full journey right away, load the FoodDash demo scenario."
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
  const highPriority = issues.filter((i) => i.priority === "P0" || i.priority === "P1");
  const topRec = recs?.items?.find((r: any) => r.status !== "rejected" && r.status !== "implemented");
  const checkout = b.funnels.find((f: any) => f.key === "checkout") ?? b.funnels[0];


  const topInsight = topRec?.insightKey ? insights.find((i) => i.key === topRec.insightKey) : undefined;
  const topPatterns = (result?.patterns ?? []).filter((p) => topRec?.patternKeys?.includes(p.key));
  const firstSentence = (t: string) => t.split(/(?<=\.)\s/)[0];

  return (
    <div className="space-y-5">
      {header}

      {(data.stale || data.totals.unanalysed > 0 || !result) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} />
          {result ? "New data has arrived since the last analysis run." : "Run the analysis to generate insights and recommendations."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Feedback analysed"
          tone="violet"
          value={total}
          href="/inbox"
          chart={<Sparkline data={data.dailyFeedback} dataKey="feedback" color={TONES.violet.stroke} />}
          hint={`${pct("negative") + pct("mixed")}% raise a problem`}
        />
        <KpiCard
          label="Active users"
          tone="mint"
          value={b.totals.users}
          href="/behaviour"
          chart={<Sparkline data={b.daily} dataKey="users" color={TONES.mint.stroke} />}
          hint={`${b.totals.sessions} sessions`}
        />
        <KpiCard
          label={checkout ? `${checkout.name} conversion` : "Conversion"}
          tone="peach"
          value={checkout ? `${checkout.conversionPct}%` : "—"}
          href="/behaviour"
          chart={checkout && <MiniFunnel steps={checkout.steps} />}
          hint={checkout ? `${checkout.entered - checkout.completed} of ${checkout.entered} didn’t finish` : "No funnel events yet"}
        />
        <KpiCard
          label="High-priority issues"
          tone="sky"
          value={highPriority.length}
          href="/insights"
          chart={<PriorityBars issues={issues} />}
          hint={`of ${problems.length + requests.length} issues found`}
        />
      </div>

      {topRec && (
        <Card className="overflow-hidden">
          <div className="gradient-hero px-6 py-6 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">
                <Sparkles size={14} /> Fix this first
              </span>
              <PriorityBadge p={topRec.priority} />
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-navy">{topRec.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-navy-500">{firstSentence(topRec.whatToChange)}</p>
          </div>
          <div className="grid gap-px bg-line md:grid-cols-2">
            <div className="bg-white px-6 py-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-navy-400">
                <MessageSquareQuote size={14} /> What users say
              </div>
              {topInsight ? (
                <>
                  <p className="mt-2 text-lg font-medium leading-snug text-navy">“{topInsight.evidence[0]?.quote}”</p>
                  <p className="mt-1 text-xs text-navy-400">
                    {topInsight.mentionCount} mention{topInsight.mentionCount === 1 ? "" : "s"} across {topInsight.sourceCount} source{topInsight.sourceCount === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-navy-400">No direct feedback yet.</p>
              )}
            </div>
            <div className="bg-white px-6 py-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-navy-400">
                <GitMerge size={14} /> What users do
              </div>
              {topPatterns.length ? (
                <>
                  <p className="mt-2 text-lg font-medium leading-snug text-navy">{topPatterns[0].title}</p>
                  {topPatterns[1] && <p className="mt-1 text-sm text-navy-500">{topPatterns[1].title}</p>}
                </>
              ) : (
                <p className="mt-2 text-sm text-navy-400">No behaviour pattern linked yet.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-line bg-white px-6 py-3">
            <Link href={`/recommendations#${encodeURIComponent(topRec.key)}`} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              See the full recommendation <ArrowUpRight size={14} />
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold text-navy">Top issues</h3>
            <Link href="/insights" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              All insights <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="px-5 pb-3 pt-2">
            {issues.length ? (
              <ul className="divide-y divide-line">
                {issues.slice(0, 5).map((i) => (
                  <li key={i.key}>
                    <a href={`/insights#${encodeURIComponent(i.key)}`} className="flex items-center gap-3 py-3 hover:bg-surface/60">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-navy">{i.title}</div>
                        <div className="text-xs text-navy-400">
                          {i.mentionCount} mention{i.mentionCount === 1 ? "" : "s"}
                          {(result?.combined ?? []).some((c) => c.insightKeys.includes(i.key)) && " · backed by behaviour"}
                        </div>
                      </div>
                      <PriorityBadge p={i.priority} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-navy-400">Run analysis to identify issues.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h3 className="text-sm font-semibold text-navy">Sentiment</h3>
            <Link href="/inbox" className="text-xs font-medium text-brand-600 hover:underline">
              Inbox
            </Link>
          </div>
          <div className="px-5 pb-5 pt-4">
            <ProgressList
              rows={(["positive", "mixed", "neutral", "negative"] as const).map((k) => ({
                label: k.charAt(0).toUpperCase() + k.slice(1),
                value: s[k] ?? 0,
                color: SENTIMENT_COLORS[k],
              }))}
            />
          </div>
        </Card>
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


function fmtRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${f.toLocaleDateString("en-GB", o)} – ${t.toLocaleDateString("en-GB", { ...o, year: "numeric" })}`;
}
