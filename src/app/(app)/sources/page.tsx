"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardPaste, Code2, Copy, FileUp, PlayCircle, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { Badge, Card, CardHeader, human, Loading, refreshAll, Spinner, useApi } from "@/components/ui";

type Tab = "paste" | "upload" | "sdk" | "demo";

export default function SourcesPage() {
  const { data, loading } = useApi<any>("/api/sources");
  const [tab, setTab] = useState<Tab>("paste");
  useEffect(() => {
    if (window.location.hash === "#sdk") setTab("sdk");
  }, []);
  const [flash, setFlash] = useState<string | null>(null);
  const notify = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 5000);
  };

  async function remove(id: number) {
    if (!confirm("Delete this source and all of its feedback?")) return;
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    refreshAll();
  }
  async function clearEvents(source: string) {
    if (!confirm(`Delete all ${source} events?`)) return;
    await fetch(`/api/sources?events=${source}`, { method: "DELETE" });
    refreshAll();
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "paste", label: "Paste feedback", icon: ClipboardPaste },
    { key: "upload", label: "Upload files", icon: FileUp },
    { key: "sdk", label: "Tracking SDK", icon: Code2 },
    { key: "demo", label: "Demo scenario", icon: PlayCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-page">Data sources</h1>
        <p className="mt-1 text-sm text-navy-400">Bring in reviews, interview transcripts, survey exports, support conversations and in-app behaviour.</p>
      </div>

      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={clsx(
                "flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium",
                tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-navy-400 hover:text-navy",
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "paste" && <PasteForm onDone={notify} />}
          {tab === "upload" && <UploadForm onDone={notify} />}
          {tab === "sdk" && <SdkPanel writeKey={data?.writeKey} streams={data?.eventStreams ?? []} />}
          {tab === "demo" && <DemoPanel onDone={notify} />}
          {flash && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={16} /> {flash}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Connected sources" subtitle="Status of every dataset and event stream" />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-navy-400">
                <tr>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Items</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.eventStreams ?? []).map((s: any) => (
                  <tr key={`ev-${s.source}`}>
                    <td className="py-2.5 font-medium text-navy">{s.source === "simulated" ? "Simulated FoodDash events" : s.source === "sdk" ? "JavaScript SDK" : "Tracking API"}</td>
                    <td className="py-2.5">
                      <Badge tone={s.source === "simulated" ? "amber" : "green"}>{s.source === "simulated" ? "Simulated events" : "Live events"}</Badge>
                    </td>
                    <td className="py-2.5 text-navy-500">
                      {s.events.toLocaleString()} events · {s.users} users
                    </td>
                    <td className="py-2.5">
                      <Badge tone="green">Connected</Badge>
                    </td>
                    <td className="py-2.5 text-navy-400">{s.lastReceived ? `last ${new Date(s.lastReceived).toLocaleString()}` : "—"}</td>
                    <td className="py-2.5 text-right">
                      <button className="btn-ghost p-1.5" onClick={() => clearEvents(s.source)} aria-label="Delete events">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(data?.sources ?? [])
                  .filter((s: any) => s.type !== "sdk")
                  .map((s: any) => (
                    <tr key={s.id}>
                      <td className="py-2.5 font-medium text-navy">{s.name}</td>
                      <td className="py-2.5">
                        <Badge>{human(s.type)}</Badge>
                      </td>
                      <td className="py-2.5 text-navy-500">{s.itemCount} feedback items</td>
                      <td className="py-2.5">
                        <Badge tone={s.status === "ready" ? "green" : s.status === "error" ? "red" : "amber"}>{human(s.status)}</Badge>
                      </td>
                      <td className="py-2.5 text-navy-400">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="py-2.5 text-right">
                        <button className="btn-ghost p-1.5" onClick={() => remove(s.id)} aria-label="Delete source">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                {!data?.sources?.length && !data?.eventStreams?.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-navy-400">
                      No sources yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function PasteForm({ onDone }: { onDone: (m: string) => void }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("paste");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hints: Record<string, string> = {
    paste: "One piece of feedback per line, or separate longer reviews with a blank line.",
    transcript: "Paste an interview with speaker labels (e.g. “Interviewer:” / “Sarah:”). Interviewer turns are ignored; participant turns are analysed.",
    support: "Paste a conversation with “Customer:” / “Agent:” labels. Only customer messages are analysed.",
    survey: "One survey response per line.",
  };
  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, sourceType: type, name: name || undefined }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.error);
    setText("");
    setName("");
    onDone(`${j.created} feedback item${j.created === 1 ? "" : "s"} added and analysed. Run analysis to update insights.`);
    refreshAll();
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div>
        <label className="label" htmlFor="paste">
          Feedback text
        </label>
        <textarea
          id="paste"
          className="input min-h-[180px] font-mono text-[13px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"I love how easy the dashboard is, but I find it difficult to locate my previous transactions.\nThe payment page keeps freezing."}
        />
        <p className="mt-1.5 text-xs text-navy-400">{hints[type]}</p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="ptype">
            Type
          </label>
          <select id="ptype" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="paste">Customer reviews / feedback</option>
            <option value="transcript">Interview transcript</option>
            <option value="support">Support conversation</option>
            <option value="survey">Survey responses</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pname">
            Source name (optional)
          </label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. App Store reviews – Nov" />
        </div>
        <button className="btn-primary w-full" disabled={busy || !text.trim()} onClick={submit}>
          {busy ? <Spinner /> : <ClipboardPaste size={16} />} Analyse feedback
        </button>
      </div>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: (m: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload() {
    setBusy(true);
    const fd = new FormData();
    files.forEach((f) => fd.append("file", f));
    if (type) fd.append("type", type);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setResults([{ file: "Upload", error: j.error }]);
    setResults(j.results);
    setFiles([]);
    const n = j.results.reduce((a: number, x: any) => a + (x.created || 0), 0);
    if (n) onDone(`${n} feedback items extracted and analysed. Run analysis to update insights.`);
    refreshAll();
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          setFiles([...files, ...Array.from(e.dataTransfer.files)]);
        }}
        onClick={() => input.current?.click()}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          drag ? "border-brand-400 bg-brand-50" : "border-line hover:bg-surface",
        )}
      >
        <UploadCloud className="text-brand-500" />
        <div className="mt-2 text-sm font-medium text-navy">Drop files here or click to browse</div>
        <div className="mt-1 text-xs text-navy-400">CSV, Excel (.xlsx), TXT / VTT transcripts and PDF · up to 15 MB each</div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".csv,.tsv,.xlsx,.xls,.txt,.md,.vtt,.pdf"
          className="hidden"
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
        />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
              <span className="text-navy">{f.name}</span>
              <span className="text-xs text-navy-400">{(f.size / 1024).toFixed(1)} KB</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="label" htmlFor="utype">
            Content type
          </label>
          <select id="utype" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Auto-detect from file</option>
            <option value="survey">Survey export (every open-text column)</option>
            <option value="transcript">Interview transcript</option>
            <option value="support">Support conversation</option>
          </select>
        </div>
        <button className="btn-primary" disabled={!files.length || busy} onClick={upload}>
          {busy ? <Spinner /> : <FileUp size={16} />} Upload & analyse
        </button>
        <div className="ml-auto text-xs text-navy-400">
          Try samples:{" "}
          {["app-reviews.csv", "interview-amara.txt", "interview-james.txt", "support-chat.txt", "survey-responses.csv"].map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <a className="text-brand-600 hover:underline" href={`/samples/${s}`} download>
                {s}
              </a>
            </span>
          ))}
        </div>
      </div>
      {results && (
        <ul className="space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.error ? "text-red-700" : "text-emerald-700"}>
              {r.file}: {r.error ?? `${r.created} items extracted (${human(r.type)})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopyBlock({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-navy p-4 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <button
        className="absolute right-2 top-2 rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
        aria-label="Copy"
      >
        {ok ? <CheckCircle2 size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function SdkPanel({ writeKey, streams }: { writeKey?: string; streams: any[] }) {
  const [sent, setSent] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const live = streams.filter((s) => s.source !== "simulated");
  const snippet = `<script src="${origin}/sdk/signalsort.js"></script>
<script>
  SignalSort.init({
    writeKey: "${writeKey ?? "…"}",
    endpoint: "${origin}/api/track"
  });
  SignalSort.identify("user_123");          // after login
  SignalSort.page("checkout");              // page navigation
  SignalSort.track("checkout_started", { cart_value: 24 });
  SignalSort.feature("live_tracking");      // feature usage / adoption
  SignalSort.fail("payment", { reason: "timeout" });  // failed actions
</script>

<!-- Auto-captured: sessions & duration, clicks on [data-ss-id]
     (incl. dead clicks), form_started/form_submitted on <form data-ss-form> -->`;
  const curl = `curl -X POST ${origin}/api/track \\
  -H "content-type: application/json" \\
  -H "x-signalsort-key: ${writeKey ?? "…"}" \\
  -d '{"events":[{"event":"signup_started","userId":"u_42","properties":{"plan":"free"}}]}'`;

  async function testEvent() {
    const r = await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "x-signalsort-key": writeKey ?? "" },
      body: JSON.stringify({ events: [{ event: "sdk_test", userId: "dashboard_tester", properties: { from: "data-sources" } }] }),
    });
    const j = await r.json();
    setSent(r.ok ? `Accepted ${j.accepted} event — it now appears under Behaviour analytics → Latest events.` : j.error);
    refreshAll();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-navy">JavaScript SDK</h3>
          {live.length ? <Badge tone="green">Receiving live events</Badge> : <Badge>Waiting for first event</Badge>}
        </div>
        <p className="text-sm text-navy-500">Add the snippet to your web app. Events are batched and sent to the ingestion API; sessions are tracked automatically.</p>
        <CopyBlock code={snippet} />
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold text-navy">Event tracking API</h3>
        <p className="text-sm text-navy-500">Send events from your backend or mobile app. Up to 500 events per request.</p>
        <CopyBlock code={curl} />
        <div className="rounded-xl border border-line p-4">
          <div className="label">Write key</div>
          <code className="break-all text-sm text-navy">{writeKey ?? "…"}</code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={testEvent}>
              Send test event
            </button>
            <a href="/demo-app" target="_blank" className="btn-primary">
              Open instrumented FoodDash app
            </a>
          </div>
          {sent && <p className="mt-2 text-xs text-navy-500">{sent}</p>}
        </div>
        <div className="rounded-xl bg-surface p-4 text-xs text-navy-500">
          <b className="text-navy">Recognised events</b> power funnels and pattern detection: <code>checkout_started</code>, <code>payment_selection_viewed</code>,{" "}
          <code>order_completed</code>, <code>signup_started</code>, <code>signup_details_submitted</code>, <code>signup_completed</code>, <code>login</code>,{" "}
          <code>page_view</code>, <code>search</code>, <code>feature_used</code>, <code>action_failed</code>, <code>click</code>. Any other event name is stored and counted, and
          repeated within a session it is flagged as a repeated action.
        </div>
      </div>
    </div>
  );
}

function DemoPanel({ onDone }: { onDone: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function load() {
    setBusy("load");
    const r = await fetch("/api/demo", { method: "POST" });
    const j = await r.json();
    setBusy(null);
    onDone(`Demo loaded: ${j.feedback} feedback items, ${j.events} simulated events, ${j.insights} insights.`);
    refreshAll();
  }
  async function reset() {
    if (!confirm("Remove ALL feedback, events, insights and recommendations?")) return;
    setBusy("reset");
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(null);
    onDone("Workspace cleared.");
    refreshAll();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="font-semibold text-navy">FoodDash scenario</h3>
        <p className="mt-1 text-sm text-navy-500">A fictional food-delivery app. Loads six pieces of feedback and a simulated event stream, then runs the full analysis.</p>
        <ul className="mt-3 space-y-1 text-sm text-navy">
          {[
            "The app is easy to use, but delivery takes too long.",
            "I cannot find my previous orders.",
            "The payment page keeps freezing.",
            "I love how easy it is to track my delivery.",
            "I abandoned my order because there were too many steps.",
            "I wish I could reorder my previous meals.",
          ].map((t) => (
            <li key={t} className="border-l-2 border-brand-200 pl-3 italic">
              “{t}”
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Simulated behaviour</b> (always labelled in the UI): 100 users initiate checkout · 42 abandon at payment selection · 58 complete · 65 visit order history · 30 search for previous
          orders · 25 repeatedly open and close the payment page.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={load} disabled={!!busy}>
            {busy === "load" ? <Spinner /> : <PlayCircle size={16} />} Load demo & analyse
          </button>
          <button className="btn-secondary" onClick={reset} disabled={!!busy}>
            {busy === "reset" ? <Spinner /> : <RotateCcw size={16} />} Reset workspace
          </button>
        </div>
      </div>
    </div>
  );
}
