"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { api, errorText, type TwoFactorSetup } from "@/lib/api";
import { useSession } from "@/lib/session";
import AuthFrame, { FormError, Spinner } from "@/components/AuthFrame";
import OtpInput from "@/components/OtpInput";

const emptyCode = () => Array.from({ length: 6 }, () => "");

/**
 * Mandatory TOTP enrolment. Shown instead of the app while the account has
 * not set up an authenticator (the backend refuses every registry route
 * until it has). The QR code is drawn in the browser — the secret never
 * leaves for a third-party QR service.
 */
export default function EnrolTwoFactor() {
  const { user, finishEnrolment, signOut } = useSession();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string[]>(emptyCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const started = useRef(false);

  // Exactly once: each /2fa/setup call replaces the stored secret, so a
  // second call (React's dev double-effect) would leave the QR on screen
  // out of step with the server.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.setup2fa()
      .then(async (s) => {
        setSetup(s);
        setQr(await QRCode.toDataURL(s.otpauth_uri, { margin: 1, width: 220 }));
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  async function confirm(digits = code) {
    if (busy || digits.some((d) => d === "")) return;
    setBusy(true); setError(null);
    try {
      await api.enable2fa(digits.join(""));
      await finishEnrolment();
    } catch (e) {
      setError(errorText(e));
      setCode(emptyCode());
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={(e) => { e.preventDefault(); confirm(); }} className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Set up two-factor authentication</h1>
        <p className="mt-1 text-sm text-soot/80">
          Every registry account needs an authenticator app (Google Authenticator, Microsoft
          Authenticator, 1Password…). You will enter a code from it each time you sign in.
        </p>

        <ol className="mt-5 grid gap-4 text-sm text-ink">
          <li>
            <span className="font-semibold">1. Scan this code</span> with your authenticator app.
            <div className="mt-3 flex items-center justify-center rounded-2xl border border-ink/[0.06] bg-white p-3">
              {qr
                // A data: URL generated in the browser; next/image adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qr} alt="QR code for your authenticator app" width={220} height={220} />
                : <div className="flex h-[220px] w-[220px] items-center justify-center text-soot/60"><Spinner /></div>}
            </div>
            {setup && (
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="mt-2 text-[13px] font-medium text-forest-600 hover:underline">
                {showSecret ? "Hide the key" : "Can't scan? Enter a key instead"}
              </button>
            )}
            {setup && showSecret && (
              <p className="mt-1 break-all rounded-lg bg-cream px-3 py-2 font-mono text-[13px] tracking-wider text-ink">
                {setup.secret}
              </p>
            )}
          </li>
          <li>
            <span className="font-semibold">2. Enter the 6-digit code</span> it shows.
            <div className="mt-3">
              <OtpInput code={code} onCode={setCode} disabled={busy || !setup} onComplete={(d) => confirm(d)} />
            </div>
          </li>
        </ol>

        <FormError>{error}</FormError>

        <button type="submit" disabled={busy || !setup || code.some((d) => d === "")} className="btn-primary mt-6 w-full !py-2.5">
          {busy ? <><Spinner /> Confirming…</> : <>Confirm &amp; continue <span aria-hidden>→</span></>}
        </button>

        <p className="mt-4 text-center text-[13px] text-soot/72">
          Signed in as {user?.email}.{" "}
          <button type="button" onClick={() => signOut()} className="font-medium underline underline-offset-2 hover:text-ink">
            Sign out
          </button>
        </p>
      </form>
    </AuthFrame>
  );
}
