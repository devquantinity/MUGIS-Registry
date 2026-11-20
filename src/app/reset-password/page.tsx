"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner, passwordProblems, useQueryParam } from "@/components/AuthFrame";

/** The reset link from the email: /reset-password?token=… */
export default function ResetPasswordPage() {
  useTitle("Choose a new password");
  const token = useQueryParam("token");
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    if (!token) { setValid(false); setError("This reset link is incomplete. Open the link from your email again."); return; }
    api.checkResetToken(token).then(() => setValid(true)).catch((e) => { setValid(false); setError(errorText(e)); });
  }, [token]);

  const weak = password ? passwordProblems(password) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    if (weak.length) { setError(`Your password needs ${weak.join(", ")}.`); return; }
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={submit} className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {done ? "Password changed" : "Choose a new password"}
        </h1>
        {done ? (
          <>
            <p className="mt-2 text-sm text-soot/85">You have been signed out everywhere. Sign in with your new password.</p>
            <Link href="/" className="btn-primary mt-6 w-full !py-2.5">Go to sign in</Link>
          </>
        ) : valid ? (
          <>
            <div className="mt-5 grid grid-cols-1 gap-3.5">
              <div>
                <label htmlFor="password" className="label">New password</label>
                <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
              </div>
              <div>
                <label htmlFor="confirm" className="label">Confirm password</label>
                <input id="confirm" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                <p className={"mt-1 text-[13px] " + (weak.length ? "text-danger-700" : "text-soot/72")}>
                  {weak.length ? `Needs ${weak.join(", ")}.` : "At least 12 characters, with an uppercase letter, a lowercase letter and a number."}
                </p>
              </div>
            </div>
            <FormError>{error}</FormError>
            <button type="submit" disabled={busy || !password || !confirm} className="btn-primary mt-6 w-full !py-2.5">
              {busy ? <><Spinner /> Saving…</> : <>Set new password <span aria-hidden>→</span></>}
            </button>
          </>
        ) : (
          <>
            <FormError>{error}</FormError>
            {valid === null && !error && <p className="mt-4 flex items-center gap-2 text-sm text-soot/75"><Spinner /> Checking your link…</p>}
            {valid === false && (
              <p className="mt-4 text-sm text-soot/80">
                <Link href="/forgot-password" className="font-semibold text-forest-600 hover:underline">Request a new link</Link>
              </p>
            )}
          </>
        )}
      </form>
    </AuthFrame>
  );
}
