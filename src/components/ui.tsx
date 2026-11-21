"use client";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import type { Priority, Sentiment } from "@/lib/types";

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#178f57",
  negative: "#d03b3b",
  neutral: "#8d8c86",
  mixed: "#7c5ce6",
};

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-navy-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: string; className?: string }) {
  const tones: Record<string, string> = {
    gray: "bg-slate-100 text-navy-500",
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-electric-100 text-electric-500",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function SentimentBadge({ s }: { s: Sentiment | string | null }) {
  if (!s) return <Badge>Pending</Badge>;
  const tone = { positive: "green", negative: "red", neutral: "gray", mixed: "violet" }[s] ?? "gray";
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: SENTIMENT_COLORS[s] }} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </Badge>
  );
}

export function PriorityBadge({ p }: { p: Priority | string | null | undefined }) {
  if (!p) return null;
  const tone = { P0: "red", P1: "amber", P2: "blue", P3: "gray" }[p] ?? "gray";
  const label = { P0: "P0 · Critical", P1: "P1 · High", P2: "P2 · Medium", P3: "P3 · Low" }[p] ?? p;
  return <Badge tone={tone}>{label}</Badge>;
}

export function OriginBadge({ origin }: { origin: string }) {
  if (origin === "live") return <Badge tone="green">Live events</Badge>;
  if (origin === "mixed") return <Badge tone="amber">Live + simulated</Badge>;
  if (origin === "simulated") return <Badge tone="amber">Simulated demo data</Badge>;
  return null;
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-navy-400">
        {accent && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-navy">{value}</div>
      {hint && <div className="mt-1 text-xs text-navy-400">{hint}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l3-8 4 16 3-8h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h3 className="font-semibold text-navy">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-navy-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function Loading() {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-navy-400 justify-center">
      <Spinner /> Loading…
    </div>
  );
}

/** Minimal data hook that refetches when the global "signalsort:refresh" event fires. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setData(j);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("signalsort:refresh", h);
    return () => window.removeEventListener("signalsort:refresh", h);
  }, [load]);
  return { data, error, loading, reload: load };
}

export function refreshAll() {
  window.dispatchEvent(new Event("signalsort:refresh"));
}

export function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export function human(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TONES = {
  violet: { bg: "bg-[#f3f0ff]", border: "border-[#e2dafe]", text: "text-[#5b45e0]", stroke: "#6d55ee" },
  mint: { bg: "bg-[#eaf8f1]", border: "border-[#cdeedd]", text: "text-[#178f57]", stroke: "#1a9e63" },
  peach: { bg: "bg-[#fff3e8]", border: "border-[#fde0c6]", text: "text-[#c2620e]", stroke: "#e07b1f" },
  sky: { bg: "bg-[#ebf3fe]", border: "border-[#d3e4fb]", text: "text-[#2a78d6]", stroke: "#2a78d6" },
  rose: { bg: "bg-[#fdeeee]", border: "border-[#f8d5d5]", text: "text-[#c23535]", stroke: "#d03b3b" },
} as const;
export type Tone = keyof typeof TONES;

/** Gradient page header with optional tabs and actions (title, subtitle, right side). */
export function PageHeader({
  title,
  subtitle,
  tabs,
  actions,
  meta,
}: {
  title: string;
  subtitle?: React.ReactNode;
  tabs?: { label: string; href: string; active?: boolean }[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#ece6fb] bg-gradient-to-r from-[#efe9ff] via-[#f7f1fb] to-[#fdeee6] px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-navy">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-navy-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {(tabs || meta) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {tabs?.map((t) => (
            <a
              key={t.label}
              href={t.href}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                t.active ? "bg-white text-navy shadow-sm" : "text-navy-500 hover:bg-white/60",
              )}
            >
              {t.label}
            </a>
          ))}
          {meta && <span className="ml-1 flex items-center gap-1.5 text-xs text-navy-400">{meta}</span>}
        </div>
      )}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-navy shadow-sm">{children}</span>;
}

/** Tinted KPI card. `chart` is an optional sparkline/mini visual rendered to the right. */
export function KpiCard({
  label,
  value,
  tone = "violet",
  hint,
  chart,
  href,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
  chart?: React.ReactNode;
  href?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={clsx("relative rounded-2xl border p-4", t.bg, t.border)}>
      <div className="flex items-center justify-between">
        <span className={clsx("text-xs font-semibold", t.text)}>{label}</span>
        {href && (
          <a href={href} className={clsx("text-xs", t.text)} aria-label={`Open ${label}`}>
            ↗
          </a>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[28px] font-semibold leading-none tracking-tight text-navy">{value}</div>
        {chart && <div className="h-10 w-24 shrink-0">{chart}</div>}
      </div>
      {hint && <div className="mt-2 text-xs text-navy-500">{hint}</div>}
    </div>
  );
}

/** Segmented control (Daily / Weekly style). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded-md px-2.5 py-1 text-xs font-medium", value === o.value ? "bg-brand-600 text-white shadow-sm" : "text-navy-500 hover:text-navy")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Acquisition-channel style list: label, value, share, coloured progress bar. */
export function ProgressList({ rows }: { rows: { label: string; value: number; color: string; href?: string }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="truncate text-navy">{r.label}</span>
            <span className="ml-3 shrink-0">
              <span className="font-semibold text-navy">{r.value.toLocaleString()}</span>
              <span className="ml-2 inline-block w-9 text-right text-xs text-navy-400">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface">
            <div className="h-1.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
