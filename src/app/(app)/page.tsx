"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, GitMerge, MessageSquareQuote, MousePointerClick, Rocket, Sparkles } from "lucide-react";
import { FunnelChart, HBar, SentimentBar, TrendLine } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, Loading, OriginBadge, PriorityBadge, refreshAll, SENTIMENT_COLORS, Spinner, Stat, useApi } from "@/components/ui";
import type { AnalysisResult } from "@/lib/types";

export default function Overview() {
  const { data, loading } = useApi<any>("/api/overview");
  const { data: recs } = useApi<any>("/api/recommendations");
  const [seeding, setSeeding] = useState(false);

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
  const hasEvents = data.behaviour.totals.events > 0;

  if (!total && !hasEvents) {
    return (
      <div className="space-y-6">
        <Hero />
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
  const p = (k: string) => (total ? Math.round(((s[k] ?? 0) / total) * 100) : 0);
  const insights = result?.insights ?? [];
  const problems = insights.filter((i) => i.kind === "problem");
  const requests = insights.filter((i) => i.kind === "feature_request");
  const topProblem = [...problems].sort((a, b) => b.mentionCount - a.mentionCount || b.score - a.score)[0];
  const topRequest = [...requests].sort((a, b) => b.mentionCount - a.mentionCount || b.score - a.score)[0];
  const highPriority = insights.filter((i) => i.kind !== "praise" && (i.priority === "P0" || i.priority === "P1"));
  const topRec = recs?.items?.find((r: any) => r.status !== "rejected" && r.status !== "implemented");
  const checkout = data.behaviour.funnels.find((f: any) => f.key === "checkout") ?? data.behaviour.funnels[0];

  return (
    <div className="space-y-6">
      <Hero result={result} />

      {(data.stale || data.totals.unanalysed > 0 || !result) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} />
          {result ? "New data has arrived since the last analysis run." : "Feedback has been analysed item-by-item. Run the full analysis to generate insights and recommendations."}
          <span className="text-amber-700">Use “Run analysis” in the top bar to refresh insights.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Feedback analysed" value={total} hint={`${data.sources.length} source type${data.sources.length === 1 ? "" : "s"}`} />
        <Stat label="Positive" value={`${p("positive")}%`} accent={SENTIMENT_COLORS.positive} hint={items(s.positive)} />
        <Stat label="Negative" value={`${p("negative")}%`} accent={SENTIMENT_COLORS.negative} hint={items(s.negative)} />
        <Stat label="Neutral" value={`${p("neutral")}%`} accent={SENTIMENT_COLORS.neutral} hint={items(s.neutral)} />
        <Stat label="Mixed" value={`${p("mixed")}%`} accent={SENTIMENT_COLORS.mixed} hint={items(s.mixed)} />
        <Stat label="Issues identified" value={problems.length + requests.length} hint={`${problems.length} problems · ${requests.length} requests`} />
        <Stat label="High priority" value={highPriority.length} hint="P0 + P1 issues" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <HighlightCard
          icon={<AlertTriangle size={16} />}
          tone="red"
          label="Most frequently reported problem"
          title={topProblem?.title}
          meta={topProblem && `${topProblem.mentionCount} mention${topProblem.mentionCount === 1 ? "" : "s"} · ${topProblem.frequency}% of feedback`}
          quote={topProblem?.evidence[0] && `“${topProblem.evidence[0].quote}”`}
          badge={topProblem && <PriorityBadge p={topProblem.priority} />}
        />
        <HighlightCard
          icon={<MessageSquareQuote size={16} />}
          tone="blue"
          label="Most requested feature"
          title={topRequest?.title}
          meta={topRequest && `${topRequest.mentionCount} request${topRequest.mentionCount === 1 ? "" : "s"}`}
          quote={topRequest?.evidence[0] && `“${topRequest.evidence[0].quote}”`}
          badge={topRequest && <PriorityBadge p={topRequest.priority} />}
        />
        <HighlightCard
          icon={<Sparkles size={16} />}
          tone="brand"
          label="Recommended next action"
          title={topRec?.title}
          meta={topRec && `Score ${topRec.score}/100 · ${topRec.status.replace("_", " ")}`}
          quote={topRec?.whatToChange}
          badge={topRec && <PriorityBadge p={topRec.priority} />}
          href="/recommendations"
        />
      </div>

      {result && result.combined.length > 0 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <GitMerge size={16} className="text-brand-600" /> Where feedback and behaviour agree
              </span>
            }
            subtitle="Unified product intelligence: qualitative and quantitative signals pointing at the same product area"
            action={<Link href="/insights#combined" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}
          />
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {result.combined.slice(0, 2).map((c) => (
              <div key={c.key} className="rounded-xl border border-line bg-gradient-to-br from-brand-50/60 to-white p-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sentiment breakdown" subtitle="Per feedback item. Mixed items contain both praise and complaints." />
          <div className="p-5">
            <SentimentBar data={s} />
            <div className="mt-4 rounded-lg bg-surface px-3 py-2 text-xs text-navy-500">
              Signal level: <b className="text-navy">{data.signals.positive}</b> positive, <b className="text-navy">{data.signals.negative}</b> negative and{" "}
              <b className="text-navy">{data.signals.neutral}</b> neutral signals extracted from {total} items.
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Feedback categories" subtitle="Primary category of each feedback item" />
          <div className="px-3 pb-3">
            <HBar data={data.categories} dataKey="count" nameKey="category" color="#6d55ee" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Issue frequency" subtitle="Feedback items supporting each problem or request" action={<Link href="/insights" className="text-xs font-medium text-brand-600 hover:underline">Insights</Link>} />
          <div className="px-3 pb-3">
            {insights.filter((i) => i.kind !== "praise").length ? (
              <HBar
                data={insights.filter((i) => i.kind !== "praise").slice(0, 8).map((i) => ({ name: i.title.length > 32 ? i.title.slice(0, 30) + "…" : i.title, count: i.mentionCount }))}
                dataKey="count"
                nameKey="name"
                color="#2a78d6"
              />
            ) : (
              <div className="py-8 text-center text-sm text-navy-400">Run analysis to identify issues</div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MousePointerClick size={16} className="text-electric-500" /> User engagement
              </span>
            }
            subtitle={hasEvents ? `${data.behaviour.totals.users} users · ${data.behaviour.totals.sessions} sessions · ${data.behaviour.totals.events} events` : "Connect the SDK to see behaviour"}
            action={<OriginBadge origin={data.behaviour.dataOrigin} />}
          />
          <div className="p-5">
            {hasEvents ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-navy-400">Daily active users</div>
                  <TrendLine data={data.behaviour.daily} lines={[{ key: "users", name: "Active users", color: "#2a78d6" }]} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-navy-400">{checkout ? `${checkout.name} funnel` : "Funnels"}</div>
                  {checkout ? <FunnelChart steps={checkout.steps} /> : <div className="text-sm text-navy-400">No funnel events yet</div>}
                </div>
              </div>
            ) : (
              <Link href="/sources#sdk" className="btn-secondary">
                Connect tracking SDK <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Hero({ result }: { result?: AnalysisResult | null }) {
  return (
    <div className="gradient-hero card overflow-hidden px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">Product intelligence overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">What users are saying, what they are actually doing, and what your team should do next.</p>
        </div>
        {result && (
          <div className="text-right text-xs text-navy-400">
            Last analysis {new Date(result.createdAt).toLocaleString()}
            <div>
              Engine: <span className="font-medium text-navy-500">{result.engine === "rules" ? "rule-based" : result.engine}</span>
            </div>
          </div>
        )}
      </div>
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
  tone: "red" | "blue" | "brand";
  label: string;
  title?: string;
  meta?: React.ReactNode;
  quote?: string;
  badge?: React.ReactNode;
  href?: string;
}) {
  const tones = { red: "bg-red-50 text-red-700", blue: "bg-electric-100 text-electric-500", brand: "bg-brand-50 text-brand-700" };
  const body = (
    <Card className="h-full p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-navy-400">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
          {label}
        </div>
        {badge}
      </div>
      {title ? (
        <>
          <div className="mt-3 font-semibold text-navy">{title}</div>
          {meta && <div className="mt-0.5 text-xs text-navy-400">{meta}</div>}
          {quote && <p className="mt-3 line-clamp-3 border-l-2 border-line pl-3 text-sm text-navy-500">{quote}</p>}
        </>
      ) : (
        <div className="mt-3 text-sm text-navy-400">Nothing identified yet.</div>
      )}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function items(n: number) {
  return `${n} item${n === 1 ? "" : "s"}`;
}
