// Behavioural analytics: turns raw tracked events into metrics and patterns.
// Everything here is computed from stored events — nothing is estimated or generated.
import type { Area, BehaviourPattern, TrackedEvent } from "../types";

export interface FunnelDef {
  key: string;
  name: string;
  area: Area;
  steps: { event: string; label: string }[];
}

export const DEFAULT_FUNNELS: FunnelDef[] = [
  {
    key: "checkout",
    name: "Checkout",
    area: "checkout_payment",
    steps: [
      { event: "checkout_started", label: "Checkout started" },
      { event: "payment_selection_viewed", label: "Payment selection" },
      { event: "order_completed", label: "Order completed" },
    ],
  },
  {
    key: "signup",
    name: "Sign-up",
    area: "onboarding",
    steps: [
      { event: "signup_started", label: "Sign-up started" },
      { event: "signup_details_submitted", label: "Details submitted" },
      { event: "signup_completed", label: "Sign-up completed" },
    ],
  },
];

export function areaFor(name: string): Area {
  const s = name.toLowerCase();
  if (/payment|checkout|cart|basket|order_completed/.test(s)) return "checkout_payment";
  if (/reorder|order_history|orders|past_order|previous_order/.test(s)) return "order_history";
  if (/track/.test(s)) return "tracking";
  if (/deliver|schedul/.test(s)) return "delivery";
  if (/sign_?up|register|onboard/.test(s)) return "onboarding";
  if (/login|account|profile|password/.test(s)) return "account";
  if (/search/.test(s)) return "search";
  if (/menu|restaurant|dish|catalog/.test(s)) return "menu_catalogue";
  if (/support|help/.test(s)) return "support";
  if (/notif/.test(s)) return "notifications";
  return "general";
}

const human = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export interface FunnelResult {
  key: string;
  name: string;
  area: Area;
  steps: { label: string; event: string; users: number; dropOff: number; dropOffPct: number; conversionPct: number; medianSecondsFromPrev: number | null }[];
  entered: number;
  completed: number;
  conversionPct: number;
}

export interface BehaviourReport {
  totals: {
    events: number;
    users: number;
    sessions: number;
    simulatedEvents: number;
    liveEvents: number;
    signups: number;
    logins: number;
    searches: number;
    failedActions: number;
    medianSessionSeconds: number | null;
  };
  dataOrigin: "simulated" | "live" | "mixed" | "none";
  daily: { date: string; users: number; events: number }[];
  features: { feature: string; users: number; uses: number; adoptionPct: number; isNew: boolean }[];
  pages: { page: string; users: number; views: number }[];
  funnels: FunnelResult[];
  patterns: BehaviourPattern[];
  topEvents: { event: string; count: number }[];
}

type Ev = TrackedEvent & { t: number };

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function originOf(evs: Ev[]): BehaviourPattern["dataOrigin"] {
  const sim = evs.some((e) => e.source === "simulated");
  const live = evs.some((e) => e.source !== "simulated");
  return sim && live ? "mixed" : sim ? "simulated" : "live";
}

export function analyseBehaviour(events: TrackedEvent[], funnels: FunnelDef[] = DEFAULT_FUNNELS): BehaviourReport {
  const evs: Ev[] = events.map((e) => ({ ...e, t: new Date(e.ts).getTime() })).sort((a, b) => a.t - b.t);
  const byUser = new Map<string, Ev[]>();
  const bySession = new Map<string, Ev[]>();
  for (const e of evs) {
    if (!byUser.has(e.userId)) byUser.set(e.userId, []);
    byUser.get(e.userId)!.push(e);
    const sk = `${e.userId}::${e.sessionId ?? "nosession"}`;
    if (!bySession.has(sk)) bySession.set(sk, []);
    bySession.get(sk)!.push(e);
  }
  const users = byUser.size;
  const simulatedEvents = evs.filter((e) => e.source === "simulated").length;

  // Session durations: explicit session_end.duration_seconds wins, otherwise first→last event.
  const durations: number[] = [];
  for (const s of bySession.values()) {
    const end = s.find((e) => e.event === "session_end" && typeof e.properties.duration_seconds === "number");
    if (end) durations.push(end.properties.duration_seconds as number);
    else if (s.length > 1) durations.push((s[s.length - 1].t - s[0].t) / 1000);
  }

  // Daily activity
  const dayMap = new Map<string, { users: Set<string>; events: number }>();
  for (const e of evs) {
    const d = new Date(e.t).toISOString().slice(0, 10);
    if (!dayMap.has(d)) dayMap.set(d, { users: new Set(), events: 0 });
    const x = dayMap.get(d)!;
    x.users.add(e.userId);
    x.events++;
  }
  const daily = [...dayMap.entries()].sort().map(([date, v]) => ({ date, users: v.users.size, events: v.events }));

  // Feature usage
  const featMap = new Map<string, { users: Set<string>; uses: number; isNew: boolean; evs: Ev[] }>();
  for (const e of evs) {
    if (e.event !== "feature_used") continue;
    const f = String(e.properties.feature ?? "unknown");
    if (!featMap.has(f)) featMap.set(f, { users: new Set(), uses: 0, isNew: false, evs: [] });
    const x = featMap.get(f)!;
    x.users.add(e.userId);
    x.uses++;
    x.evs.push(e);
    if (e.properties.is_new === true) x.isNew = true;
  }
  const features = [...featMap.entries()]
    .map(([feature, v]) => ({ feature, users: v.users.size, uses: v.uses, adoptionPct: pct(v.users.size, users), isNew: v.isNew }))
    .sort((a, b) => b.users - a.users);

  // Pages
  const pageMap = new Map<string, { users: Set<string>; views: number }>();
  for (const e of evs) {
    if (e.event !== "page_view") continue;
    const p = String(e.properties.page ?? e.properties.path ?? "unknown");
    if (!pageMap.has(p)) pageMap.set(p, { users: new Set(), views: 0 });
    const x = pageMap.get(p)!;
    x.users.add(e.userId);
    x.views++;
  }
  const pages = [...pageMap.entries()].map(([page, v]) => ({ page, users: v.users.size, views: v.views })).sort((a, b) => b.users - a.users);

  // Funnels
  const funnelResults: FunnelResult[] = [];
  const funnelUsers = new Map<string, { entered: Set<string>; completed: Set<string> }>();
  for (const f of funnels) {
    const reached: Set<string>[] = f.steps.map(() => new Set());
    const gaps: number[][] = f.steps.map(() => []);
    for (const [uid, list] of byUser) {
      let step = 0;
      let prevT = 0;
      for (const e of list) {
        if (step < f.steps.length && e.event === f.steps[step].event) {
          reached[step].add(uid);
          if (step > 0) gaps[step].push((e.t - prevT) / 1000);
          prevT = e.t;
          step++;
        }
      }
    }
    if (reached[0].size === 0) continue;
    const steps = f.steps.map((s, i) => {
      const u = reached[i].size;
      const prev = i === 0 ? u : reached[i - 1].size;
      return {
        label: s.label,
        event: s.event,
        users: u,
        dropOff: prev - u,
        dropOffPct: pct(prev - u, prev),
        conversionPct: pct(u, reached[0].size),
        medianSecondsFromPrev: i === 0 ? null : median(gaps[i]),
      };
    });
    funnelResults.push({
      key: f.key,
      name: f.name,
      area: f.area,
      steps,
      entered: reached[0].size,
      completed: reached[reached.length - 1].size,
      conversionPct: pct(reached[reached.length - 1].size, reached[0].size),
    });
    funnelUsers.set(f.area, { entered: reached[0], completed: reached[reached.length - 1] });
  }

  const patterns: BehaviourPattern[] = [];

  // 1. Funnel drop-off: biggest drop between consecutive steps (>= 20%, >= 10 users at prior step).
  for (const f of funnelResults) {
    f.steps.forEach((s, i) => {
      if (i === 0) return;
      const prev = f.steps[i - 1];
      if (prev.users >= 10 && s.dropOffPct >= 20) {
        const stepEvs = evs.filter((e) => e.event === prev.event || e.event === s.event);
        patterns.push({
          key: `funnel:${f.key}:${i}`,
          area: f.area,
          type: "funnel_dropoff",
          title: `${s.dropOffPct}% of users leave the ${f.name.toLowerCase()} at "${prev.label}"`,
          finding: `${prev.users} users reached "${prev.label}"; ${s.users} reached "${s.label}". ${s.dropOff} users (${s.dropOffPct}%) did not continue.`,
          metric: { label: `Drop-off after ${prev.label}`, value: s.dropOffPct, numerator: s.dropOff, denominator: prev.users },
          usersAffected: s.dropOff,
          severity: s.dropOffPct >= 40 ? 5 : s.dropOffPct >= 30 ? 4 : 3,
          dataOrigin: originOf(stepEvs),
          interpretation: `Users are leaving the ${f.name.toLowerCase()} at the "${prev.label}" stage. The data shows where they leave, not why.`,
        });
      }
      if (s.medianSecondsFromPrev !== null && s.medianSecondsFromPrev > 180 && s.users >= 10) {
        patterns.push({
          key: `slow:${f.key}:${i}`,
          area: f.area,
          type: "slow_step",
          title: `Slow step: "${prev.label}" → "${s.label}"`,
          finding: `Median time from "${prev.label}" to "${s.label}" is ${Math.round(s.medianSecondsFromPrev)}s across ${s.users} users.`,
          metric: { label: "Median seconds", value: Math.round(s.medianSecondsFromPrev), numerator: s.users, denominator: s.users },
          usersAffected: s.users,
          severity: 3,
          dataOrigin: originOf(evs.filter((e) => e.event === s.event)),
          interpretation: "Users spend an unusually long time on this workflow step.",
        });
      }
    });
  }

  // 2. Repeated actions: same event (+target) >= 3 times within one session.
  const repeatUsers = new Map<string, { users: Set<string>; evs: Ev[]; max: number }>();
  for (const s of bySession.values()) {
    const counts = new Map<string, Ev[]>();
    for (const e of s) {
      if (["page_view", "session_start", "session_end", "click", "feature_used", "search"].includes(e.event)) continue;
      const k = e.properties.target ? `${e.event}|${e.properties.target}` : e.event;
      if (!counts.has(k)) counts.set(k, []);
      counts.get(k)!.push(e);
    }
    for (const [k, list] of counts) {
      if (list.length < 3) continue;
      if (!repeatUsers.has(k)) repeatUsers.set(k, { users: new Set(), evs: [], max: 0 });
      const x = repeatUsers.get(k)!;
      x.users.add(list[0].userId);
      x.evs.push(...list);
      x.max = Math.max(x.max, list.length);
    }
  }
  // Merge events repeated by exactly the same users (e.g. *_opened / *_closed toggling).
  const merged = new Map<string, { keys: string[]; users: Set<string>; evs: Ev[]; max: number }>();
  for (const [k, v] of repeatUsers) {
    if (v.users.size < 3) continue;
    const sig = `${areaFor(k)}#${[...v.users].sort().join(",")}`;
    const m = merged.get(sig);
    if (m) {
      m.keys.push(k);
      m.evs.push(...v.evs);
      m.max = Math.max(m.max, v.max);
    } else merged.set(sig, { keys: [k], users: v.users, evs: [...v.evs], max: v.max });
  }
  for (const v of merged.values()) {
    const k = v.keys.join("+");
    const [ev, target] = v.keys[0].split("|");
    const evNames = v.keys.map((x) => x.split("|")[0]);
    const area = areaFor(ev + (target ? `_${target}` : ""));
    const base = byUser.size;
    let compare = "";
    const fu = funnelUsers.get(area);
    if (fu) {
      const repeatEntered = [...v.users].filter((u) => fu.entered.has(u));
      const others = [...fu.entered].filter((u) => !v.users.has(u));
      if (repeatEntered.length >= 3 && others.length >= 3) {
        const rDone = repeatEntered.filter((u) => fu.completed.has(u)).length;
        const oDone = others.filter((u) => fu.completed.has(u)).length;
        compare = ` Of these users, ${repeatEntered.length - rDone} of ${repeatEntered.length} (${pct(repeatEntered.length - rDone, repeatEntered.length)}%) did not complete the funnel, compared with ${others.length - oDone} of ${others.length} (${pct(others.length - oDone, others.length)}%) of other users.`;
      }
    }
    patterns.push({
      key: `repeat:${k}`,
      area,
      type: "repeated_action",
      title: `Repeated ${evNames.map((e) => `"${human(e)}"`).join(" / ")}${target ? ` on ${human(String(target))}` : ""}`,
      finding: `${v.users.size} users triggered ${evNames.map((e) => `"${e}"`).join(" and ")} 3 or more times in a single session (max ${v.max}).${compare}`,
      metric: { label: "Users repeating the action", value: pct(v.users.size, base), numerator: v.users.size, denominator: base },
      usersAffected: v.users.size,
      severity: v.users.size >= 20 ? 4 : 3,
      dataOrigin: originOf(v.evs),
      interpretation: "Repeated open/close or retry loops usually indicate hesitation, confusion or a step that is not responding as expected.",
    });
  }

  // 3. Search after visiting a page: visitors who needed search on that page.
  for (const p of pages) {
    if (p.users < 10) continue;
    const searchers = new Set<string>();
    const sEvs: Ev[] = [];
    for (const e of evs) {
      if (e.event === "search" && String(e.properties.page ?? "") === p.page) {
        searchers.add(e.userId);
        sEvs.push(e);
      }
    }
    const share = pct(searchers.size, p.users);
    if (searchers.size >= 5 && share >= 25) {
      patterns.push({
        key: `search:${p.page}`,
        area: areaFor(p.page),
        type: "search_after_visit",
        title: `${share}% of "${human(p.page)}" visitors had to search`,
        finding: `${p.users} users visited "${human(p.page)}"; ${searchers.size} of them (${share}%) used search on that page.`,
        metric: { label: "Visitors who searched", value: share, numerator: searchers.size, denominator: p.users },
        usersAffected: searchers.size,
        severity: share >= 40 ? 4 : 3,
        dataOrigin: originOf(sEvs),
        interpretation: "A high search rate on a listing page can indicate that users cannot find what they need by browsing. Search can also be a preferred habit, so validate with users.",
      });
    }
  }

  // 4. Low adoption of new (or any) features.
  for (const f of features) {
    if (users >= 20 && f.adoptionPct < 10) {
      patterns.push({
        key: `adoption:${f.feature}`,
        area: areaFor(f.feature),
        type: "low_adoption",
        title: `Low adoption: ${human(f.feature)}${f.isNew ? " (new feature)" : ""}`,
        finding: `${f.users} of ${users} active users (${f.adoptionPct}%) used "${human(f.feature)}".`,
        metric: { label: "Adoption", value: f.adoptionPct, numerator: f.users, denominator: users },
        usersAffected: users - f.users,
        severity: f.isNew ? 3 : 2,
        dataOrigin: originOf(featMap.get(f.feature)!.evs),
        interpretation: f.isNew ? "A newly released feature is reaching few users — check discoverability before judging its value." : "This feature is rarely used.",
      });
    }
  }

  // 5. Dead clicks: clicks on non-interactive elements.
  const dead = new Map<string, { users: Set<string>; n: number; evs: Ev[] }>();
  for (const e of evs) {
    if (e.event !== "click" || e.properties.interactive !== false) continue;
    const t = String(e.properties.target ?? "element");
    if (!dead.has(t)) dead.set(t, { users: new Set(), n: 0, evs: [] });
    const x = dead.get(t)!;
    x.users.add(e.userId);
    x.n++;
    x.evs.push(e);
  }
  for (const [t, v] of dead) {
    if (v.users.size < 2) continue;
    patterns.push({
      key: `dead:${t}`,
      area: areaFor(t),
      type: "dead_click",
      title: `Users click non-interactive "${human(t)}"`,
      finding: `${v.users.size} users clicked "${human(t)}" ${v.n} times, but it is not interactive.`,
      metric: { label: "Users", value: pct(v.users.size, users), numerator: v.users.size, denominator: users },
      usersAffected: v.users.size,
      severity: 2,
      dataOrigin: originOf(v.evs),
      interpretation: "Users expect this element to do something. Make it interactive or restyle it.",
    });
  }

  // 6. Failed actions.
  const failed = new Map<string, { users: Set<string>; n: number; evs: Ev[] }>();
  for (const e of evs) {
    if (e.event !== "action_failed") continue;
    const a = String(e.properties.action ?? "unknown");
    if (!failed.has(a)) failed.set(a, { users: new Set(), n: 0, evs: [] });
    const x = failed.get(a)!;
    x.users.add(e.userId);
    x.n++;
    x.evs.push(e);
  }
  for (const [a, v] of failed) {
    patterns.push({
      key: `failed:${a}`,
      area: areaFor(a),
      type: "failed_action",
      title: `Failed action: ${human(a)}`,
      finding: `"${human(a)}" failed ${v.n} times for ${v.users.size} users.`,
      metric: { label: "Users affected", value: pct(v.users.size, users), numerator: v.users.size, denominator: users },
      usersAffected: v.users.size,
      severity: v.users.size >= 5 ? 4 : 3,
      dataOrigin: originOf(v.evs),
      interpretation: "Users attempted this action and it did not succeed.",
    });
  }

  // 7. Form abandonment.
  const forms = new Map<string, { started: Set<string>; submitted: Set<string>; evs: Ev[] }>();
  for (const e of evs) {
    if (e.event !== "form_started" && e.event !== "form_submitted") continue;
    const f = String(e.properties.form ?? "form");
    if (!forms.has(f)) forms.set(f, { started: new Set(), submitted: new Set(), evs: [] });
    const x = forms.get(f)!;
    (e.event === "form_started" ? x.started : x.submitted).add(e.userId);
    x.evs.push(e);
  }
  for (const [f, v] of forms) {
    const abandoned = [...v.started].filter((u) => !v.submitted.has(u)).length;
    if (v.started.size >= 3 && pct(abandoned, v.started.size) >= 30) {
      patterns.push({
        key: `form:${f}`,
        area: areaFor(f),
        type: "form_abandonment",
        title: `Form abandonment: ${human(f)}`,
        finding: `${abandoned} of ${v.started.size} users (${pct(abandoned, v.started.size)}%) started "${human(f)}" but did not submit it.`,
        metric: { label: "Abandonment", value: pct(abandoned, v.started.size), numerator: abandoned, denominator: v.started.size },
        usersAffected: abandoned,
        severity: 3,
        dataOrigin: originOf(v.evs),
        interpretation: "Users begin this form and leave before submitting.",
      });
    }
  }

  patterns.sort((a, b) => b.severity - a.severity || b.usersAffected - a.usersAffected);

  const counts = new Map<string, number>();
  for (const e of evs) counts.set(e.event, (counts.get(e.event) ?? 0) + 1);

  return {
    totals: {
      events: evs.length,
      users,
      sessions: bySession.size,
      simulatedEvents,
      liveEvents: evs.length - simulatedEvents,
      signups: new Set(evs.filter((e) => e.event === "signup_completed").map((e) => e.userId)).size,
      logins: evs.filter((e) => e.event === "login").length,
      searches: evs.filter((e) => e.event === "search").length,
      failedActions: evs.filter((e) => e.event === "action_failed").length,
      medianSessionSeconds: median(durations),
    },
    dataOrigin: evs.length === 0 ? "none" : simulatedEvents === evs.length ? "simulated" : simulatedEvents === 0 ? "live" : "mixed",
    daily,
    features,
    pages,
    funnels: funnelResults,
    patterns,
    topEvents: [...counts.entries()].map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count).slice(0, 15),
  };
}
