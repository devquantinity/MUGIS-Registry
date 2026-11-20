"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText, API_ROLE_LABELS, type Preview } from "@/lib/api";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner, useQueryParam } from "@/components/AuthFrame";

/** The magic link from the approval email: /activate?token=… */
export default function ActivatePage() {
  useTitle("Activate your account");
  const token = useQueryParam("token");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    if (!token) { setError("This activation link is incomplete. Open the link from your email again."); return; }
    api.previewActivation(token).then(setPreview).catch((e) => setError(errorText(e)));
  }, [token]);

  async function activate() {
    if (!token || busy) return;
    setBusy(true); setError(null);
    try {
      await api.activate(token);
      setDone(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <div className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {done ? "Account activated" : "Activate your account"}
        </h1>

        {done ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-soot/85">
              Sign in with your email and the password you chose when you registered. You will
              then set up two-factor authentication.
            </p>
            <Link href="/" className="btn-primary mt-6 w-full !py-2.5">Go to sign in</Link>
          </>
        ) : preview ? (
          <>
            <p className="mt-2 text-sm text-soot/85">Your registration has been approved.</p>
            <dl className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-ink/[0.06] bg-white/60 p-4 text-sm dark:bg-white/[0.04]">
              <div className="flex justify-between gap-3"><dt className="shrink-0 text-soot/75">Name</dt><dd className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{preview.full_name ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="shrink-0 text-soot/75">Email</dt><dd className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{preview.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="shrink-0 text-soot/75">Role</dt><dd className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{API_ROLE_LABELS[preview.role]}</dd></div>
              {preview.centre && <div className="flex justify-between gap-3"><dt className="shrink-0 text-soot/75">Centre</dt><dd className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{preview.centre.name}</dd></div>}
            </dl>
            <FormError>{error}</FormError>
            <button onClick={activate} disabled={busy} className="btn-primary mt-6 w-full !py-2.5">
              {busy ? <><Spinner /> Activating…</> : <>Activate my account <span aria-hidden>→</span></>}
            </button>
          </>
        ) : (
          <>
            <FormError>{error}</FormError>
            {!error && <p className="mt-4 flex items-center gap-2 text-sm text-soot/75"><Spinner /> Checking your link…</p>}
            {error && (
              <p className="mt-4 text-sm text-soot/80">
                Links last 3 days and work once. Sign in to request a new one, or{" "}
                <Link href="/" className="font-semibold text-forest-600 hover:underline">go to sign in</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </AuthFrame>
  );
}
