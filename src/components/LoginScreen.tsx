"use client";

import Image from "next/image";
import { useState } from "react";
import { CENTRES, findCentre } from "@/lib/centres";
import { seedUsers } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { ROLE_LABELS, useSession, type Role } from "@/lib/session";

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
        <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-gold-400/15 px-3 py-1 text-[11px] font-bold text-gold-300">
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
              <p className="text-[11px] text-forest-100/60">Cancer types</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">4</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[11px] text-forest-100/60">Centres</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">
                {CENTRES.length}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 p-3">
            <Trail className="h-4 w-4 shrink-0 text-gold-300" />
            <p className="text-[11px] leading-relaxed text-forest-100/70">
              Every entry and edit is written to an immutable audit trail.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[11px] text-forest-100/60">Patients registered</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{state.patients.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-[11px] text-forest-100/60">Episodes recorded</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{state.episodes.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- the sign-in screen ---------------------------------------------- */
/**
 * DEMO MODE — no credentials.
 * One click signs you in. Pick a centre and role first to preview how the
 * registry looks for that user. Real auth (password + TOTP + httpOnly
 * cookie) replaces this before go-live.
 */
export default function LoginScreen() {
  const { signIn } = useSession();
  const [centreId, setCentreId] = useState(CENTRES[0].id);
  const [role, setRole] = useState<Role>("clinician");

  const centre = findCentre(centreId);

  function enter(e: React.FormEvent) {
    e.preventDefault();
    // Sign in AS the seeded user for this centre and role, so a Clinician
    // lands on their own populated caseload rather than an empty registry.
    const seeded = seedUsers().find((u) => u.centreId === centreId && u.role === role)
      ?? seedUsers().find((u) => u.role === role);
    signIn({
      email: seeded?.email ?? `demo.${role}@${centre.code.toLowerCase()}.mugis.org.my`,
      name: seeded?.name ?? ROLE_LABELS[role],
      role,
      centreId,
    });
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
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Welcome
            </h1>
            <p className="mt-1 text-sm text-soot/70">
              Upper GI Cancer Registry. Choose a centre and role, then continue.
            </p>

            <div className="mt-6">
              <label htmlFor="centre" className="label">Centre</label>
              <select
                id="centre"
                className="input"
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
              >
                {CENTRES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label htmlFor="role" className="label">Role</label>
              <select
                id="role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-soot/55">
                You sign in as the demo user holding that role, with their existing
                caseload — a Clinician sees only their own entries, a Head of
                Service sees every centre.
              </p>
            </div>

            <button type="submit" className="btn-primary mt-6 w-full !py-2.5">
              Continue
              <span aria-hidden>→</span>
            </button>

            <p className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-center text-[11px] leading-relaxed text-goldink/70">
              Demo mode — no password required. Live deployment uses
              admin-invited accounts with two-factor authentication.
            </p>
          </form>
        </div>

        <p className="relative z-10 px-6 pb-6 text-center text-[11px] text-soot/45 sm:px-10">
          © 2026 Malaysian Upper Gastrointestinal Surgical Society
        </p>
      </div>

      <VisualPanel />
    </div>
  );
}
