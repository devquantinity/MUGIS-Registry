"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText, API_ROLE_LABELS, type Preview } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner, passwordProblems, useQueryParam } from "@/components/AuthFrame";

/** The invitation link: /accept-invitation?token=… — set a password, then enrol TOTP. */
export default function AcceptInvitationPage() {
  useTitle("Accept invitation");
  const router = useRouter();
  const { completeSignIn } = useSession();
  const token = useQueryParam("token");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token === undefined) return;
    if (!token) { setError("This invitation link is incomplete. Open the link from your email again."); return; }
    api.previewInvitation(token)
      .then((p) => { setPreview(p); setFullName(p.full_name ?? ""); })
      .catch((e) => setError(errorText(e)));
  }, [token]);

  const weak = password ? passwordProblems(password) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    if (weak.length) { setError(`Your password needs ${weak.join(", ")}.`); return; }
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      completeSignIn(await api.acceptInvitation(token, password, fullName.trim() || undefined));
      router.replace("/"); // the shell shows TOTP enrolment next
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={submit} className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Accept your invitation</h1>
        {preview ? (
          <>
            <p className="mt-1 text-sm text-soot/80">
              {preview.email} · {API_ROLE_LABELS[preview.role]}{preview.centre ? ` · ${preview.centre.name}` : ""}
            </p>
            <div className="mt-5 grid gap-3.5">
              <div>
                <label htmlFor="full_name" className="label">Full name</label>
                <input id="full_name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="password" className="label">Choose a password</label>
                <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
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
              {busy ? <><Spinner /> Setting up…</> : <>Set password &amp; continue <span aria-hidden>→</span></>}
            </button>
          </>
        ) : (
          <>
            <FormError>{error}</FormError>
            {!error && <p className="mt-4 flex items-center gap-2 text-sm text-soot/75"><Spinner /> Checking your invitation…</p>}
            {error && (
              <p className="mt-4 text-sm text-soot/80">
                Invitations last 7 days and work once — ask your administrator to send a new one.{" "}
                <Link href="/" className="font-semibold text-forest-600 hover:underline">Go to sign in</Link>
              </p>
            )}
          </>
        )}
      </form>
    </AuthFrame>
  );
}
