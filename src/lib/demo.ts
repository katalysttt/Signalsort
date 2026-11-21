// Hackathon demonstration scenario: "FoodDash", a fictional food-delivery app.
// The behavioural events generated here are SIMULATED and stored with
// source = 'simulated' so the UI can always label them as such.
import type { TrackedEvent } from "./types";

export const DEMO_PRODUCT = "FoodDash (fictional food-delivery app)";

export const DEMO_FEEDBACK: { text: string; author: string; channel: string }[] = [
  { text: "The app is easy to use, but delivery takes too long.", author: "App Store review #1", channel: "App Store" },
  { text: "I cannot find my previous orders.", author: "Support ticket #2", channel: "Support" },
  { text: "The payment page keeps freezing.", author: "App Store review #3", channel: "App Store" },
  { text: "I love how easy it is to track my delivery.", author: "Survey response #4", channel: "In-app survey" },
  { text: "I abandoned my order because there were too many steps.", author: "Survey response #5", channel: "In-app survey" },
  { text: "I wish I could reorder my previous meals.", author: "Play Store review #6", channel: "Play Store" },
];

export const DEMO_EVENT_SPEC = [
  "100 users initiated checkout",
  "42 abandoned at payment selection",
  "58 completed checkout",
  "65 users visited order history",
  "30 users searched for previous orders",
  "25 users repeatedly opened and closed the payment page",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the demo event stream. Counts match the scenario brief exactly.
 * Assumptions we had to make (the brief does not specify them) are documented here
 * and in the README: 20 of the 25 payment-page togglers are among the 42 abandoners;
 * all 30 order-history searchers are among the 65 visitors; 47 completers used live
 * tracking; 3 users tried the newly released "scheduled delivery" feature.
 */
export function buildDemoEvents(now = Date.now()): TrackedEvent[] {
  const rand = mulberry32(42);
  const out: TrackedEvent[] = [];
  const day = 86_400_000;
  const users = Array.from({ length: 100 }, (_, i) => `demo_user_${String(i + 1).padStart(3, "0")}`);
  const abandoners = new Set(users.slice(0, 42));
  const completers = users.slice(42); // 58
  const togglers = new Set([...users.slice(0, 20), ...completers.slice(0, 5)]); // 25
  const historyVisitors = users.filter((_, i) => i % 20 < 13); // 65
  const historySearchers = new Set(historyVisitors.filter((_, i) => i % 13 < 6)); // 30
  const trackingUsers = new Set(completers.slice(0, 47));
  const scheduledUsers = new Set(completers.slice(50, 53));

  const push = (event: string, userId: string, sessionId: string, t: number, properties: Record<string, unknown> = {}) =>
    out.push({ event, userId, sessionId, properties, ts: new Date(t).toISOString(), source: "simulated" });

  users.forEach((u, i) => {
    // Session 1: browse → checkout
    let t = now - Math.floor(rand() * 6 * day) - day;
    const s1 = `${u}_s1`;
    const start = t;
    push("session_start", u, s1, t);
    push("login", u, s1, (t += 2000));
    push("page_view", u, s1, (t += 3000), { page: "home" });
    push("page_view", u, s1, (t += 15000 + rand() * 30000), { page: "restaurant" });
    push("feature_used", u, s1, (t += 5000), { feature: "menu_browse" });
    push("add_to_cart", u, s1, (t += 20000 + rand() * 40000), { item: "meal" });
    push("checkout_started", u, s1, (t += 5000), { cart_value: 18 + Math.round(rand() * 30) });
    push("page_view", u, s1, (t += 2000), { page: "checkout" });
    push("payment_selection_viewed", u, s1, (t += 15000 + rand() * 20000));
    const toggles = togglers.has(u) ? 3 + Math.floor(rand() * 3) : 1;
    for (let k = 0; k < toggles; k++) {
      push("payment_page_opened", u, s1, (t += 4000 + rand() * 6000));
      push("payment_page_closed", u, s1, (t += 3000 + rand() * 8000));
    }
    if (!abandoners.has(u)) {
      push("payment_method_selected", u, s1, (t += 4000), { method: rand() > 0.5 ? "card" : "wallet" });
      push("order_completed", u, s1, (t += 3000), { order_value: 18 + Math.round(rand() * 30) });
      if (trackingUsers.has(u)) push("feature_used", u, s1, (t += 60000), { feature: "live_tracking" });
      if (scheduledUsers.has(u)) push("feature_used", u, s1, (t += 2000), { feature: "scheduled_delivery", is_new: true });
    }
    push("session_end", u, s1, (t += 1000), { duration_seconds: Math.round((t - start) / 1000) });

    // Session 2: order history visit (for 65 users)
    if (historyVisitors.includes(u)) {
      let t2 = now - Math.floor(rand() * day * 0.9);
      const s2 = `${u}_s2`;
      const st2 = t2;
      push("session_start", u, s2, t2);
      push("page_view", u, s2, (t2 += 2000), { page: "home" });
      push("page_view", u, s2, (t2 += 8000 + rand() * 10000), { page: "order_history" });
      if (historySearchers.has(u)) {
        push("search", u, s2, (t2 += 10000 + rand() * 20000), { page: "order_history", query: "previous order" });
      }
      push("session_end", u, s2, (t2 += 15000), { duration_seconds: Math.round((t2 - st2) / 1000) });
    }
    void i;
  });
  return out;
}
