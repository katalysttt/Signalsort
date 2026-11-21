"use client";
import clsx from "clsx";
import { useState } from "react";
import { Check, ChevronDown, CircleDashed, FlaskConical, Gauge, Hammer, Rocket, X } from "lucide-react";
import { Badge, Card, Empty, human, Loading, PriorityBadge, refreshAll, useApi, PageHeader } from "@/components/ui";
import { AREA_LABELS, type Recommendation, type RecommendationStatus } from "@/lib/types";

const STATUS: { key: RecommendationStatus; label: string; tone: string }[] = [
  { key: "proposed", label: "Proposed", tone: "gray" },
  { key: "accepted", label: "Accepted", tone: "brand" },
  { key: "in_progress", label: "In progress", tone: "blue" },
  { key: "implemented", label: "Implemented", tone: "green" },
  { key: "rejected", label: "Rejected", tone: "red" },
];

export default function RecommendationsPage() {
  const { data, loading } = useApi<{ items: Recommendation[] }>("/api/recommendations");
  const [filter, setFilter] = useState<string>("all");
  if (loading && !data) return <Loading />;
  const items = data?.items ?? [];
  if (!items.length) return <Empty title="No recommendations yet" body="Run analysis to generate ranked, evidence-based recommendations." />;
  const counts = Object.fromEntries(STATUS.map((s) => [s.key, items.filter((i) => i.status === s.key).length]));
  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommendations"
        subtitle="Ranked by a transparent score: 30% frequency, 30% severity, 20% user impact (feedback + behaviour reach), 20% business impact."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button onClick={() => setFilter("all")} className={clsx("card p-3 text-left", filter === "all" && "ring-2 ring-brand-400")}>
          <div className="text-xs text-navy-400">All</div>
          <div className="text-xl font-semibold text-navy">{items.length}</div>
        </button>
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)} className={clsx("card p-3 text-left", filter === s.key && "ring-2 ring-brand-400")}>
            <div className="text-xs text-navy-400">{s.label}</div>
            <div className="text-xl font-semibold text-navy">{counts[s.key]}</div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((r, i) => (
          <RecCard key={r.key} r={r} rank={items.indexOf(r) + 1} defaultOpen={i === 0 && filter === "all"} />
        ))}
        {!shown.length && <Empty title="Nothing in this status" />}
      </div>
    </div>
  );
}

function RecCard({ r, rank, defaultOpen }: { r: Recommendation; rank: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [busy, setBusy] = useState(false);
  const st = STATUS.find((s) => s.key === r.status) ?? STATUS[0];

  async function setStatus(status: RecommendationStatus) {
    let note: string | null = null;
    if (status === "rejected") note = prompt("Why are you rejecting this recommendation? (optional)") ?? null;
    if (status === "implemented") note = prompt("Implementation notes, e.g. release or ticket (optional)") ?? null;
    setBusy(true);
    await fetch("/api/recommendations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: r.key, status, note }) });
    setBusy(false);
    refreshAll();
  }

  return (
    <Card className={clsx("overflow-hidden", r.status === "rejected" && "opacity-70")}>
      <div id={r.key} className="scroll-mt-24" />
      <button className="flex w-full items-start gap-4 p-5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">#{rank}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge p={r.priority} />
            <Badge tone={st.tone}>{st.label}</Badge>
            <Badge>{AREA_LABELS[r.area]}</Badge>
            {r.insightKey && r.patternKeys.length > 0 && <Badge tone="blue">Feedback + behaviour</Badge>}
            {!r.insightKey && <Badge tone="amber">Behaviour only</Badge>}
          </div>
          <h3 className="mt-2 text-base font-semibold text-navy">{r.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-navy-500">{r.whatToChange}</p>
          {r.statusNote && <p className="mt-1 text-xs text-navy-400">Note: {r.statusNote}</p>}
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="text-2xl font-semibold text-navy">{r.score}</div>
          <div className="text-[11px] text-navy-400">priority score</div>
        </div>
        <ChevronDown size={18} className={clsx("mt-1 shrink-0 text-navy-300 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-line">
          <div className="grid gap-px bg-line md:grid-cols-2">
            <QA n={1} q="What is wrong?" a={r.whatIsWrong} />
            <QA n={2} q="Why is it happening?" a={r.whyItHappens} />
            <QA n={3} q="Which users are affected?" a={r.whoIsAffected} />
            <QA n={4} q="What should the team change?" a={r.whatToChange} />
            <QA n={5} q="How will this improve the experience?" a={r.expectedImprovement} />
            <QA n={6} q="How do we know it worked?" a={r.howToMeasure} />
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-3">
            <div>
              <div className="label flex items-center gap-1.5">
                <Hammer size={12} /> Suggested improvements
              </div>
              <ul className="space-y-1.5">
                {r.improvements.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm text-navy">
                    <Badge className="shrink-0">{x.type === "ux" ? "UX/UI" : human(x.type)}</Badge>
                    {x.text}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label flex items-center gap-1.5">
                <FlaskConical size={12} /> Experiments & A/B tests
              </div>
              <ul className="list-disc space-y-1 pl-4 text-sm text-navy">
                {r.experiments.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              <div className="label mt-4 flex items-center gap-1.5">
                <Gauge size={12} /> Success metrics
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.metrics.map((m, i) => (
                  <Badge key={i} tone="blue">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Score breakdown</div>
              {(["frequency", "severity", "userImpact", "businessImpact"] as const).map((k) => (
                <div key={k} className="mb-2">
                  <div className="flex justify-between text-xs text-navy-500">
                    <span>{k === "userImpact" ? "User impact" : k === "businessImpact" ? "Business impact" : human(k)}</span>
                    <span className="font-medium text-navy">{r.scores[k]}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface">
                    <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${r.scores[k]}%` }} />
                  </div>
                </div>
              ))}
              <div className="label mt-4">Why this was recommended</div>
              <p className="text-xs leading-relaxed text-navy-500">{r.rationale}</p>
              {r.evidenceFeedbackIds.length > 0 && (
                <p className="mt-2 text-xs text-navy-400">
                  Evidence: feedback {r.evidenceFeedbackIds.map((id) => `#${id}`).join(", ")} · engine {r.engine === "rules" ? "rule-based playbook" : r.engine}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface/60 px-5 py-3">
            <span className="mr-1 text-xs font-medium text-navy-400">Decision:</span>
            <button disabled={busy} className="btn-primary py-1.5" onClick={() => setStatus("accepted")}>
              <Check size={14} /> Accept
            </button>
            <button disabled={busy} className="btn-secondary py-1.5" onClick={() => setStatus("in_progress")}>
              <CircleDashed size={14} /> In progress
            </button>
            <button disabled={busy} className="btn-secondary py-1.5" onClick={() => setStatus("implemented")}>
              <Rocket size={14} /> Implemented
            </button>
            <button disabled={busy} className="btn-secondary py-1.5 text-red-700" onClick={() => setStatus("rejected")}>
              <X size={14} /> Reject
            </button>
            {r.status !== "proposed" && (
              <button disabled={busy} className="btn-ghost py-1.5 text-xs" onClick={() => setStatus("proposed")}>
                Reset
              </button>
            )}
            {r.updatedAt && r.status !== "proposed" && <span className="ml-auto text-xs text-navy-400">Updated {new Date(r.updatedAt).toLocaleString()}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function QA({ n, q, a }: { n: number; q: string; a: string }) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px]">{n}</span>
        {q}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-navy">{a}</p>
    </div>
  );
}
