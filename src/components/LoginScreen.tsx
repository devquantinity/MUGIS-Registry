"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CENTRES } from "@/lib/centres";
import { seedUsers } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { ROLE_LABELS, useSession } from "@/lib/session";

/* ---- inline icons ---------------------------------------------------- */
const Shield = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.3-7.5 9.5-4.4-1.2-7.5-4.9-7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const Trail = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21a9 9 0 1 0-9-9" />
    <path d="M3 3v4.5h4.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

/* ---- right-hand visual panel ----------------------------------------- */
function VisualPanel() {
  const { state } = useStore();
  return (
    <div className="relative hidden overflow-hidden bg-forest-500 lg:flex lg:w-1/2">
      <div
        className="mg-drift pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,160,32,0.30) 0%, rgba(224,160,32,0) 70%)" }}
      />
      <div
        className="mg-drift-2 pointer-events-none absolute -bottom-24 left-1/4 h-96 w-96 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,160,32,0.14) 0%, rgba(224,160,32,0) 70%)" }}
      />
      <div
        className="mg-grid-pan pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%)",
        }}
      />
      <div className="mg-spin-slow pointer-events-none absolute -bottom-28 -right-24 opacity-[0.07]">
        <Image src="/mugis-mark.png" alt="" width={420} height={420} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
        <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-gold-400/15 px-3 py-1 text-[13px] font-bold text-gold-300">
          Upper GI Cancer Registry
        </p>
        <h2 className="text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
          Every case,
          <br />
          every centre —
          <br />
          <span className="italic text-gold-400">one national record.</span>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-forest-100/70">
          Structured capture for oesophageal, gastric and GIST cases —
          replacing the logbook and the spreadsheet with one auditable registry.
        </p>

        <div className="mg-float mt-10 w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
              <Shield className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">Confidential by design</p>
              <p className="truncate text-xs text-forest-100/60">
                You see only your own records
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[13px] text-forest-100/60">Cancer types</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">4</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[13px] text-forest-100/60">Centres</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                {CENTRES.length}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 p-3">
            <Trail className="h-4 w-4 shrink-0 text-gold-300" />
            <p className="text-[13px] leading-relaxed text-forest-100/70">
              Every entry and edit is written to an immutable audit trail.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[13px] text-forest-100/60">Patients registered</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{state.patients.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[13px] text-forest-100/60">Episodes recorded</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{state.episodes.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- 6-digit code input — shadcn InputOTP look, no dependency -------- */
function OtpInput({ code, onCode, disabled, onComplete }: {
  code: string[];
  onCode: (next: string[]) => void;
  disabled?: boolean;
  onComplete: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  function commit(next: string[], focusIdx: number | null) {
    onCode(next);
    if (focusIdx !== null) refs.current[Math.max(0, Math.min(5, focusIdx))]?.focus();
    if (next.every((d) => d !== "")) onComplete();
  }

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = d;
    commit(next, d && i < 5 ? i + 1 : null);
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      e.preventDefault();
      const next = [...code];
      next[i - 1] = "";
      commit(next, i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => digits[i] ?? "");
    commit(next, Math.min(digits.length, 5));
  }

  const box = (i: number) => (
    <input
      key={i}
      ref={(el) => { refs.current[i] = el; }}
      value={code[i]}
      onChange={(e) => setDigit(i, e.target.value)}
      onKeyDown={(e) => onKey(i, e)}
      onPaste={onPaste}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      inputMode="numeric"
      autoComplete={i === 0 ? "one-time-code" : "off"}
      aria-label={`Digit ${i + 1}`}
      className="h-12 w-11 rounded-[10px] border border-ink/10 bg-white/80 text-center text-lg font-semibold tabular-nums text-ink transition-colors focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500/15 disabled:opacity-50 dark:bg-white/[0.06] dark:focus:bg-white/[0.09]"
    />
  );

  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map(box)}
      <span aria-hidden className="w-2 text-center text-soot/60">–</span>
      {[3, 4, 5].map(box)}
    </div>
  );
}

/** The centre's demo clinician — the account the email field prefills with. */
function defaultAccount(centreId: string) {
  const users = seedUsers();
  return users.find((u) => u.centreId === centreId && u.role === "clinician")
    ?? users.find((u) => u.role === "clinician")
    ?? users[0];
}

/* ---- the sign-in screen ---------------------------------------------- */
/**
 * DEMO MODE — simulated credentials.
 * Email is prefilled with the centre's demo account, any password passes,
 * and the authenticator step accepts any 6-digit code. Real auth
 * (password + TOTP + httpOnly cookie) replaces this before go-live.
 */
export default function LoginScreen() {
  const { signIn } = useSession();
  const [centreId, setCentreId] = useState(CENTRES[0].id);
  const [email, setEmail] = useState(() => defaultAccount(CENTRES[0].id).email);
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"account" | "code">("account");
  const [code, setCode] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [verifying, setVerifying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  // The account this session signs in as — the typed email when it matches a
  // seeded user, otherwise the centre's demo clinician (so the first screen
  // is never an empty registry). Roles are switched later, from the header.
  const match = seedUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const target = match ?? defaultAccount(centreId);

  function onCentre(id: string) {
    setCentreId(id);
    if (!emailTouched) setEmail(defaultAccount(id).email);
  }

  function enter(e: React.FormEvent) {
    e.preventDefault();
    if (step === "account") {
      if (!email.trim() || !password) return;
      setStep("code");
      return;
    }
    if (code.every((d) => d !== "")) verify();
  }

  // Demo auth — any password and any 6-digit code pass. Live deployment
  // verifies credentials and the enrolled authenticator before issuing
  // a session.
  function verify() {
    if (verifying) return;
    setVerifying(true);
    timer.current = window.setTimeout(() => {
      signIn({ email: target.email, name: target.name, role: target.role, centreId: target.centreId });
    }, 650);
  }

  function back() {
    if (timer.current) window.clearTimeout(timer.current);
    setStep("account");
    setCode(Array.from({ length: 6 }, () => ""));
    setVerifying(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT — brand + one-click entry */}
      <div className="relative flex w-full flex-col overflow-hidden bg-cream lg:w-1/2">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-96 w-[34rem] -translate-x-1/2 rounded-full bg-forest-200/30 blur-[130px]" />
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gold-300/20 blur-[110px]" />
        </div>

        <div className="relative z-10 px-6 pt-6 sm:px-10">
          <Image
            src="/mugis-logo.png"
            alt="MUGIS — Malaysian Upper Gastrointestinal Surgical Society"
            width={560}
            height={150}
            priority
            className="h-11 w-auto"
          />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <form onSubmit={enter} className="mg-fade-up w-full max-w-md">
            {step === "account" ? (
              <div key="account" className="mg-pop">
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                  Welcome
                </h1>
                <p className="mt-1 text-sm text-soot/80">
                  Upper GI Cancer Registry. Sign in to your centre workspace.
                </p>

                <div className="mt-6">
                  <label htmlFor="centre" className="label">Centre</label>
                  <select
                    id="centre"
                    className="input"
                    value={centreId}
                    onChange={(e) => onCentre(e.target.value)}
                  >
                    {CENTRES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@centre.mugis.org.my"
                  />
                </div>

                <div className="mt-4">
                  <label htmlFor="password" className="label">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <p className="mt-1.5 text-[13px] text-soot/72">
                    Prefilled with your centre&rsquo;s demo account — any password is
                    accepted. Your role is switched from the header once inside.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || !password}
                  className="btn-primary mt-6 w-full !py-2.5"
                >
                  Continue
                  <span aria-hidden>→</span>
                </button>

                <p className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-center text-[13px] leading-relaxed text-goldink/70">
                  Demo mode — any password and any 6-digit code are accepted.
                  Live deployment uses admin-invited accounts with
                  authenticator-app 2FA.
                </p>
              </div>
            ) : (
              <div key="code" className="mg-pop">
                <button
                  type="button"
                  onClick={back}
                  className="mb-4 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-soot/75 transition-colors hover:text-ink"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                  </svg>
                  Use a different account
                </button>

                <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                  Two-step verification
                </h1>
                <p className="mt-1 text-sm text-soot/80">
                  Enter the 6-digit code from your authenticator app.
                </p>

                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-ink/[0.06] bg-white/60 py-1 pl-1 pr-3 dark:bg-white/[0.06]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-500 text-[12px] font-bold text-white">
                    {target.name.slice(0, 1)}
                  </span>
                  <span className="truncate text-[14px] text-soot">{target.email}</span>
                  <span className="shrink-0 text-[13px] text-soot/65">· {ROLE_LABELS[target.role]}</span>
                </div>

                <div className="mt-6">
                  <OtpInput code={code} onCode={setCode} disabled={verifying} onComplete={verify} />
                </div>

                <button
                  type="submit"
                  disabled={verifying || code.some((d) => d === "")}
                  className="btn-primary mt-6 w-full !py-2.5"
                >
                  {verifying ? (
                    <>
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify &amp; sign in
                      <span aria-hidden>→</span>
                    </>
                  )}
                </button>

                <p className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-center text-[13px] leading-relaxed text-goldink/70">
                  Demo mode — any 6-digit code is accepted. Lost your device?
                  Contact your registry administrator.
                </p>
              </div>
            )}
          </form>
        </div>

        <p className="relative z-10 px-6 pb-6 text-center text-[13px] text-soot/65 sm:px-10">
          © 2026 Malaysian Upper Gastrointestinal Surgical Society
        </p>
      </div>

      <VisualPanel />
    </div>
  );
}
