"use client";
// FoodDash — a fictional food-delivery app instrumented with the SignalSort SDK.
// Every interaction here sends REAL events to /api/track (source = "sdk").
import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    SignalSort: any;
  }
}

type View = "home" | "restaurant" | "checkout" | "orders" | "tracking" | "signup" | "done";

const RESTAURANTS = [
  { id: "mama-put", name: "Mama Put Kitchen", eta: "25–35 min", tag: "Nigerian", dishes: [["Jollof rice & chicken", 12], ["Egusi & pounded yam", 14], ["Fried plantain", 4]] },
  { id: "green-bowl", name: "Green Bowl", eta: "20–30 min", tag: "Healthy", dishes: [["Falafel bowl", 11], ["Avocado salad", 9], ["Smoothie", 5]] },
  { id: "slice", name: "Slice Republic", eta: "30–45 min", tag: "Pizza", dishes: [["Margherita", 10], ["Pepperoni", 12], ["Garlic bread", 4]] },
] as const;

const PAST_ORDERS = [
  { id: "FD-1042", date: "12 Nov", place: "Mama Put Kitchen", items: "Jollof rice & chicken", total: 12 },
  { id: "FD-1031", date: "5 Nov", place: "Slice Republic", items: "Pepperoni, Garlic bread", total: 16 },
  { id: "FD-1017", date: "28 Oct", place: "Green Bowl", items: "Falafel bowl", total: 11 },
];

export default function FoodDash() {
  const [ready, setReady] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [rest, setRest] = useState<(typeof RESTAURANTS)[number] | null>(null);
  const [cart, setCart] = useState<{ name: string; price: number }[]>([]);
  const [step, setStep] = useState(1);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [freeze, setFreeze] = useState(false);
  const [paying, setPaying] = useState(false);
  const [q, setQ] = useState("");
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState("");
  useEffect(() => {
    let u = "";
    try {
      u = localStorage.getItem("fooddash_user") ?? "";
      if (!u) {
        u = `fooddash_${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem("fooddash_user", u);
      }
    } catch {
      u = `fooddash_${Math.random().toString(36).slice(2, 7)}`;
    }
    setUserId(u);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setKey(s.writeKey));
  }, []);

  useEffect(() => {
    if (!ready || !key || !userId || !window.SignalSort) return;
    window.SignalSort.init({ writeKey: key, endpoint: `${window.location.origin}/api/track`, debug: true });
    window.SignalSort.identify(userId);
    window.SignalSort.track("login");
    window.SignalSort.page("home");
  }, [ready, key, userId]);

  const ss = (fn: string, ...args: any[]) => {
    if (window.SignalSort && key) {
      window.SignalSort[fn](...args);
      setCount((c) => c + 1);
    }
  };
  const go = (v: View, page?: string) => {
    setView(v);
    ss("page", page ?? v);
  };
  const total = cart.reduce((a, b) => a + b.price, 0);

  function startCheckout() {
    setStep(1);
    setMethod(null);
    go("checkout");
    ss("track", "checkout_started", { cart_value: total, items: cart.length });
  }
  function openPayment() {
    setPayOpen(true);
    ss("track", "payment_page_opened");
  }
  function closePayment() {
    setPayOpen(false);
    ss("track", "payment_page_closed");
  }
  function pay() {
    setPaying(true);
    if (freeze) {
      setTimeout(() => {
        setPaying(false);
        ss("fail", "payment", { reason: "timeout", method });
        alert("Payment timed out (simulated freeze). Try again.");
      }, 2500);
      return;
    }
    setTimeout(() => {
      setPaying(false);
      ss("track", "payment_method_selected", { method });
      ss("track", "order_completed", { order_value: total });
      setCart([]);
      go("done", "order_confirmation");
    }, 700);
  }

  return (
    <div className="min-h-screen bg-[#fff8f3] text-[#2b1a12]">
      <Script src="/sdk/signalsort.js" strategy="afterInteractive" onLoad={() => setReady(true)} onReady={() => setReady(true)} />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        <b>FoodDash is a fictional demo app.</b> It is instrumented with the SignalSort SDK — your clicks are sent as <b>live</b> events as <code>{userId}</code>
        {" · "}
        {count} events sent ·{" "}
        <a href="/behaviour" target="_blank" className="font-semibold underline">
          watch them in SignalSort
        </a>
      </div>
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-[#e8572a] px-4 py-3 text-white">
        <button className="text-lg font-extrabold tracking-tight" onClick={() => go("home")}>
          🍲 FoodDash
        </button>
        <nav className="ml-auto flex gap-1 text-sm">
          <button className="rounded-lg px-3 py-1.5 hover:bg-white/15" onClick={() => go("home")}>
            Home
          </button>
          <button className="rounded-lg px-3 py-1.5 hover:bg-white/15" onClick={() => go("tracking")} data-ss-id="nav_tracking">
            Track
          </button>
          <button className="rounded-lg px-3 py-1.5 hover:bg-white/15" onClick={() => go("signup")}>
            Sign up
          </button>
          <button className="rounded-lg bg-white/15 px-3 py-1.5" onClick={() => cart.length && startCheckout()}>
            🛒 {cart.length}
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {view === "home" && (
          <>
            <div data-ss-id="promo_banner" className="mb-5 cursor-default rounded-2xl bg-gradient-to-r from-[#e8572a] to-[#f59e0b] p-5 text-white">
              <div className="text-lg font-bold">Free delivery this weekend 🎉</div>
              <div className="text-sm opacity-90">This banner is not clickable — clicking it is recorded as a “dead click”.</div>
            </div>
            <h2 className="mb-3 text-lg font-bold">Restaurants near you</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {RESTAURANTS.map((r) => (
                <button
                  key={r.id}
                  data-ss-id={`restaurant_${r.id}`}
                  className="rounded-2xl border border-orange-100 bg-white p-4 text-left shadow-sm hover:shadow"
                  onClick={() => {
                    setRest(r);
                    go("restaurant", "restaurant");
                    ss("feature", "menu_browse", { restaurant: r.id });
                  }}
                >
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-stone-500">
                    {r.tag} · {r.eta}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-6 text-xs text-stone-500">
              Your previous orders are tucked away in the account menu…{" "}
              <button className="underline" onClick={() => go("orders", "order_history")}>
                (Account → Order history)
              </button>
            </p>
          </>
        )}

        {view === "restaurant" && rest && (
          <>
            <button className="mb-3 text-sm text-stone-500" onClick={() => go("home")}>
              ← Back
            </button>
            <h2 className="text-xl font-bold">{rest.name}</h2>
            <p className="mb-4 text-sm text-stone-500">Delivery {rest.eta}</p>
            <ul className="space-y-2">
              {rest.dishes.map(([name, price]) => (
                <li key={name} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                  <span>
                    {name} <span className="text-sm text-stone-500">€{price}</span>
                  </span>
                  <button
                    className="rounded-lg bg-[#e8572a] px-3 py-1 text-sm font-medium text-white"
                    onClick={() => {
                      setCart([...cart, { name, price }]);
                      ss("track", "add_to_cart", { item: name, price });
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
            {cart.length > 0 && (
              <button className="mt-5 w-full rounded-xl bg-[#2b1a12] py-3 font-semibold text-white" onClick={startCheckout}>
                Checkout · €{total}
              </button>
            )}
          </>
        )}

        {view === "checkout" && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex gap-2 text-xs">
              {["Address", "Delivery time", "Payment", "Confirm"].map((s, i) => (
                <span key={s} className={`rounded-full px-2.5 py-1 ${step === i + 1 ? "bg-[#e8572a] text-white" : "bg-orange-50 text-stone-500"}`}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
            {step === 1 && (
              <form
                data-ss-form="delivery_address"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(2);
                }}
                className="space-y-3"
              >
                <input required className="w-full rounded-lg border p-2" placeholder="Street address" />
                <input className="w-full rounded-lg border p-2" placeholder="Apartment, floor (optional)" />
                <button className="rounded-lg bg-[#e8572a] px-4 py-2 font-medium text-white">Continue</button>
              </form>
            )}
            {step === 2 && (
              <div className="space-y-3">
                <p>When should we deliver?</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border px-3 py-2" onClick={() => { setStep(3); ss("track", "payment_selection_viewed"); }}>
                    ASAP
                  </button>
                  <button
                    className="rounded-lg border px-3 py-2"
                    onClick={() => {
                      ss("feature", "scheduled_delivery", { is_new: true });
                      setStep(3);
                      ss("track", "payment_selection_viewed");
                    }}
                  >
                    Schedule for later <span className="ml-1 rounded bg-amber-100 px-1 text-[10px]">NEW</span>
                  </button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <p>Payment method: {method ? <b>{method}</b> : <span className="text-stone-500">none selected</span>}</p>
                <button className="rounded-lg border px-4 py-2" onClick={openPayment}>
                  Choose payment method
                </button>
                <label className="flex items-center gap-2 text-xs text-stone-500">
                  <input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} /> Simulate a payment freeze (sends <code>action_failed</code>)
                </label>
                <div>
                  <button disabled={!method} className="rounded-lg bg-[#e8572a] px-4 py-2 font-medium text-white disabled:opacity-40" onClick={() => setStep(4)}>
                    Continue
                  </button>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-3">
                <p>
                  {cart.length} items · <b>€{total}</b> · paying with {method}
                </p>
                <button disabled={paying} className="rounded-lg bg-[#2b1a12] px-4 py-2 font-medium text-white" onClick={pay}>
                  {paying ? "Processing…" : "Place order"}
                </button>
              </div>
            )}
            <button className="mt-6 text-xs text-stone-500 underline" onClick={() => go("home")}>
              Abandon checkout
            </button>
          </div>
        )}

        {view === "done" && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <div className="text-3xl">✅</div>
            <h2 className="mt-2 text-xl font-bold">Order placed!</h2>
            <button
              className="mt-4 rounded-lg bg-[#e8572a] px-4 py-2 text-white"
              onClick={() => {
                ss("feature", "live_tracking");
                go("tracking");
              }}
            >
              Track my delivery
            </button>
          </div>
        )}

        {view === "tracking" && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Your rider is on the way 🛵</h2>
            <div className="mt-4 h-3 rounded-full bg-orange-100">
              <div className="h-3 w-2/3 rounded-full bg-[#e8572a]" />
            </div>
            <p className="mt-2 text-sm text-stone-500">Arriving in about 12 minutes</p>
          </div>
        )}

        {view === "orders" && (
          <div>
            <h2 className="mb-3 text-xl font-bold">Order history</h2>
            <input
              className="mb-3 w-full rounded-lg border p-2"
              placeholder="Search previous orders…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ss("track", "search", { page: "order_history", query: q })}
            />
            <ul className="space-y-2">
              {PAST_ORDERS.filter((o) => !q || (o.place + o.items).toLowerCase().includes(q.toLowerCase())).map((o) => (
                <li key={o.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex justify-between text-sm">
                    <b>{o.place}</b>
                    <span className="text-stone-500">{o.date}</span>
                  </div>
                  <div className="text-sm text-stone-600">
                    {o.items} · €{o.total}
                  </div>
                  <span data-ss-id="reorder_label" className="mt-1 inline-block text-xs text-stone-400">
                    Reorder (coming soon)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "signup" && <Signup ss={ss} onDone={() => go("home")} />}
      </main>

      {payOpen && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" onClick={closePayment}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Select payment</h3>
            {["Visa •••• 4242", "Wallet balance", "Pay on delivery"].map((m) => (
              <button
                key={m}
                className={`mt-2 w-full rounded-lg border p-3 text-left ${method === m ? "border-[#e8572a] bg-orange-50" : ""}`}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
            <button className="mt-4 w-full rounded-lg bg-[#2b1a12] py-2 text-white" onClick={closePayment}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Signup({ ss, onDone }: { ss: (fn: string, ...a: any[]) => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  useEffect(() => {
    ss("track", "signup_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xl font-bold">Create your FoodDash account</h2>
      {step === 1 ? (
        <form
          data-ss-form="signup"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            ss("track", "signup_details_submitted");
            setStep(2);
          }}
        >
          <input required className="w-full rounded-lg border p-2" placeholder="Name" />
          <input required type="email" className="w-full rounded-lg border p-2" placeholder="Email (any fake address)" />
          <button className="rounded-lg bg-[#e8572a] px-4 py-2 text-white">Continue</button>
        </form>
      ) : (
        <div className="space-y-3">
          <p>Enter the code we “sent” you (any 4 digits).</p>
          <input className="w-32 rounded-lg border p-2" maxLength={4} />
          <div>
            <button
              className="rounded-lg bg-[#e8572a] px-4 py-2 text-white"
              onClick={() => {
                ss("track", "signup_completed");
                onDone();
              }}
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
