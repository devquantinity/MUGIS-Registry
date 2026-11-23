"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, ROLE_LABELS, useSession } from "@/lib/session";
import { api, type AccessRequest, type Patient } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { fmtDate } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle, Stat, StatList, type StatItem } from "@/components/ui";
import { DashboardOverview } from "@/components/DashboardOverview";

type Counts = {
  patients?: number; incoming?: number; outgoing?: number;
  registrations?: number; users?: number; centres?: number;
};

const tico = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  users: tico(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /></>),
  centres: tico(<><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M10 21v-5h4v5" /></>),
};

/** What exists in the API today, and what is still to come. */
const AVAILABLE = [
  "Sign-in with two-factor, registration and account approval",
  "Centres and user administration (System Admin)",
  "Patient demography: register, search, view, edit",
  "Duplicate check by MyKad / passport, and access requests",
  "Cancer records: a form per cancer type, with progress",
  "Data export: Excel, CSV and PDF, encrypted, with an optional password",
];
const COMING = ["Computed staging (AJCC, NIH)", "Reports", "Audit trail"];

/** Overview built only from live API numbers. */
export default function DashboardPage() {
  useTitle("Overview");
  const { session } = useSession();
  const [counts, setCounts] = useState<Counts>({});
  const [recent, setRecent] = useState<Patient[] | null>(null);
  const [waiting, setWaiting] = useState<AccessRequest[] | null>(null);

  const role = session?.role;
  const clinical = !!role && CLINICAL.includes(role);

  useEffect(() => {
    if (!role) return;
    let alive = true;
    const put = (k: keyof Counts) => (n: number) => { if (alive) setCounts((c) => ({ ...c, [k]: n })); };
    const quiet = () => undefined;
    if (clinical) {
      api.patients({ page_size: 5 }).then((r) => { put("patients")(r.page.total); if (alive) setRecent(r.items); }).catch(quiet);
      api.accessRequests({ box: "incoming", status: "pending", page_size: 5 })
        .then((r) => { put("incoming")(r.page.total); if (alive) setWaiting(r.items); }).catch(quiet);
    }
    if (role === "admin") {
      api.registrations({ page_size: 1 }).then((r) => put("registrations")(r.page.total)).catch(quiet);
      api.users({ page_size: 1 }).then((r) => put("users")(r.page.total)).catch(quiet);
      api.adminCentres().then((c) => put("centres")(c.length)).catch(quiet);
    }
    return () => { alive = false; };
  }, [role, clinical]);

  if (!session) return null;
  const n = (v?: number) => (v === undefined ? "…" : v);

  // System Admin only: clinical roles find access requests under the
  // header's notification bell, and the figures in the overview below.
  const stats: StatItem[] = [];
  if (role === "admin") {
    stats.push(
      { href: "/admin/registrations", label: "Registrations to review", value: n(counts.registrations), icon: ICONS.users, tone: counts.registrations ? "warn" : "muted" },
      { href: "/admin/users", label: "Users", value: n(counts.users), icon: ICONS.users },
      { href: "/admin/centres", label: "Centres", value: n(counts.centres), icon: ICONS.centres },
    );
  }

  const build = (
    <>
      <p className="mb-1.5 text-[13px] font-semibold text-sage-700">Available now</p>
      <ul className="mb-3 grid grid-cols-1 gap-1 text-[13.5px] text-ink">{AVAILABLE.map((a) => <li key={a}>✓ {a}</li>)}</ul>
      <p className="mb-1.5 text-[13px] font-semibold text-soot/80">Coming soon</p>
      <ul className="grid grid-cols-1 gap-1 text-[13.5px] text-soot/80">{COMING.map((a) => <li key={a}>· {a}</li>)}</ul>
    </>
  );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.name}`}
        subtitle={`${ROLE_LABELS[session.role]} · ${session.centreName}`}
      />

      {stats.length > 0 && <>
        {/* phone and iPad portrait: one list; from lg, where every label fits on one line: tiles */}
        <StatList items={stats} className="lg:hidden" />
        <div className="hidden gap-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {stats.map((t) => (
            <Link key={t.href + t.label} href={t.href} className="block h-full">
              <Stat label={t.label} value={t.value} icon={t.icon} tone={t.tone} sub={t.sub} />
            </Link>
          ))}
        </div>
      </>}

      {clinical && <DashboardOverview />}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {clinical && (
          <Card className="lg:col-span-2">
            <SectionTitle right={<Link href="/patients" className="text-[13px] font-semibold text-forest-600 touch:-my-3 touch:py-3">All patients</Link>}>Recently updated</SectionTitle>
            {recent === null ? <p className="text-sm text-soot/72">Loading…</p> : recent.length === 0 ? (
              <p className="text-sm text-soot/80">No patients yet. <Link href="/patients/new" className="font-semibold text-forest-600 underline underline-offset-2">Register one</Link>.</p>
            ) : (
              <ul className="divide-y divide-ink/[0.05]">
                {recent.map((p) => (
                  <li key={p.id}>
                    {/* Phones: the name gets the full width, with the registry no. and access under it.
                        From sm one row: registry no., name, access, date (sm:contents lets order apply). */}
                    <Link href={`/patients/${p.id}`} className="block py-2.5 hover:text-forest-600 sm:flex sm:items-center sm:gap-3 sm:py-2">
                      <span className="min-w-0 break-words text-sm font-medium text-ink line-clamp-2 sm:order-2 sm:flex-1 sm:line-clamp-1">{p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                        <span className="font-mono text-[13px] text-soot sm:order-1">{p.registry_no}</span>
                        <Badge tone={ACCESS_LABEL[p.access].tone} className="shrink-0 sm:order-3">{ACCESS_LABEL[p.access].text}</Badge>
                      </span>
                      <span className="hidden text-[13px] text-soot/72 sm:order-4 sm:inline">{fmtDate(p.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {waiting && waiting.length > 0 && (
              <div className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-[13.5px] text-goldink/85">
                {(counts.incoming ?? waiting.length) === 1 ? "1 request is" : `${counts.incoming ?? waiting.length} requests are`} waiting for access to your patients.{" "}
                <Link href="/patients/access-requests" className="font-semibold underline underline-offset-2">Review</Link>
              </div>
            )}
          </Card>
        )}

        {/* phone: tucked away behind one line; it is for testers, not for daily use */}
        <details className="card group sm:hidden">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            What is in this build
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-soot/60 transition-transform group-open:rotate-180" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="px-4 pb-4">{build}</div>
        </details>
        <Card className={"hidden sm:block " + (clinical ? "" : "lg:col-span-3")}>
          <SectionTitle>In this build</SectionTitle>
          {build}
        </Card>
      </div>
    </div>
  );
}
