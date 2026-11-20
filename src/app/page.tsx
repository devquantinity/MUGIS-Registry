"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, ROLE_LABELS, useSession } from "@/lib/session";
import { api, type AccessRequest, type Patient } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { fmtDate } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle, Stat } from "@/components/ui";

type Counts = {
  patients?: number; incoming?: number; outgoing?: number;
  registrations?: number; users?: number; centres?: number;
};

const tico = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  patients: tico(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  inbox: tico(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  send: tico(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>),
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
];
const COMING = ["Computed staging (AJCC, NIH)", "Reports and data export", "Export approvals", "Audit trail"];

/** Overview built only from live API numbers. */
export default function DashboardPage() {
  useTitle("Overview");
  const { session } = useSession();
  const [counts, setCounts] = useState<Counts>({});
  const [recent, setRecent] = useState<Patient[] | null>(null);
  const [waiting, setWaiting] = useState<AccessRequest[] | null>(null);

  const role = session?.role;
  const clinical = !!role && CLINICAL.includes(role);
  const reviewer = role === "admin" || role === "head" || role === "hod";

  useEffect(() => {
    if (!role) return;
    let alive = true;
    const put = (k: keyof Counts) => (n: number) => { if (alive) setCounts((c) => ({ ...c, [k]: n })); };
    const quiet = () => undefined;
    if (clinical) {
      api.patients({ page_size: 5 }).then((r) => { put("patients")(r.page.total); if (alive) setRecent(r.items); }).catch(quiet);
      api.accessRequests({ box: "incoming", status: "pending", page_size: 5 })
        .then((r) => { put("incoming")(r.page.total); if (alive) setWaiting(r.items); }).catch(quiet);
      api.accessRequests({ box: "outgoing", status: "pending", page_size: 1 }).then((r) => put("outgoing")(r.page.total)).catch(quiet);
    }
    if (reviewer) api.registrations({ page_size: 1 }).then((r) => put("registrations")(r.page.total)).catch(quiet);
    if (role === "admin") {
      api.users({ page_size: 1 }).then((r) => put("users")(r.page.total)).catch(quiet);
      api.adminCentres().then((c) => put("centres")(c.length)).catch(quiet);
    }
    return () => { alive = false; };
  }, [role, clinical, reviewer]);

  if (!session) return null;
  const n = (v?: number) => (v === undefined ? "…" : v);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.name}`}
        subtitle={`${ROLE_LABELS[session.role]} · ${session.centreName}`}
      />

      {/* two across on a phone; on a tablet or desktop as many as fit, so three tiles are one row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {clinical && <>
          <Link href="/patients"><Stat label="Patients you can see" value={n(counts.patients)} icon={ICONS.patients} tone="info" /></Link>
          <Link href="/patients/access-requests"><Stat label="Access requests for you" value={n(counts.incoming)} icon={ICONS.inbox} tone={counts.incoming ? "warn" : "muted"} sub="pending your decision" /></Link>
          <Link href="/patients/access-requests?box=outgoing"><Stat label="Your requests" value={n(counts.outgoing)} icon={ICONS.send} sub="still pending" /></Link>
        </>}
        {reviewer && (
          <Link href="/admin/registrations"><Stat label="Registrations to review" value={n(counts.registrations)} icon={ICONS.users} tone={counts.registrations ? "warn" : "muted"} /></Link>
        )}
        {role === "admin" && <>
          <Link href="/admin/users"><Stat label="Users" value={n(counts.users)} icon={ICONS.users} /></Link>
          <Link href="/admin/centres"><Stat label="Centres" value={n(counts.centres)} icon={ICONS.centres} /></Link>
        </>}
      </div>

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
                    {/* phone: name over registry no. — side by side the name is cut to a few letters */}
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-3 py-2.5 hover:text-forest-600 sm:py-2">
                      <span className="flex min-w-0 flex-1 flex-col-reverse sm:flex-row sm:items-center sm:gap-3">
                        <span className="font-mono text-[13px] text-soot">{p.registry_no}</span>
                        <span className="min-w-0 break-words text-sm font-medium text-ink line-clamp-2 sm:flex-1 sm:line-clamp-1">{p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}</span>
                      </span>
                      <Badge tone={ACCESS_LABEL[p.access].tone} className="shrink-0">{ACCESS_LABEL[p.access].text}</Badge>
                      <span className="hidden text-[13px] text-soot/72 sm:inline">{fmtDate(p.updated_at)}</span>
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

        <Card className={clinical ? "" : "lg:col-span-3"}>
          <SectionTitle>In this build</SectionTitle>
          <p className="mb-1.5 text-[13px] font-semibold text-sage-700">Available now</p>
          <ul className="mb-3 grid gap-1 text-[13.5px] text-ink">{AVAILABLE.map((a) => <li key={a}>✓ {a}</li>)}</ul>
          <p className="mb-1.5 text-[13px] font-semibold text-soot/80">Coming soon</p>
          <ul className="grid gap-1 text-[13.5px] text-soot/80">{COMING.map((a) => <li key={a}>· {a}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
