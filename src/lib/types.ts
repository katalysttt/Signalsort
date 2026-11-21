// Shared domain types for SignalSort.

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type SignalPolarity = "positive" | "negative" | "neutral";
export type SignalKind =
  | "praise" // something users value
  | "problem" // something that is broken / frustrating
  | "usability" // friction, confusion, discoverability
  | "feature_request" // something users want that does not exist
  | "expectation" // unmet need / expectation
  | "question"; // neutral question or observation

export const CATEGORIES = [
  "Usability",
  "Navigation & discoverability",
  "Performance & reliability",
  "Checkout & payments",
  "Ordering workflow",
  "Delivery & fulfilment",
  "Pricing & value",
  "Customer support",
  "Onboarding & account",
  "Content & catalogue",
  "Notifications",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Product areas join feedback themes to behavioural patterns. */
export const AREAS = [
  "checkout_payment",
  "order_history",
  "delivery",
  "tracking",
  "search",
  "navigation",
  "onboarding",
  "account",
  "menu_catalogue",
  "pricing",
  "support",
  "notifications",
  "performance",
  "general",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  checkout_payment: "Checkout & payment",
  order_history: "Order history",
  delivery: "Delivery",
  tracking: "Delivery tracking",
  search: "Search",
  navigation: "Navigation",
  onboarding: "Sign-up & onboarding",
  account: "Account",
  menu_catalogue: "Menu & catalogue",
  pricing: "Pricing",
  support: "Support",
  notifications: "Notifications",
  performance: "App performance",
  general: "General experience",
};

export interface Signal {
  polarity: SignalPolarity;
  kind: SignalKind;
  /** Short normalised description, e.g. "Poor transaction discoverability" */
  label: string;
  /** Verbatim excerpt from the original feedback text. */
  quote: string;
  feature: string;
  area: Area;
  category: Category;
  /** Taxonomy topic id (rule engine) used as a clustering hint. */
  ruleId?: string;
}

export interface FeedbackAnalysis {
  engine: string; // "rules" | "openai:<model>" | "anthropic:<model>"
  summary: string;
  sentiment: Sentiment;
  primaryCategory: Category;
  mainIssue: string;
  signals: Signal[];
  featureRequests: string[];
  usabilityProblems: string[];
  unmetNeeds: string[];
  suggestedSolutions: string[];
}

export type SourceType =
  | "paste"
  | "transcript"
  | "csv"
  | "excel"
  | "survey"
  | "support"
  | "pdf"
  | "text"
  | "demo";

export interface FeedbackItem {
  id: number;
  text: string;
  sourceType: SourceType;
  sourceId: number | null;
  sourceName: string | null;
  author: string | null;
  createdAt: string;
  analysis: FeedbackAnalysis | null;
  sentiment: Sentiment | null;
  category: string | null;
  priority: string | null;
}

export interface DataSource {
  id: number;
  name: string;
  type: SourceType | "sdk";
  status: "processing" | "ready" | "error" | "connected";
  itemCount: number;
  createdAt: string;
  meta: Record<string, unknown>;
}

export interface TrackedEvent {
  event: string;
  userId: string;
  sessionId: string | null;
  properties: Record<string, unknown>;
  ts: string;
  source: "sdk" | "api" | "simulated";
}

// ---- Analysis outputs ----------------------------------------------------

export type Priority = "P0" | "P1" | "P2" | "P3";

export interface Evidence {
  feedbackId: number;
  quote: string;
  polarity: SignalPolarity;
  sourceName: string | null;
}

export interface Insight {
  key: string;
  title: string;
  description: string;
  kind: "problem" | "feature_request" | "praise";
  feature: string;
  area: Area;
  category: Category;
  /** Distinct feedback items mentioning the theme (computed, never generated). */
  mentionCount: number;
  /** Distinct sources (interviews, files…) the theme appears in. */
  sourceCount: number;
  /** Share of all analysed feedback items that mention the theme. */
  frequency: number;
  sentiment: { positive: number; negative: number; neutral: number };
  evidence: Evidence[];
  impact: string;
  severity: number; // 1-5
  businessImpact: number; // 1-5
  recommendation: string;
  priority: Priority;
  score: number;
  engine: string;
}

export interface BehaviourPattern {
  key: string;
  area: Area;
  type:
    | "funnel_dropoff"
    | "repeated_action"
    | "search_after_visit"
    | "low_adoption"
    | "dead_click"
    | "failed_action"
    | "form_abandonment"
    | "slow_step";
  title: string;
  /** Plain-language finding with the computed numbers. */
  finding: string;
  metric: { label: string; value: number; numerator: number; denominator: number };
  usersAffected: number;
  severity: number;
  dataOrigin: "simulated" | "live" | "mixed";
  interpretation: string;
}

export interface CombinedInsight {
  key: string;
  area: Area;
  title: string;
  conclusion: string;
  insightKeys: string[];
  patternKeys: string[];
  strength: "strong" | "moderate";
  causalityNote: string;
}

export interface Recommendation {
  key: string;
  insightKey: string | null;
  patternKeys: string[];
  title: string;
  area: Area;
  whatIsWrong: string;
  whyItHappens: string;
  whoIsAffected: string;
  whatToChange: string;
  expectedImprovement: string;
  howToMeasure: string;
  improvements: { type: "product" | "feature" | "ux" | "workflow"; text: string }[];
  experiments: string[];
  metrics: string[];
  rationale: string;
  scores: { frequency: number; severity: number; userImpact: number; businessImpact: number };
  score: number;
  priority: Priority;
  evidenceFeedbackIds: number[];
  engine: string;
  status?: RecommendationStatus;
  statusNote?: string | null;
  updatedAt?: string;
}

export type RecommendationStatus = "proposed" | "accepted" | "rejected" | "in_progress" | "implemented";

export interface AnalysisResult {
  runId: number;
  engine: string;
  createdAt: string;
  totals: {
    feedback: number;
    analysed: number;
    sentiment: Record<Sentiment, number>;
    categories: Record<string, number>;
  };
  insights: Insight[];
  patterns: BehaviourPattern[];
  combined: CombinedInsight[];
  notes: string[];
}
