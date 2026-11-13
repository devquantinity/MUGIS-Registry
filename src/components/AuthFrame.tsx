"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

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
  const [centres, setCentres] = useState<number | null>(null);
  useEffect(() => {
    api.centres().then((c) => setCentres(c.length)).catch(() => setCentres(null));
  }, []);
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
                {centres ?? "—"}
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

/* ---- the frame every signed-out screen shares ------------------------- */
export default function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative flex w-full flex-col overflow-hidden bg-cream lg:w-1/2">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-96 w-[34rem] -translate-x-1/2 rounded-full bg-forest-200/30 blur-[130px]" />
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gold-300/20 blur-[110px]" />
        </div>

        <div className="relative z-10 px-6 pt-6 sm:px-10">
          <Link href="/">
            <Image
              src="/mugis-logo.png"
              alt="MUGIS — Malaysian Upper Gastrointestinal Surgical Society"
              width={560}
              height={150}
              priority
              className="h-11 w-auto"
            />
          </Link>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="mg-fade-up w-full max-w-md">{children}</div>
        </div>

        <p className="relative z-10 px-6 pb-6 text-center text-[13px] text-soot/65 sm:px-10">
          © 2026 Malaysian Upper Gastrointestinal Surgical Society
        </p>
      </div>

      <VisualPanel />
    </div>
  );
}

/* ---- small shared pieces --------------------------------------------- */
export function FormError({ children }: { children: React.ReactNode }) {
  // Children may be [null, false]; toArray drops those, so render only real content.
  if (!React.Children.toArray(children).some((c) => c !== "")) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] leading-relaxed text-danger-700">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-[13.5px] leading-relaxed text-goldink/80">
      {children}
    </p>
  );
}

export function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Reads one query parameter after mount (no Suspense boundary needed). */
export function useQueryParam(name: string): string | null | undefined {
  const [v, setV] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setV(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return v;
}

/** Password rules, as the backend enforces them. */
export function passwordProblems(p: string): string[] {
  const out: string[] = [];
  if (p.length < 12) out.push("at least 12 characters");
  if (!/[A-Z]/.test(p)) out.push("an uppercase letter");
  if (!/[a-z]/.test(p)) out.push("a lowercase letter");
  if (!/[0-9]/.test(p)) out.push("a number");
  return out;
}
