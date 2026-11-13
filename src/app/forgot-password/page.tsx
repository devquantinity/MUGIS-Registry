"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner } from "@/components/AuthFrame";

export default function ForgotPasswordPage() {
  useTitle("Reset your password");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={submit} className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reset your password</h1>
        {sent ? (
          <p className="mt-2 text-sm leading-relaxed text-soot/85">
            If an active account exists for <span className="font-medium text-ink">{email.trim()}</span>, a reset
            link is on its way. It works once and expires in 1 hour.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-soot/80">We&rsquo;ll email you a link to choose a new password.</p>
            <div className="mt-5">
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </div>
            <FormError>{error}</FormError>
            <button type="submit" disabled={busy || !email.trim()} className="btn-primary mt-6 w-full !py-2.5">
              {busy ? <><Spinner /> Sending…</> : <>Send reset link <span aria-hidden>→</span></>}
            </button>
          </>
        )}
        <p className="mt-5 text-center text-sm text-soot/80">
          <Link href="/" className="font-semibold text-forest-600 hover:underline">Back to sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
