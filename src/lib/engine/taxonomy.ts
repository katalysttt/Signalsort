// Topic taxonomy + recommendation playbooks for the rule-based engine.
// Rules are ordered from most specific to most generic: the first rule whose
// `match` (and optional `requires`) hits a clause wins.
import type { Area, Category } from "../types";

export interface Playbook {
  action?: string; // short imperative title
  whyItHappens: string; // always phrased as a hypothesis to validate
  whatToChange: string;
  expectedImprovement: string;
  howToMeasure: string;
  improvements: { type: "product" | "feature" | "ux" | "workflow"; text: string }[];
  experiments: string[];
  metrics: string[];
}

export interface TopicRule {
  id: string;
  area: Area;
  category: Category;
  feature: string;
  match: RegExp;
  requires?: RegExp;
  problem: { title: string; label: string; description: string; impact: string };
  praise: { title: string; label: string };
  request: { title: string; label: string; description: string };
  severity: number; // severity of the problem variant, 1-5
  business: number; // business impact of the area, 1-5
  playbook?: Playbook;
  requestPlaybook?: Playbook;
}

const RELIABILITY = /freez|froze|spins? forever|nothing happens|crash|stuck|hang|error|fail|declin|not load|won'?t load|doesn'?t load|loading forever|glitch|bug|broken|time(s|d)? ?out|spinn/i;
const SLOW = /slow|too long|takes? (so |too )?long|late|forever|wait|ages|hours?|delay|cold|took \d+/i;

export const RULES: TopicRule[] = [
  {
    id: "reorder",
    area: "order_history",
    category: "Ordering workflow",
    feature: "Reorder",
    match: /\bre-?order|order (it |them |that )?again|repeat (my |an? )?(order|meal|purchase)|same (meal|order) again/i,
    problem: {
      title: "Reordering past meals is cumbersome",
      label: "Reordering is cumbersome",
      description: "Users find it difficult to repeat an order they have placed before.",
      impact: "Extra effort on repeat purchases, which are typically the highest-intent orders.",
    },
    praise: { title: "Users value quick reordering", label: "Quick reordering" },
    request: {
      title: "Users want one-tap reorder of previous meals",
      label: "Reorder previous meals",
      description: "Users ask for a way to repeat a previous order without rebuilding the basket.",
    },
    severity: 3,
    business: 4,
    requestPlaybook: {
      action: "Add one-tap reorder for previous meals",
      whyItHappens:
        "Hypothesis: the product has no reorder shortcut, so repeating a meal means finding the past order and rebuilding the basket by hand.",
      whatToChange:
        "Add a 'Reorder' action on each past order and a 'Order again' strip on the home screen that rebuilds the basket in one tap.",
      expectedImprovement:
        "Repeat customers reach checkout faster, which should lift repeat-order conversion and reduce time-to-order.",
      howToMeasure:
        "Track reorder_clicked → order_completed conversion, time from app open to checkout for returning users, and the 30-day repeat-order rate.",
      improvements: [
        { type: "feature", text: "One-tap 'Reorder' button on past orders" },
        { type: "ux", text: "'Order again' carousel on the home screen for returning users" },
        { type: "workflow", text: "Pre-fill the last-used address and payment method on reorder" },
      ],
      experiments: [
        "A/B test: home-screen 'Order again' strip vs. control for returning users",
        "Fake-door test of the Reorder button to size demand before building the backend",
      ],
      metrics: ["Repeat-order rate (30-day)", "Reorder button CTR", "Median time to checkout for returning users"],
    },
  },
  {
    id: "order_history",
    area: "order_history",
    category: "Navigation & discoverability",
    feature: "Order history",
    match: /(previous|past|old|recent|earlier|prior|last|latest) (orders?|meals?|purchases?|transactions?)|order history|transaction(s| history)|receipts?|my orders/i,
    problem: {
      title: "Users struggle to find their previous orders",
      label: "Poor order-history discoverability",
      description: "Users cannot easily locate past orders or transactions in the app.",
      impact: "Friction for support look-ups, reorders and receipts; drives avoidable searches and support contacts.",
    },
    praise: { title: "Users like the order history", label: "Useful order history" },
    request: {
      title: "Users want better access to past orders",
      label: "Better access to past orders",
      description: "Users ask for improvements to how past orders are listed or retrieved.",
    },
    severity: 3,
    business: 3,
    playbook: {
      action: "Make previous orders easy to find",
      whyItHappens:
        "Hypothesis: order history is not exposed in primary navigation (or is buried under the profile), so users fall back on search or give up.",
      whatToChange:
        "Surface 'Orders' as a primary navigation item, show the most recent orders on the home screen, and add search and date filters inside order history.",
      expectedImprovement:
        "Users reach past orders in one step, reducing searches, support contacts and abandoned look-ups.",
      howToMeasure:
        "Share of order-history visitors who need search (should fall), time-to-find a past order in usability tests, and 'where is my order' support tickets.",
      improvements: [
        { type: "ux", text: "Promote 'Orders' to the bottom navigation bar" },
        { type: "feature", text: "Search and filter (date, restaurant) within order history" },
        { type: "ux", text: "Show the 3 most recent orders on the home screen" },
      ],
      experiments: [
        "A/B test: 'Orders' tab in bottom navigation vs. current placement",
        "Five-user tree test: 'Find the meal you ordered last Tuesday'",
      ],
      metrics: ["% of order-history visits that include a search", "Time to locate a past order", "Order-related support tickets"],
    },
  },
  {
    id: "tracking",
    area: "tracking",
    category: "Delivery & fulfilment",
    feature: "Delivery tracking",
    match: /\btrack(ing|ed)?\b|where my (order|food|delivery) is|live map|\beta\b|courier location/i,
    problem: {
      title: "Delivery tracking is unreliable",
      label: "Unreliable delivery tracking",
      description: "Users report that order tracking is inaccurate or unclear.",
      impact: "Uncertainty during the wait increases support contacts and reduces trust.",
    },
    praise: { title: "Users love real-time delivery tracking", label: "Easy delivery tracking" },
    request: {
      title: "Users want richer delivery tracking",
      label: "Richer delivery tracking",
      description: "Users ask for more detail or control while tracking an order.",
    },
    severity: 3,
    business: 3,
  },
  {
    id: "payment_reliability",
    area: "checkout_payment",
    category: "Performance & reliability",
    feature: "Payment page",
    match: /payment|\bpay\b|paying|card|checkout|billing|wallet/i,
    requires: RELIABILITY,
    problem: {
      title: "Payment page freezes or fails at checkout",
      label: "Payment page freezing or failing",
      description: "Users report the payment step freezing or failing while they try to pay.",
      impact: "Blocks revenue at the last step of the purchase and erodes trust in paying through the app.",
    },
    praise: { title: "Users find payment reliable", label: "Reliable payments" },
    request: {
      title: "Users want more reliable payments",
      label: "More reliable payments",
      description: "Users ask for payment to work more reliably.",
    },
    severity: 5,
    business: 5,
    playbook: {
      action: "Stabilise the payment page",
      whyItHappens:
        "Hypothesis: a slow or blocking call while loading payment methods (or a third-party payment SDK) freezes the UI on some devices or networks.",
      whatToChange:
        "Instrument and profile the payment page load, load payment methods asynchronously with a skeleton state, add a timeout with a retry option, and keep the cart intact after a failure.",
      expectedImprovement:
        "Fewer users get stuck at payment, so fewer abandon checkout at the payment step.",
      howToMeasure:
        "Payment-page load time (p95), payment error/timeout rate, repeated open/close of the payment page per session, and payment-step completion rate.",
      improvements: [
        { type: "product", text: "Fix blocking payment-method load; add timeout + retry" },
        { type: "ux", text: "Skeleton loader and clear error state on the payment page" },
        { type: "workflow", text: "Preserve the basket and selected options after a payment failure" },
      ],
      experiments: [
        "Staged rollout of the async payment loader with a holdout group, comparing payment-step completion",
        "Add client-side performance tracing to confirm which devices/networks freeze",
      ],
      metrics: ["Payment-step completion rate", "p95 payment page load time", "Payment error rate", "Sessions with repeated payment-page opens"],
    },
  },
  {
    id: "checkout_complexity",
    area: "checkout_payment",
    category: "Checkout & payments",
    feature: "Checkout flow",
    match: /too many steps|checkout|check out|abandon(ed|ing)? (my |the )?(order|cart|basket)|placing (an |my )?order|ordering process|payment (options|methods|selection)|payment|\bpay\b/i,
    problem: {
      title: "Checkout has too many steps",
      label: "Checkout too long / complex",
      description: "Users find the checkout flow long or confusing and some abandon their order.",
      impact: "Direct revenue loss from abandoned baskets.",
    },
    praise: { title: "Users find checkout quick", label: "Quick checkout" },
    request: {
      title: "Users want a faster checkout",
      label: "Faster checkout",
      description: "Users ask for fewer steps or more payment options at checkout.",
    },
    severity: 4,
    business: 5,
    playbook: {
      action: "Simplify checkout and clarify payment options",
      whyItHappens:
        "Hypothesis: checkout asks for information on separate screens (address, time, payment, confirmation) and payment options are not clearly presented, so users drop off.",
      whatToChange:
        "Collapse checkout into a single review-and-pay screen, remember the last address and payment method, and present payment options with clear labels and a default selection.",
      expectedImprovement:
        "Fewer steps and clearer payment choices should reduce abandonment between starting checkout and completing an order.",
      howToMeasure:
        "Checkout funnel conversion (checkout_started → order_completed), drop-off at payment selection, and median time to complete checkout.",
      improvements: [
        { type: "workflow", text: "Single-page checkout with saved address and payment defaults" },
        { type: "ux", text: "Clear payment option cards with a pre-selected default" },
        { type: "feature", text: "Express pay (Apple Pay / Google Pay / saved card)" },
      ],
      experiments: [
        "A/B test: single-page checkout vs. current multi-step flow",
        "A/B test: pre-selected last-used payment method vs. no default",
      ],
      metrics: ["Checkout conversion rate", "Drop-off at payment selection", "Median checkout duration"],
    },
  },
  {
    id: "delivery_speed",
    area: "delivery",
    category: "Delivery & fulfilment",
    feature: "Delivery time",
    match: /deliver(y|ies|ed)?|courier|driver|rider|arriv|food (came|was|arrived)/i,
    requires: SLOW,
    problem: {
      title: "Deliveries take too long",
      label: "Slow delivery",
      description: "Users report long delivery times or late orders.",
      impact: "Long waits reduce satisfaction and repeat orders, even when the app itself is easy to use.",
    },
    praise: { title: "Users like fast delivery", label: "Fast delivery" },
    request: {
      title: "Users want faster delivery",
      label: "Faster delivery",
      description: "Users ask for faster or more predictable delivery.",
    },
    severity: 4,
    business: 4,
    playbook: {
      action: "Set accurate delivery expectations and cut delays",
      whyItHappens:
        "Hypothesis: preparation and courier-dispatch times are not reflected in the ETA shown, so delivery feels slower than promised; operational capacity may also be constrained at peak times.",
      whatToChange:
        "Show realistic ETAs at the restaurant-selection stage, surface faster options ('Under 30 min' filter), and share delivery-time data with operations to target slow zones and peak hours.",
      expectedImprovement:
        "Expectations are set before ordering and users can choose faster options, reducing late-delivery complaints.",
      howToMeasure:
        "Promised vs. actual delivery time gap, share of orders delivered late, post-delivery rating, and delivery-related complaints.",
      improvements: [
        { type: "ux", text: "Show accurate ETA ranges before checkout" },
        { type: "feature", text: "'Fastest delivery' sort and 'Under 30 min' filter" },
        { type: "workflow", text: "Proactive delay notification with an apology credit" },
      ],
      experiments: [
        "A/B test: ETA range on restaurant cards vs. single estimate",
        "Pilot proactive delay notifications in one city",
      ],
      metrics: ["Average promised-vs-actual delivery gap", "% late orders", "Delivery satisfaction rating"],
    },
  },
  {
    id: "delivery",
    area: "delivery",
    category: "Delivery & fulfilment",
    feature: "Delivery",
    match: /deliver(y|ies|ed)?|courier|driver|rider|arriv/i,
    problem: {
      title: "Delivery experience falls short",
      label: "Delivery problems",
      description: "Users report problems with how their order was delivered.",
      impact: "Poor deliveries undo a good ordering experience and reduce repeat orders.",
    },
    praise: { title: "Users like fast, reliable delivery", label: "Fast delivery" },
    request: {
      title: "Users want more delivery options",
      label: "More delivery options",
      description: "Users ask for more control over how and when orders arrive.",
    },
    severity: 3,
    business: 4,
  },
  {
    id: "onboarding",
    area: "onboarding",
    category: "Onboarding & account",
    feature: "Sign-up & login",
    match: /sign ?up|signing up|register|registration|onboarding|log ?in|login|password|verification|otp|create an account/i,
    problem: {
      title: "Sign-up and login create friction",
      label: "Sign-up / login friction",
      description: "Users report difficulties creating an account or logging in.",
      impact: "Lost users before they ever reach the core experience.",
    },
    praise: { title: "Users find sign-up easy", label: "Easy sign-up" },
    request: {
      title: "Users want simpler sign-in options",
      label: "Simpler sign-in",
      description: "Users ask for social login, passwordless login or fewer sign-up fields.",
    },
    severity: 4,
    business: 4,
  },
  {
    id: "search",
    area: "search",
    category: "Navigation & discoverability",
    feature: "Search",
    match: /\bsearch|filter|sort by|find (a |the )?(restaurant|dish|item|product)/i,
    problem: {
      title: "Search does not return what users need",
      label: "Weak search",
      description: "Users struggle to find items through search or filters.",
      impact: "Users who cannot find items cannot order them.",
    },
    praise: { title: "Users like search", label: "Effective search" },
    request: {
      title: "Users want better search and filters",
      label: "Better search & filters",
      description: "Users ask for additional search or filter capabilities.",
    },
    severity: 3,
    business: 3,
  },
  {
    id: "pricing",
    area: "pricing",
    category: "Pricing & value",
    feature: "Pricing & fees",
    match: /price|pricing|expensive|overpriced|\bfees?\b|cost|cheap|discount|promo|coupon|value for money|surcharge/i,
    problem: {
      title: "Users find prices or fees too high",
      label: "High prices / fees",
      description: "Users complain about prices, delivery fees or hidden charges.",
      impact: "Price sensitivity reduces order frequency and basket size.",
    },
    praise: { title: "Users find the service good value", label: "Good value" },
    request: {
      title: "Users want discounts or fee transparency",
      label: "Discounts / fee transparency",
      description: "Users ask for promotions, loyalty rewards or clearer fees.",
    },
    severity: 3,
    business: 4,
  },
  {
    id: "support",
    area: "support",
    category: "Customer support",
    feature: "Customer support",
    match: /support|customer service|\bagent\b|refund|help ?desk|live chat|contact (you|us)|complain/i,
    problem: {
      title: "Support is hard to reach or unhelpful",
      label: "Poor support experience",
      description: "Users report slow or unhelpful customer support.",
      impact: "Unresolved issues turn into churn and negative reviews.",
    },
    praise: { title: "Users praise customer support", label: "Helpful support" },
    request: {
      title: "Users want easier access to support",
      label: "Easier support access",
      description: "Users ask for in-app chat or faster refunds.",
    },
    severity: 3,
    business: 3,
  },
  {
    id: "notifications",
    area: "notifications",
    category: "Notifications",
    feature: "Notifications",
    match: /notification|push|\bemails?\b|\bsms\b|spam|alerts?/i,
    problem: {
      title: "Notifications are noisy or missing",
      label: "Notification issues",
      description: "Users report too many, too few or irrelevant notifications.",
      impact: "Notification fatigue leads to opt-outs and missed order updates.",
    },
    praise: { title: "Users like timely notifications", label: "Timely notifications" },
    request: {
      title: "Users want more control over notifications",
      label: "Notification controls",
      description: "Users ask for notification preferences.",
    },
    severity: 2,
    business: 2,
  },
  {
    id: "performance",
    area: "performance",
    category: "Performance & reliability",
    feature: "App performance",
    match: /slow|lag|crash|freez|froze|spins? forever|nothing happens|load(ing)? time|takes forever to load|battery|bug|glitch|not working|keeps closing/i,
    problem: {
      title: "The app is slow or unstable",
      label: "Slow / unstable app",
      description: "Users report crashes, lag or long load times.",
      impact: "Performance problems affect every journey and drive uninstalls.",
    },
    praise: { title: "Users find the app fast", label: "Fast, stable app" },
    request: {
      title: "Users want a faster app",
      label: "Faster app",
      description: "Users ask for better performance.",
    },
    severity: 4,
    business: 4,
  },
  {
    id: "navigation",
    area: "navigation",
    category: "Navigation & discoverability",
    feature: "Navigation",
    match: /can'?t find|cannot find|couldn'?t find|hard to find|locate|navigat|where (is|are|do)|hidden|buried|settings|menu bar|tab bar/i,
    problem: {
      title: "Users struggle to find key screens",
      label: "Hard-to-find features",
      description: "Users cannot locate important screens or settings.",
      impact: "Increased friction and support contacts; features that cannot be found are not used.",
    },
    praise: { title: "Users find navigation clear", label: "Clear navigation" },
    request: {
      title: "Users want clearer navigation",
      label: "Clearer navigation",
      description: "Users ask for shortcuts or a clearer structure.",
    },
    severity: 3,
    business: 3,
  },
  {
    id: "menu_catalogue",
    area: "menu_catalogue",
    category: "Content & catalogue",
    feature: "Menu & restaurants",
    match: /\bmenu|restaurants?|dish(es)?|cuisine|selection|options|variety|meals?|food/i,
    problem: {
      title: "Menu or restaurant selection falls short",
      label: "Limited / unclear menu",
      description: "Users are unhappy with menu content, variety or accuracy.",
      impact: "Users who cannot find appealing options order less often.",
    },
    praise: { title: "Users enjoy the food selection", label: "Good food selection" },
    request: {
      title: "Users want more menu options",
      label: "More menu options",
      description: "Users ask for more restaurants, dishes or menu details.",
    },
    severity: 2,
    business: 3,
  },
  {
    id: "ease_of_use",
    area: "general",
    category: "Usability",
    feature: "Overall ease of use",
    match: /easy|simple|intuitive|user[- ]friendly|straightforward|clean|design|interface|\bui\b|\bux\b|to use|confusing|complicated|clunky/i,
    problem: {
      title: "The app feels confusing to use",
      label: "Confusing experience",
      description: "Users describe the overall experience as confusing or complicated.",
      impact: "General friction lowers conversion across journeys.",
    },
    praise: { title: "Users find the app easy to use", label: "Easy-to-use app" },
    request: {
      title: "Users want a simpler experience",
      label: "Simpler experience",
      description: "Users ask for simplification.",
    },
    severity: 3,
    business: 3,
  },
];

export const FALLBACK_RULE: TopicRule = {
  id: "general",
  area: "general",
  category: "Other",
  feature: "General experience",
  match: /.*/,
  problem: {
    title: "General dissatisfaction",
    label: "General dissatisfaction",
    description: "Negative feedback that does not map to a specific feature.",
    impact: "Unclear; needs follow-up research to locate the cause.",
  },
  praise: { title: "General positive sentiment", label: "General satisfaction" },
  request: {
    title: "Other suggestions",
    label: "General suggestion",
    description: "Suggestions that do not map to a specific feature.",
  },
  severity: 2,
  business: 2,
};

export function genericPlaybook(rule: TopicRule, kind: "problem" | "feature_request"): Playbook {
  const f = rule.feature.toLowerCase();
  if (kind === "feature_request") {
    return {
      action: `Validate and build: ${rule.request.label.toLowerCase()}`,
      whyItHappens: `Hypothesis: the current ${f} does not cover a need users are actively asking for.`,
      whatToChange: `Validate the request with a lightweight prototype or fake-door test, then add the most-requested ${f} capability.`,
      expectedImprovement: `Users can accomplish the job they described without workarounds.`,
      howToMeasure: `Adoption of the new ${f} capability, repeat usage after 14 days, and the volume of the same request in new feedback.`,
      improvements: [
        { type: "feature", text: `Prototype the requested ${f} capability` },
        { type: "ux", text: `Make the capability discoverable where users currently look for it` },
      ],
      experiments: [`Fake-door test to measure demand for the requested ${f} capability`],
      metrics: [`Feature adoption rate`, `Repeat usage (14-day)`, `Volume of related requests`],
    };
  }
  return {
    action: `Remove friction in ${f}`,
    whyItHappens: `Hypothesis: the ${f} experience does not match what users expect; run 3–5 follow-up interviews or session replays to confirm the root cause.`,
    whatToChange: `Diagnose the ${f} journey with session data and targeted usability tests, then fix the most common failure point.`,
    expectedImprovement: `Less friction in the ${f} journey and fewer related complaints.`,
    howToMeasure: `Task success rate for the ${f} journey, related complaint volume, and satisfaction score for affected users.`,
    improvements: [
      { type: "ux", text: `Remove the main friction point in the ${f} journey` },
      { type: "product", text: `Instrument the ${f} journey to locate failures` },
    ],
    experiments: [`A/B test the redesigned ${f} journey against the current one`],
    metrics: [`Task success rate`, `Related complaint volume`, `CSAT for affected users`],
  };
}

export function ruleById(id: string): TopicRule {
  return RULES.find((r) => r.id === id) ?? FALLBACK_RULE;
}
