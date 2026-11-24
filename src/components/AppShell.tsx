"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ChevronsUpDown,
  Database,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { refreshAll, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Feedback inbox", icon: Inbox },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/behaviour", label: "Behaviour analytics", icon: Activity },
  { href: "/recommendations", label: "Recommendations", icon: Target },
  { href: "/sources", label: "Data sources", icon: Database },
];

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b78f5" />
            <stop offset="1" stopColor="#2a78d6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path d="M8 20h4l3-9 3 12 3-7h3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={clsx("text-lg font-semibold tracking-tight", dark ? "text-white" : "text-navy")}>
        signalsort<span className="text-brand-400">.</span>
      </span>
    </div>
  );
}

function Sidebar({ path, engine, locked, onClose }: { path: string; engine: string; locked?: boolean; onClose?: () => void }) {
  const rules = !engine || engine.startsWith("Built-in");
  return (
    <aside className="flex h-full w-64 flex-col overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] bg-gradient-to-b from-[#161935] to-[#1d1f45] px-4 py-5 text-slate-300">
      <div className="flex items-center justify-between">
        <Logo dark />
        {onClose && (
          <button className="rounded-lg p-1 text-slate-400 hover:bg-white/10" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-white">FoodDash workspace</div>
          <div className="text-[11px] text-slate-400">Demo product</div>
        </div>
        <ChevronsUpDown size={14} className="text-slate-500" />
      </div>

      <div className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Demo</div>
      <a href="/demo-app" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
        <ExternalLink size={17} /> FoodDash app
      </a>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={14} className="text-brand-400" /> Analysis engine
        </div>
        <p className="mt-1 text-xs text-slate-400">{rules ? "Built-in rule engine. Add an OpenAI or Anthropic key for LLM analysis." : engine}</p>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className={clsx("h-1.5 rounded-full bg-gradient-to-r from-brand-400 to-electric-500", rules ? "w-1/2" : "w-full")} />
        </div>
        <Link href="/sources" className="mt-3 inline-block text-xs font-medium text-brand-200 hover:text-white">
          {rules ? "Configure AI provider →" : "Manage data sources →"}
        </Link>
      </div>
      {locked && (
        <form method="POST" action="/api/logout" className="mt-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <LogOut size={17} /> Log out
          </button>
        </form>
      )}
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [engine, setEngine] = useState<string>("");
  const [locked, setLocked] = useState(false);
  const [demo, setDemo] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setEngine(s.engineLabel);
        setLocked(!!s.passwordProtected);
        setDemo(!!s.demoData);
      })
      .catch(() => {});
    const h = () => run();
    const r = () =>
      fetch("/api/settings")
        .then((x) => x.json())
        .then((s) => setDemo(!!s.demoData))
        .catch(() => {});
    window.addEventListener("signalsort:run", h);
    window.addEventListener("signalsort:refresh", r);
    return () => {
      window.removeEventListener("signalsort:run", h);
      window.removeEventListener("signalsort:refresh", r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setOpen(false), [path]);

  async function run() {
    setRunning(true);
    window.dispatchEvent(new CustomEvent("signalsort:running", { detail: true }));
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
      window.dispatchEvent(new CustomEvent("signalsort:running", { detail: false }));
      setTimeout(() => setToast(null), 4000);
    }
  }

  const current = NAV.find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)))?.label ?? "";

  return (
    <div className="flex min-h-screen">
      <div className="hidden shrink-0 bg-[#1d1f45] lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar path={path} engine={engine} locked={locked} />
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 bg-navy/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-64" onClick={(e) => e.stopPropagation()}>
            <Sidebar path={path} engine={engine} locked={locked} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <button className="btn-ghost p-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <span className="text-navy-400">Workspace</span>
            <span className="text-navy-300">/</span>
            <span className="font-medium text-navy">{current}</span>
            {demo && (
              <span
                className="ml-2 inline-flex cursor-help items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-navy-400"
                title="Behaviour analytics on this workspace include simulated events for the FoodDash demo scenario. Feedback items are the scenario’s sample reviews."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-navy-300" /> Demo data
              </span>
            )}
          </div>
          <form
            className="relative ml-auto w-full max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/inbox?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
            <input
              className="w-full rounded-xl border border-transparent bg-surface py-2 pl-9 pr-3 text-sm text-navy placeholder:text-navy-300 focus:border-brand-200 focus:bg-white focus:outline-none"
              placeholder="Search feedback…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search feedback"
            />
          </form>
          <button className={clsx("btn-primary shrink-0", path === "/" && "lg:hidden")} onClick={run} disabled={running}>
            {running ? <Spinner /> : <Sparkles size={16} />}
            <span className="hidden sm:inline">{running ? "Analysing…" : "Run analysis"}</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto flex w-full max-w-7xl justify-between px-6 pb-6 text-[11px] text-navy-300">
          <span>SignalSort · Turn user signals into smarter product decisions</span>
          <span className="hidden sm:inline">{engine}</span>
        </footer>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-navy px-4 py-3 text-sm text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
