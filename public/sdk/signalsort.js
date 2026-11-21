/*!
 * SignalSort JavaScript SDK v0.1 — lightweight behaviour tracking (~3 KB).
 *
 *   <script src="https://YOUR-SIGNALSORT-HOST/sdk/signalsort.js"></script>
 *   <script>
 *     SignalSort.init({ writeKey: "ss_live_…", endpoint: "https://YOUR-SIGNALSORT-HOST/api/track" });
 *     SignalSort.identify("user_123");
 *     SignalSort.track("checkout_started", { cart_value: 24 });
 *   </script>
 *
 * Auto-captured: session_start / session_end (with duration), page_view, clicks on
 * elements with [data-ss-id] (flagged interactive / non-interactive for dead-click
 * detection), form_started / form_submitted for <form data-ss-form="name">.
 */
(function (w, d) {
  "use strict";
  var cfg = { endpoint: "/api/track", writeKey: "", flushInterval: 2000, batchSize: 20, autocapture: true, debug: false };
  var queue = [];
  var userId = null;
  var timer = null;
  var sessionStartedAt = null;
  var started = {};

  function uid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function store(kind) {
    try { return kind === "local" ? w.localStorage : w.sessionStorage; } catch (e) { return null; }
  }
  function get(kind, k) { var s = store(kind); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(kind, k, v) { var s = store(kind); try { if (s) s.setItem(k, v); } catch (e) {} }

  function anonymousId() {
    var a = get("local", "ss_anon");
    if (!a) { a = "anon_" + uid(); set("local", "ss_anon", a); }
    return a;
  }
  function sessionId() {
    var now = Date.now();
    var sid = get("session", "ss_sid");
    var last = Number(get("session", "ss_last") || 0);
    if (!sid || now - last > 30 * 60 * 1000) {
      sid = "s_" + uid();
      set("session", "ss_sid", sid);
      set("session", "ss_start", String(now));
      sessionStartedAt = now;
      enqueue("session_start", { referrer: d.referrer || null }, sid);
    }
    set("session", "ss_last", String(now));
    sessionStartedAt = Number(get("session", "ss_start") || now);
    return sid;
  }

  function enqueue(event, properties, sid) {
    var e = {
      event: event,
      userId: userId || get("local", "ss_uid") || anonymousId(),
      sessionId: sid || sessionId(),
      properties: properties || {},
      timestamp: new Date().toISOString()
    };
    queue.push(e);
    if (cfg.debug && w.console) console.log("[SignalSort]", event, properties || {});
    if (queue.length >= cfg.batchSize) flush();
    else if (!timer) timer = setTimeout(flush, cfg.flushInterval);
  }

  function flush(useBeacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    var body = JSON.stringify({ writeKey: cfg.writeKey, sdk: "js-0.1", events: batch });
    if (useBeacon && w.navigator && w.navigator.sendBeacon) {
      w.navigator.sendBeacon(cfg.endpoint, body);
      return;
    }
    try {
      w.fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json", "x-signalsort-key": cfg.writeKey }, body: body, keepalive: true })
        .then(function (r) { if (!r.ok && cfg.debug) console.warn("[SignalSort] rejected", r.status); })
        .catch(function () { queue = batch.concat(queue); });
    } catch (e) { queue = batch.concat(queue); }
  }

  function isInteractive(el) {
    for (var n = el; n && n !== d.body; n = n.parentElement) {
      var tag = n.tagName;
      if (tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "LABEL") return true;
      var role = n.getAttribute && n.getAttribute("role");
      if (role === "button" || role === "link" || role === "tab" || role === "menuitem") return true;
      if (n.onclick || (n.hasAttribute && n.hasAttribute("data-ss-interactive"))) return true;
    }
    return false;
  }

  function autocapture() {
    d.addEventListener("click", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-ss-id]") : null;
      if (!el) return;
      enqueue("click", { target: el.getAttribute("data-ss-id"), interactive: isInteractive(ev.target), page: currentPage() });
    }, true);
    d.addEventListener("focusin", function (ev) {
      var f = ev.target && ev.target.closest ? ev.target.closest("form[data-ss-form]") : null;
      if (!f) return;
      var name = f.getAttribute("data-ss-form");
      if (!started[name]) { started[name] = true; enqueue("form_started", { form: name }); }
    }, true);
    d.addEventListener("submit", function (ev) {
      var f = ev.target;
      if (f && f.getAttribute && f.getAttribute("data-ss-form")) {
        enqueue("form_submitted", { form: f.getAttribute("data-ss-form") });
        started[f.getAttribute("data-ss-form")] = false;
      }
    }, true);
    w.addEventListener("pagehide", function () {
      enqueue("session_end", { duration_seconds: Math.round((Date.now() - (sessionStartedAt || Date.now())) / 1000) });
      flush(true);
    });
    d.addEventListener("visibilitychange", function () { if (d.visibilityState === "hidden") flush(true); });
  }

  function currentPage() {
    return (d.body && d.body.getAttribute("data-ss-page")) || w.location.pathname;
  }

  var api = {
    init: function (options) {
      for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) cfg[k] = options[k];
      userId = get("local", "ss_uid");
      sessionId();
      if (cfg.autocapture) autocapture();
      return api;
    },
    identify: function (id, traits) {
      var anon = anonymousId();
      userId = String(id);
      // Re-attribute not-yet-sent anonymous events (e.g. session_start) to the identified user.
      for (var i = 0; i < queue.length; i++) if (queue[i].userId === anon) queue[i].userId = userId;
      set("local", "ss_uid", userId);
      if (traits) enqueue("identify", traits);
      return api;
    },
    reset: function () { userId = null; set("local", "ss_uid", ""); return api; },
    track: function (event, properties) { enqueue(event, properties); return api; },
    page: function (name, properties) {
      var p = properties || {};
      p.page = name || currentPage();
      p.path = w.location.pathname;
      enqueue("page_view", p);
      return api;
    },
    feature: function (name, properties) {
      var p = properties || {}; p.feature = name; enqueue("feature_used", p); return api;
    },
    fail: function (action, properties) {
      var p = properties || {}; p.action = action; enqueue("action_failed", p); return api;
    },
    flush: function () { flush(); }
  };
  w.SignalSort = api;
})(window, document);
