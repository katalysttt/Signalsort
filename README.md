# SignalSort

**Turn user signals into smarter product decisions.**

SignalSort is an AI-powered product intelligence platform. It takes what users *say* (reviews, interview transcripts, surveys, support conversations) and what users *do* (in-app events from a JavaScript SDK), finds where the experience breaks down, and recommends ranked, evidence-based product changes.

```
Raw user data → cleaning → sentiment → theme extraction → issue identification
             → behaviour pattern detection → prioritisation → recommendations
```

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **Load FoodDash demo**. Nothing else is required: storage is an embedded Postgres (PGlite) in `./data/pg`, and analysis runs on the built-in rule engine until you add an LLM key.

To use an LLM and/or hosted Postgres, copy `.env.example` to `.env.local` and set:

| Variable | Effect |
|---|---|
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | LLM pipeline through OpenAI |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) | LLM pipeline through Anthropic |
| `DATABASE_URL` | Supabase / Postgres instead of embedded PGlite (same schema, created automatically) |

Other scripts: `npm test` (engine unit tests), `npm run typecheck`, `npm run build && npm start`.

## What is in the app

| Page | What it does |
|---|---|
| **Overview** | Feedback totals, positive / negative / neutral / mixed shares, issues found, the most reported problem, the most requested feature, high-priority count, where feedback and behaviour agree, sentiment / category / issue-frequency charts, engagement and checkout funnel |
| **Feedback inbox** | Search plus filters (sentiment, category, source, priority, date). Click an item to see the original text, the AI summary, each extracted signal with its verbatim quote, feature requests, usability problems, unmet needs, suggested solutions, and the insights it feeds |
| **Insights** | Recurring themes with mention counts, frequency, number of sources, sentiment split, supporting quotes, business impact, severity, priority, and the behavioural evidence for each. **Combined insights** put "what users say" next to "what users do" and include a note that this is correlation, not proof of cause |
| **Behaviour analytics** | Active users, sessions, median session length, sign-ups, logins, searches, failed actions, funnels with drop-off, feature adoption (most and least used), page navigation, detected anomalies, and a live event feed. Simulated events can be switched on or off |
| **Recommendations** | Ranked by a visible score. Each one answers the six questions (what is wrong, why it happens, who is affected, what to change, how it helps, how to measure it) and lists improvements, A/B tests, metrics and the reason it was generated. PMs can **accept, reject, mark in progress or mark implemented**, and these decisions survive re-analysis |
| **Data sources** | Paste feedback (reviews, transcript, support chat, survey), upload CSV / Excel (.xlsx) / TXT / VTT / PDF, set up the SDK with write key and snippets, send a test event, load or reset the demo, and see the status of every source |
| **/demo-app** | *FoodDash*, a fictional food-delivery app built with the real SDK. Every click there sends **live** events |

## How the analysis stays honest

* **Statistics come from code, not from the model.** Mention counts, frequency, sentiment split and behavioural percentages are computed from linked records. The LLM only supplies wording, groupings and 1–5 severity judgements.
* **Quotes are checked.** Every signal's quote must appear word for word in the source text. Model output that fails this check is dropped, and that item falls back to the rule engine (the run notes say so).
* **Everything can be traced.** Each insight links to feedback IDs. Each recommendation lists its evidence and the reason it was ranked where it is.
* **Simulated data is labelled.** Demo events are stored with `source = 'simulated'` and marked wherever they appear. They can be excluded from the behaviour page.
* **Correlation is not presented as causation.** Combined insights and recommendations say so explicitly.
* **Mixed sentiment is kept.** "Easy to use, but delivery takes too long" becomes one positive and one negative signal, and the item is marked *mixed*.

### Prioritisation score

`score = 0.3·frequency + 0.3·severity + 0.2·user impact + 0.2·business impact`, each on a 0–100 scale.
Frequency is the share of feedback mentioning the theme (square-root scaled). User impact is the larger of that share and the reach of the related behaviour pattern. Score ≥70 → P0, ≥55 → P1, ≥40 → P2, otherwise P3.

## Behaviour tracking

```html
<script src="https://YOUR_HOST/sdk/signalsort.js"></script>
<script>
  SignalSort.init({ writeKey: "ss_live_…", endpoint: "https://YOUR_HOST/api/track" });
  SignalSort.identify("user_123");
  SignalSort.page("checkout");
  SignalSort.track("checkout_started", { cart_value: 24 });
  SignalSort.feature("live_tracking");
  SignalSort.fail("payment", { reason: "timeout" });
</script>
```

The SDK records these automatically: sessions with duration, clicks on `[data-ss-id]` (marked interactive or not, for dead-click detection), and `form_started` / `form_submitted` on `<form data-ss-form>`. Server-side, send `POST /api/track` with header `x-signalsort-key` and body `{ "events": [{ "event", "userId", "sessionId?", "properties?", "timestamp?" }] }`.

Detected patterns: funnel drop-off, slow steps, actions repeated within a session (such as opening and closing payment over and over), search-after-visit (users who can't find something by browsing), low adoption of new features, dead clicks, failed actions, and form abandonment.

## Demo scenario (FoodDash)

Six pieces of feedback, plus simulated events that match the brief exactly: 100 users start checkout, 42 abandon at payment selection, 58 complete, 65 visit order history, 30 search for previous orders, and 25 repeatedly open and close the payment page.

The brief does not say how these groups overlap, so `src/lib/demo.ts` makes these assumptions:
* 20 of the 25 payment togglers are among the 42 abandoners.
* 47 of the users who completed checkout used live tracking.
* 3 users tried a newly released "scheduled delivery" feature.

Results with the rule engine:
1. **P0 – Stabilise the payment page.** Feedback ("payment page keeps freezing") is backed by the 42% drop-off at payment selection and by the 25 togglers (80% of them did not complete checkout, compared with 29% of other users).
2. **P1 – Simplify checkout and clarify payment options.**
3. **P1 – Set accurate delivery expectations.** Based on feedback only.
4. **P1 – Make previous orders easy to find.** 46% of order-history visitors had to use search.
5. **P2 – Add one-tap reorder.**
6. **P3 – Investigate low adoption of scheduled delivery.** Based on behaviour only.

Sample files to upload are in `public/samples/` (CSV reviews, two interviews, a support chat, a survey export).

## Architecture

* **Next.js 16 (App Router) + React 19 + Tailwind + Recharts.** UI and API routes run in one Node app. Excel parsing uses ExcelJS, PDF text extraction uses unpdf.
* `src/lib/engine/rules.ts`: deterministic analysis (clause splitting, sentiment lexicon with negation, request detection, topic taxonomy).
* `src/lib/engine/llm.ts`, `llm-stages.ts`: OpenAI / Anthropic over plain `fetch`, with output validated at three stages (per-item analysis, theme clustering, recommendations).
* `src/lib/engine/behaviour.ts`: funnels, adoption and pattern detection.
* `src/lib/engine/synthesis.ts`: insights, combined insights, scoring, recommendations.
* `src/lib/pipeline.ts`: orchestration and persistence.
* `src/lib/db.ts`: Postgres via `pg` (when `DATABASE_URL` is set) or embedded PGlite.
* `public/sdk/signalsort.js`: tracking SDK, about 3 KB, no dependencies.

## Not yet built

* Connectors to external feedback sources (App Store, Intercom, Zendesk). The data model and the Data Sources page are ready for them.
* Authentication and multiple workspaces. Each instance is currently a single workspace with one write key.
* Linking feedback authors to tracked users, which would turn correlated signals into per-user evidence.
