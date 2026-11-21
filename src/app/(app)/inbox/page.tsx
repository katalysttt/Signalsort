"use client";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { Badge, Card, Empty, human, Loading, PriorityBadge, refreshAll, SENTIMENT_COLORS, SentimentBadge, useApi } from "@/components/ui";
import { CATEGORIES, type FeedbackItem } from "@/lib/types";

const SOURCES = ["paste", "transcript", "csv", "excel", "survey", "support", "pdf", "text", "demo"];

export default function Inbox() {
  const [f, setF] = useState({ q: "", sentiment: "", category: "", source: "", priority: "", from: "", to: "" });
  const [debounced, setDebounced] = useState(f);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(f), 250);
    return () => clearTimeout(t);
  }, [f]);
  const qs = useMemo(() => new URLSearchParams(Object.entries(debounced).filter(([, v]) => v) as [string, string][]).toString(), [debounced]);
  const { data, loading } = useApi<{ items: FeedbackItem[] }>(`/api/feedback?${qs}`);
  const [selected, setSelected] = useState<number | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const active = Object.values(f).some(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-page">Feedback inbox</h1>
        <p className="mt-1 text-sm text-navy-400">Every piece of submitted feedback with its AI analysis. Click an entry to see the original text and extracted signals.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <div className="relative md:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
            <input className="input pl-9" placeholder="Search feedback…" value={f.q} onChange={set("q")} aria-label="Search feedback" />
          </div>
          <select className="input" value={f.sentiment} onChange={set("sentiment")} aria-label="Sentiment">
            <option value="">All sentiment</option>
            {["positive", "negative", "neutral", "mixed"].map((s) => (
              <option key={s} value={s}>{human(s)}</option>
            ))}
          </select>
          <select className="input" value={f.category} onChange={set("category")} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input" value={f.source} onChange={set("source")} aria-label="Source">
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{human(s)}</option>
            ))}
          </select>
          <select className="input" value={f.priority} onChange={set("priority")} aria-label="Priority">
            <option value="">All priorities</option>
            {["P0", "P1", "P2", "P3"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input type="date" className="input" value={f.from} onChange={set("from")} aria-label="From date" />
          <input type="date" className="input" value={f.to} onChange={set("to")} aria-label="To date" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["positive", "negative", "neutral", "mixed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setF({ ...f, sentiment: f.sentiment === s ? "" : s })}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                f.sentiment === s ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-navy-500 hover:bg-surface",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_COLORS[s] }} /> {human(s)}
            </button>
          ))}
          {active && (
            <button className="ml-auto text-xs font-medium text-brand-600 hover:underline" onClick={() => setF({ q: "", sentiment: "", category: "", source: "", priority: "", from: "", to: "" })}>
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title={active ? "No feedback matches these filters" : "Your inbox is empty"} body={active ? "Try removing a filter." : "Add feedback from the Data sources page or load the demo scenario from the Overview."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-3 text-xs text-navy-400">{data.items.length} item{data.items.length === 1 ? "" : "s"}</div>
          <ul className="divide-y divide-line">
            {data.items.map((it) => (
              <li key={it.id}>
                <button onClick={() => setSelected(it.id)} className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-surface/70 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-navy">{it.text}</p>
                    {it.analysis && <p className="mt-1 line-clamp-1 text-xs text-navy-400">AI summary: {it.analysis.summary}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.analysis?.signals.slice(0, 4).map((s, i) => (
                        <Badge key={i} tone={s.polarity === "positive" ? "green" : s.polarity === "negative" ? "red" : "gray"}>
                          {s.polarity === "positive" ? "+" : s.polarity === "negative" ? "−" : "•"} {s.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-64 sm:justify-end">
                    <SentimentBadge s={it.sentiment} />
                    {it.category && <Badge>{it.category}</Badge>}
                    <PriorityBadge p={it.priority} />
                    <span className="w-full text-right text-[11px] text-navy-300">
                      {human(it.sourceType)} · {new Date(it.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {selected !== null && <Detail id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useApi<{ item: FeedbackItem; insights: { key: string; title: string; kind: string; priority: string }[] }>(`/api/feedback/${id}`);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const it = data?.item;
  const a = it?.analysis;

  async function remove() {
    if (!confirm("Delete this feedback item?")) return;
    await fetch(`/api/feedback/${id}`, { method: "DELETE" });
    onClose();
    refreshAll();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/30" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Feedback detail">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-3">
          <div className="text-sm font-semibold text-navy">Feedback #{id}</div>
          <div className="flex gap-1">
            <button className="btn-ghost p-1.5" onClick={remove} aria-label="Delete">
              <Trash2 size={16} />
            </button>
            <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        {!it ? (
          <Loading />
        ) : (
          <div className="space-y-5 p-5">
            <section>
              <div className="label">Original text</div>
              <blockquote className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-navy">{it.text}</blockquote>
              <div className="mt-2 text-xs text-navy-400">
                {it.author && <>From {it.author} · </>}
                {it.sourceName ?? human(it.sourceType)} · {new Date(it.createdAt).toLocaleString()}
              </div>
            </section>
            {!a ? (
              <p className="text-sm text-navy-400">Not analysed yet.</p>
            ) : (
              <>
                <section className="flex flex-wrap gap-2">
                  <SentimentBadge s={a.sentiment} />
                  <Badge>{a.primaryCategory}</Badge>
                  <PriorityBadge p={it.priority} />
                  <Badge tone="brand">Engine: {a.engine === "rules" ? "rule-based" : a.engine}</Badge>
                </section>
                <section>
                  <div className="label">AI summary</div>
                  <p className="text-sm text-navy">{a.summary}</p>
                  <p className="mt-1 text-sm text-navy-500">
                    <b>Main issue / observation:</b> {a.mainIssue}
                  </p>
                </section>
                <section>
                  <div className="label">Extracted signals</div>
                  <div className="space-y-2">
                    {a.signals.map((s, i) => (
                      <div key={i} className="rounded-xl border border-line p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_COLORS[s.polarity] }} />
                          <span className="text-sm font-medium text-navy">{s.label}</span>
                          <Badge>{human(s.kind)}</Badge>
                        </div>
                        <p className="mt-1.5 text-sm italic text-navy-500">“{s.quote}”</p>
                        <div className="mt-1.5 text-xs text-navy-400">
                          Feature: {s.feature} · Category: {s.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ListBlock title="Feature requests" items={a.featureRequests} />
                  <ListBlock title="Usability problems" items={a.usabilityProblems} />
                  <ListBlock title="Unmet needs & expectations" items={a.unmetNeeds} />
                  <ListBlock title="Possible solutions" items={a.suggestedSolutions} />
                </div>
                {data!.insights.length > 0 && (
                  <section>
                    <div className="label">Contributes to insights</div>
                    <ul className="space-y-1.5">
                      {data!.insights.map((i) => (
                        <li key={i.key}>
                          <a href={`/insights#${encodeURIComponent(i.key)}`} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-navy hover:bg-surface">
                            {i.title}
                            {i.kind !== "praise" ? <PriorityBadge p={i.priority} /> : <Badge tone="green">Strength</Badge>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <div className="label">{title}</div>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-4 text-sm text-navy">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-navy-300">None detected</p>
      )}
    </section>
  );
}
