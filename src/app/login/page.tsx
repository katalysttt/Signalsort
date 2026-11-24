import { redirect } from "next/navigation";
import { safeNext, sitePassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!sitePassword()) redirect(next);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#161935] to-[#2b2070] px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
            <defs>
              <linearGradient id="lgl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8b78f5" />
                <stop offset="1" stopColor="#2a78d6" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill="url(#lgl)" />
            <path d="M8 20h4l3-9 3 12 3-7h3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-navy">
            signalsort<span className="text-brand-500">.</span>
          </span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-navy">Enter the demo password</h1>
        <p className="mt-1 text-sm text-navy-400">This SignalSort workspace is password-protected.</p>
        <form method="POST" action="/api/login" className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className="input" />
          {sp.error && (
            <p className="text-sm text-red-700" role="alert">
              That password isn’t right. Try again.
            </p>
          )}
          <button type="submit" className="btn-primary w-full py-2.5">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
