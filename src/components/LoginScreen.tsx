"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError, errorText } from "@/lib/api";
import { useSession } from "@/lib/session";
import AuthFrame, { FormError, FormNotice, Spinner } from "@/components/AuthFrame";
import OtpInput from "@/components/OtpInput";

const emptyCode = () => Array.from({ length: 6 }, () => "");

/** Messages for why the previous session ended (reasons from the API). */
const ENDED: Record<string, string> = {
  session_expired: "You were signed out after 30 minutes of inactivity. Please sign in again.",
  account_inactive: "Your account can no longer sign in. Contact the registry administrator.",
  invalid_token: "Your session has ended. Please sign in again.",
};

/**
 * Sign-in: email + password, then the 6-digit TOTP code. An account that has
 * not set up TOTP yet is signed straight in and sent to enrolment by the
 * shell (phase "enrol").
 */
export default function LoginScreen() {
  const { completeSignIn, endedBecause } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"account" | "code">("account");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState<string[]>(emptyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(endedBecause ? ENDED[endedBecause] ?? ENDED.invalid_token : null);

  function fail(e: unknown) {
    setError(errorText(e));
    setReason(e instanceof ApiError ? e.reason : null);
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true); setError(null); setReason(null); setNotice(null);
    try {
      const res = await api.login(email.trim(), password);
      if (res.two_factor_required && res.challenge_token) {
        setChallenge(res.challenge_token);
        setCode(emptyCode());
        setStep("code");
      } else if (res.access_token && res.refresh_token && res.user) {
        completeSignIn(res as Required<typeof res>);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(digits = code) {
    if (busy || digits.some((d) => d === "")) return;
    setBusy(true); setError(null); setReason(null);
    try {
      completeSignIn(await api.verify2fa(challenge, digits.join("")));
    } catch (err) {
      fail(err);
      setCode(emptyCode());
      // An expired challenge or a lockout means starting again.
      if (err instanceof ApiError && (err.reason === "invalid_token" || err.reason === "account_locked")) {
        setStep("account");
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendActivation() {
    try {
      const r = await api.resendActivation(email.trim());
      setError(null); setReason(null);
      setNotice(r.message.charAt(0).toUpperCase() + r.message.slice(1) + ".");
    } catch (err) {
      fail(err);
    }
  }

  function back() {
    setStep("account");
    setCode(emptyCode());
    setError(null); setReason(null);
  }

  return (
    <AuthFrame>
      {step === "account" ? (
        <form onSubmit={submitAccount} key="account" className="mg-pop">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome</h1>
          <p className="mt-1 text-sm text-soot/80">Upper GI Cancer Registry. Sign in with your registry account.</p>

          <FormNotice>{notice}</FormNotice>

          <div className="mt-6">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email" type="email" className="input" value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" spellCheck={false} autoFocus
              placeholder="you@hospital.gov.my"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="label">Password</label>
              <Link href="/forgot-password" className="text-[13px] font-medium text-forest-600 hover:underline touch:-my-3 touch:py-3">
                Forgot password?
              </Link>
            </div>
            <input
              id="password" type="password" className="input" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" placeholder="••••••••••••"
            />
          </div>

          <FormError>
            {error}
            {error && reason === "activation_pending" && (
              <button type="button" onClick={resendActivation} className="mt-1.5 block font-semibold underline underline-offset-2">
                Send the activation link again
              </button>
            )}
          </FormError>

          <button type="submit" disabled={busy || !email.trim() || !password} className="btn-primary mt-6 w-full !py-2.5">
            {busy ? <><Spinner /> Signing in…</> : <>Continue <span aria-hidden>→</span></>}
          </button>

          <p className="mt-5 text-center text-sm text-soot/80">
            New to the registry?{" "}
            <Link href="/register" className="font-semibold text-forest-600 hover:underline">Request an account</Link>
          </p>
        </form>
      ) : (
        <form
          key="code"
          className="mg-pop"
          onSubmit={(e) => { e.preventDefault(); verify(); }}
        >
          <button
            type="button" onClick={back}
            className="mb-4 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-soot/75 transition-colors hover:text-ink touch:-mt-2.5 touch:mb-1.5 touch:py-2.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
            </svg>
            Use a different account
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Two-step verification</h1>
          <p className="mt-1 text-sm text-soot/80">Enter the 6-digit code from your authenticator app.</p>

          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-ink/[0.06] bg-white/60 py-1 pl-1 pr-3 dark:bg-white/[0.06]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-500 text-[12px] font-bold text-white">
              {email.trim().slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-[14px] text-soot">{email.trim()}</span>
          </div>

          <div className="mt-6">
            <OtpInput
              code={code} onCode={setCode} disabled={busy}
              onComplete={(d) => verify(d)}
            />
          </div>

          <FormError>{error}</FormError>

          <button type="submit" disabled={busy || code.some((d) => d === "")} className="btn-primary mt-6 w-full !py-2.5">
            {busy ? <><Spinner /> Verifying…</> : <>Verify &amp; sign in <span aria-hidden>→</span></>}
          </button>

          <p className="mt-4 text-center text-[13px] leading-relaxed text-soot/72">
            Lost your authenticator? Ask your registry administrator to reset it.
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
