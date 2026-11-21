"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Badge, refreshAll, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Feedback inbox", icon: Inbox },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/behaviour", label: "Behaviour analytics", icon: Activity },
  { href: "/recommendations", label: "Recommendations", icon: Target },
  { href: "/sources", label: "Data sources", icon: Database },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6d55ee" />
            <stop offset="1" stopColor="#2a78d6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path d="M8 20h4l3-9 3 12 3-7h3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-navy">SignalSort</div>
        <div className="text-[11px] text-navy-400">Product intelligence</div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [engine, setEngine] = useState<string>("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setEngine(s.engineLabel))
      .catch(() => {});
  }, []);
  useEffect(() => setOpen(false), [path]);

  async function run() {
    setRunning(true);
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setToast(`Analysis complete · ${j.insights} insights generated`);
      refreshAll();
    } catch (e: any) {
      setToast(e.message);
    } finally {
      setRunning(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-navy-500 hover:bg-surface hover:text-navy",
            )}
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
      <div className="mt-6 rounded-xl border border-line bg-surface p-3">
        <div className="text-xs font-semibold text-navy">Demo product</div>
        <p className="mt-1 text-xs text-navy-400">FoodDash, a fictional food-delivery app instrumented with the SignalSort SDK.</p>
        <a href="/demo-app" target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
          Open FoodDash <ExternalLink size={12} />
        </a>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-line bg-white px-4 py-5 lg:flex">
        <Logo />
        {nav}
        <div className="text-[11px] text-navy-300">Turn user signals into smarter product decisions.</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 bg-navy/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-64 flex-col gap-6 bg-white px-4 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Logo />
              <button className="btn-ghost p-1" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button className="btn-ghost p-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {engine && (
              <Badge tone={engine.startsWith("Built-in") ? "gray" : "brand"} className="hidden sm:inline-flex">
                <Sparkles size={12} /> {engine}
              </Badge>
            )}
            <button className="btn-primary" onClick={run} disabled={running}>
              {running ? <Spinner /> : <Sparkles size={16} />}
              {running ? "Analysing…" : "Run analysis"}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-navy px-4 py-3 text-sm text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
