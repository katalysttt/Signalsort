import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, safeNext, sessionToken, sitePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const given = String(form?.get("password") ?? "");
  const next = safeNext(form?.get("next"));
  const password = sitePassword();
  const base = new URL(req.url);

  if (!password) return NextResponse.redirect(new URL(next, base), 303);

  if (!given || !safeEqual(given, password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, base), 303);
  }

  const res = NextResponse.redirect(new URL(next, base), 303);
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: base.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
