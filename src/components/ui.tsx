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
