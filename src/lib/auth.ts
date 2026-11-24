// Optional shared-password protection for deployed demos.
// Enabled only when SIGNALSORT_PASSWORD is set; local development stays open.

export const SESSION_COOKIE = "ss_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function sitePassword(): string | null {
  const p = process.env.SIGNALSORT_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** Session token = HMAC-SHA256(password, fixed label). Changing the password logs everyone out. */
export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("signalsort-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent comparison so timing doesn't reveal how much of a value matched. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Only allow same-site relative redirects ("/insights"), never "//evil.com" or absolute URLs. */
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "/";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}
