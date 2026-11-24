// Password gate for deployed demos. Does nothing unless SIGNALSORT_PASSWORD is set.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken, sitePassword } from "@/lib/auth";

// Reachable without logging in.
const PUBLIC = [
  "/login",
  "/api/login",
  "/api/track", // SDK event ingestion: protected by the write key instead
  "/sdk/", // the SDK script itself
  "/favicon.svg",
];

export async function proxy(req: NextRequest) {
  const password = sitePassword();
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || (p.endsWith("/") && pathname.startsWith(p)))) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
