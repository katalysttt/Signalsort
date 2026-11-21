"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Radio } from "lucide-react";
import { AreaTrend, FunnelChart, HBar, Sparkline } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, human, Loading, OriginBadge, useApi, KpiCard, PageHeader, Segmented, TONES } from "@/components/ui";
import type { BehaviourReport } from "@/lib/engine/behaviour";
import { AREA_LABELS } from "@/lib/types";

export default function BehaviourPage() {
  const [sim, setSim] = useState(true);
  const [metric, setMetric] = useState<"users" | "events">("users");
  const { data, loading, reload } = useApi<{ report: BehaviourReport; recent: any[] }>(`/api/behaviour?simulated=${sim ? 1 : 0}`);
  if (loading && !data) return <Loading />;
  const r = data?.report;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Behaviour analytics"
        subtitle="What users actually do, computed from events sent by the SignalSort SDK or tracking API."
        meta={r ? <OriginBadge origin={r.dataOrigin} /> : undefined}
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy-500 shadow-sm">
              <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Include simulated events
            </label>
            <button className="btn-secondary py-2" onClick={reload}>
              Refresh
            </button>
          </>
        }
      />

      {r && r.dataOrigin !== "none" && r.dataOrigin !== "live" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            {r.totals.simulatedEvents} of {r.totals.events} events are <b>simulated</b> to reproduce the hackathon scenario (FoodDash). They are not real user behaviour.
            {r.totals.liveEvents > 0 && ` ${r.totals.liveEvents} events are live from the SDK.`} Untick “Include simulated demo events” to see live data only.
          </div>
        </div>
      )}

      {!r || r.totals.events === 0 ? (
        <Empty
          title="No events yet"
          body="Install the JavaScript SDK in your product, or open the FoodDash demo app and click around — events stream in live."
          action={
            <div className="flex gap-2">
              <a href="/demo-app" target="_blank" className="btn-primary">
                Open FoodDash demo app
              </a>
              <Link href="/sources#sdk" className="btn-secondary">
                SDK setup
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Active users"
              tone="violet"
              value={r.totals.users}
              chart={<Sparkline data={r.daily} dataKey="users" color={TONES.violet.stroke} />}
              hint={`${r.totals.signups} sign-ups · ${r.totals.logins} logins`}
            />
            <KpiCard
              label="Sessions"
              tone="mint"
              value={r.totals.sessions}
              chart={<Sparkline data={r.daily} dataKey="events" color={TONES.mint.stroke} />}
              hint={`Median session ${r.totals.medianSessionSeconds != null ? fmtDur(r.totals.medianSessionSeconds) : "—"}`}
            />
            <KpiCard label="Events tracked" tone="peach" value={r.totals.events.toLocaleString()} hint={`${r.totals.searches} searches · ${r.totals.failedActions} failed actions`} />
            <KpiCard label="Patterns detected" tone="sky" value={r.patterns.length} hint={`${r.patterns.filter((p) => p.severity >= 4).length} high severity`} />
          </div>

          <Card>
            <CardHeader title="Behavioural anomalies & patterns" subtitle="Detected automatically from the event stream" action={<OriginBadge origin={r.dataOrigin} />} />
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {r.patterns.length === 0 && <p className="text-sm text-navy-400">No notable patterns detected yet.</p>}
              {r.patterns.map((p) => (
                <div key={p.key} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.severity >= 4 ? "red" : p.severity === 3 ? "amber" : "gray"}>{human(p.type)}</Badge>
                    <Badge>{AREA_LABELS[p.area]}</Badge>
                    <OriginBadge origin={p.dataOrigin} />
                  </div>
                  <div className="mt-2 font-semibold text-navy">{p.title}</div>
                  <p className="mt-1 text-sm text-navy-500">{p.finding}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-navy-400">
                      <span>{p.metric.label}</span>
                      <span className="font-medium text-navy">
                        {p.metric.numerator} / {p.metric.denominator}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface">
                      <div className="h-1.5 rounded-full bg-electric-500" style={{ width: `${Math.min(100, (p.metric.numerator / Math.max(1, p.metric.denominator)) * 100)}%` }} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs italic text-navy-400">{p.interpretation}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {r.funnels.map((f) => (
              <Card key={f.key}>
                <CardHeader title={`${f.name} funnel`} subtitle={`${f.entered} entered · ${f.completed} completed · ${f.conversionPct}% conversion`} />
                <div className="p-5">
                  <FunnelChart steps={f.steps} />
                </div>
              </Card>
            ))}
            <Card>
              <div className="flex items-center justify-between px-5 pt-5">
                <div>
                  <h3 className="text-sm font-semibold text-navy">User activity</h3>
                  <p className="mt-0.5 text-xs text-navy-400">{metric === "users" ? "Daily active users" : "Events per day"}</p>
                </div>
                <Segmented<"users" | "events">
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "users", label: "Users" },
                    { value: "events", label: "Events" },
                  ]}
                />
              </div>
              <div className="px-2 pb-3 pt-2">
                <AreaTrend data={r.daily} series={[{ key: metric, name: metric === "users" ? "Active users" : "Events", color: metric === "users" ? "#6d55ee" : "#2a78d6" }]} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Feature adoption" subtitle="Share of active users who used each feature (most → least used)" />
              <div className="px-3 pb-3">
                {r.features.length ? (
                  <HBar data={r.features.map((f) => ({ name: human(f.feature) + (f.isNew ? " (new)" : ""), adoption: f.adoptionPct }))} dataKey="adoption" nameKey="name" unit="%" color="#6d55ee" />
                ) : (
                  <p className="p-4 text-sm text-navy-400">
                    No <code>feature_used</code> events yet.
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Page navigation" subtitle="Unique visitors per page" />
              <div className="px-3 pb-3">
                <HBar data={r.pages.slice(0, 8).map((p) => ({ name: human(p.page), users: p.users }))} dataKey="users" nameKey="name" color="#2a78d6" />
              </div>
            </Card>
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Radio size={14} className="text-emerald-600" /> Latest events received
                  </span>
                }
                subtitle="Most recent 25 events"
              />
              <div className="max-h-80 overflow-y-auto px-5 pb-4">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-navy-400">
                    <tr>
                      <th className="py-2 font-medium">Event</th>
                      <th className="py-2 font-medium">User</th>
                      <th className="py-2 font-medium">Source</th>
                      <th className="py-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data!.recent.map((e, i) => (
                      <tr key={i}>
                        <td className="py-1.5 font-mono text-navy">{e.event}</td>
                        <td className="py-1.5 text-navy-500">{e.userId.slice(0, 18)}</td>
                        <td className="py-1.5">{e.source === "simulated" ? <Badge tone="amber">simulated</Badge> : <Badge tone="green">{e.source}</Badge>}</td>
                        <td className="py-1.5 text-navy-400">{new Date(e.ts).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function fmtDur(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}
