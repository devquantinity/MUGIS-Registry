"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import React, { useMemo, useState } from "react";
import { useScoped, usePatientMap } from "@/lib/useScoped";
import { useSession } from "@/lib/session";
import { CENTRES, findCentre } from "@/lib/centres";
import { requiredFieldIds } from "@/lib/parameters";
import { completeness, deriveStage, STAGE_ORDER, stageTone } from "@/lib/staging";
import { scopeLabel } from "@/lib/access";
import { fmtDate, relTime, ageSex } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { AreaChart, Badge, BarChart, Card, CHART, DonutChart, PageHeader, Progress, RangeFilter, RANGE_MS, SectionTitle, Stat, Table, Td, Th, type TimeRange } from "@/components/ui";

const NOW = new Date("2026-08-08T09:00:00Z").getTime();

const tico = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const TILE_ICONS = {
  patients: tico(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  episodes: tico(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /></>),
  resections: tico(<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />),
  complete: tico(<><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></>),
};

export default function DashboardPage() {
  useTitle("Overview");
  const { ramp } = useTheme();
  const { patients, episodes, session } = useScoped();
  const { state } = useStore();
  const pmap = usePatientMap();
  const { session: sess } = useSession();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);
  const [range, setRange] = useState<TimeRange>("12m");

  /** Episodes inside the selected window, by diagnosis date. */
  const epsR = useMemo(() => {
    const ms = RANGE_MS[range];
    if (ms === null) return episodes;
    const cutoff = NOW - ms;
    return episodes.filter((e) => {
      const t = new Date(String(e.data.dateDiagnosis ?? "")).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [episodes, range]);

  const windows = useMemo(() => {
    const D30 = 30 * 86400000;
    const inWindow = (iso: string, from: number, to: number) => {
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t >= from && t < to;
    };
    const dx = (from: number, to: number) =>
      episodes.filter((e) => inWindow(String(e.data.dateDiagnosis ?? ""), from, to)).length;
    const px = (from: number, to: number) =>
      patients.filter((p) => inWindow(p.createdAt, from, to)).length;
    const sx = (from: number, to: number) =>
      episodes.filter((e) => inWindow(String(e.data.dateSurgery ?? ""), from, to)).length;
    // Counts, not percentages — "+2 in the last 30 days" says more than
    // "-100.0%" when the numbers are single-digit.
    const mk = (cur: number, prev: number, noun: string) => ({
      text: `${cur} ${noun} in last 30 days`,
      tone: (cur > prev ? "up" : cur < prev ? "down" : "flat") as "up" | "down" | "flat",
    });
    return {
      patients: mk(px(NOW - D30, NOW), px(NOW - 2 * D30, NOW - D30), "registered"),
      diagnoses: mk(dx(NOW - D30, NOW), dx(NOW - 2 * D30, NOW - D30), "diagnosed"),
      surgeries: mk(sx(NOW - D30, NOW), sx(NOW - 2 * D30, NOW - D30), "operated"),
    };
  }, [episodes, patients]);

  const stats = useMemo(() => {
    const withSurgery = episodes.filter((e) => e.data.surgery && e.data.surgery !== "No Surgery").length;
    const deaths = episodes.filter((e) => e.data.death === "Yes").length;
    const recur = episodes.filter((e) => e.data.recurrence === "Yes").length;
    const comp = episodes.map((e) => completeness(e.data, req).pct);
    const avgComp = comp.length ? Math.round(comp.reduce((a, b) => a + b, 0) / comp.length) : 0;
    const incomplete = comp.filter((c) => c < 80).length;
    const drafts = episodes.filter((e) => e.status === "draft").length;
    return { withSurgery, deaths, recur, avgComp, incomplete, drafts };
  }, [episodes, req]);

  const stageDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of epsR) {
      const s = deriveStage(e.data).stage ?? "Not derived";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const ordered = [...STAGE_ORDER, "Not derived"];
    return ordered.filter((s) => counts.has(s)).map((s) => ({ label: s === "Not derived" ? s : `Stage ${s}`, value: counts.get(s)! }));
  }, [epsR]);

  const byCentre = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of epsR) counts.set(e.centreId, (counts.get(e.centreId) ?? 0) + 1);
    return CENTRES.filter((c) => counts.has(c.id))
      .map((c) => ({ label: c.code, value: counts.get(c.id)! }))
      .sort((a, b) => b.value - a.value);
  }, [epsR]);

  const byApproach = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of epsR) {
      const m = String(e.data.method ?? "");
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [epsR]);

  const byPresentation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of epsR) {
      const v = String(e.data.firstPresentation ?? "");
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [epsR]);

  const monthly = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const ref = new Date(NOW);
    const months = range === "3m" ? 3 : range === "6m" ? 6 : range === "12m" ? 12 : 24;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short" }) + (d.getMonth() === 0 ? ` \u2019${String(d.getFullYear()).slice(2)}` : "");
      out.push({ label, value: episodes.filter((e) => String(e.data.dateDiagnosis ?? "").startsWith(key)).length });
    }
    return out;
  }, [episodes, range]);

  const recent = useMemo(
    () => [...episodes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6),
    [episodes]
  );

  const myAudit = useMemo(
    () => state.audit.filter((a) => !sess || sess.role === "admin" || sess.role === "head" || a.userEmail === sess.email).slice(0, 6),
    [state.audit, sess]
  );

  if (!session) return null;

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <PageHeader
        title="Overview"
        subtitle={`${findCentre(session.centreId).name} · ${scopeLabel(session.role)}`}
        actions={
          <>
            <RangeFilter value={range} onChange={setRange} />
            <Link href="/patients/new" className="btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              New patient
            </Link>
            <Link href="/reports" className="btn-secondary">Reports</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Patients" value={patients.length} chip={windows.patients} tone="info" icon={TILE_ICONS.patients} />
        <Stat label="Cancer episodes" value={episodes.length} chip={windows.diagnoses} tone="info" icon={TILE_ICONS.episodes} />
        <Stat label="Resections performed" value={stats.withSurgery} chip={windows.surgeries} tone="ok" icon={TILE_ICONS.resections} />
        <Stat label="Average completeness" value={`${stats.avgComp}%`}
          sub={`${stats.incomplete} records below 80%`} tone={stats.avgComp >= 80 ? "ok" : "warn"} icon={TILE_ICONS.complete} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-5">
          <SectionTitle right={<Badge tone="muted">by diagnosis date</Badge>}>{`New diagnoses — ${range === "all" ? "24" : range.replace("m", "")} months`}</SectionTitle>
          <AreaChart data={monthly} height={150} />
        </Card>
        <Card className="min-w-0 xl:col-span-4">
          <SectionTitle right={<Badge tone="info">AJCC 8th ed.</Badge>}>Stage distribution</SectionTitle>
          {stageDist.length ? (
            <BarChart
              data={stageDist}
              height={150}
              color={(d, i) =>
                d.label === "Not derived"
                  ? CHART.other
                  : ramp(stageDist.length <= 1 ? 1 : i / (stageDist.length - 1))}
            />
          ) :
            <p className="py-8 text-center text-sm text-soot/60">No episodes to chart yet.</p>}
        </Card>
        <Card className="min-w-0 xl:col-span-3">
          <SectionTitle>Surgical approach</SectionTitle>
          {byApproach.length ? <DonutChart data={byApproach} unit="operations" size={126} stacked /> :
            <p className="py-8 text-center text-sm text-soot/60">No operative data yet.</p>}
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle right={<Badge tone="muted">{range === "all" ? "all time" : `last ${range.replace("m", "")} months`}</Badge>}>
            Episodes by centre
          </SectionTitle>
          {byCentre.length ? <BarChart data={byCentre} height={150} /> :
            <p className="py-6 text-center text-sm text-soot/60">No diagnoses in this window.</p>}
        </Card>
        <Card>
          <SectionTitle right={<Badge tone="muted">{range === "all" ? "all time" : `last ${range.replace("m", "")} months`}</Badge>}>
            Presenting complaint
          </SectionTitle>
          {byPresentation.length ? <BarChart data={byPresentation} height={150} /> :
            <p className="py-6 text-center text-sm text-soot/60">No diagnoses in this window.</p>}
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle right={<Link href="/episodes" className="text-xs font-semibold text-forest-500 hover:text-forest-600">View all →</Link>}>
          Recently updated
        </SectionTitle>
        {recent.length ? (
          <Table head={
            <tr>
              <Th>Registry no.</Th><Th>Patient</Th><Th>Stage</Th>
              <Th align="center">Completeness</Th><Th>Updated</Th>
            </tr>
          }>
            {recent.map((e) => {
              const p = pmap.get(e.patientId);
              const st = deriveStage(e.data);
              const c = completeness(e.data, req);
              return (
                <tr key={e.id} className="hover:bg-cream/50">
                  <Td><Link href={`/episodes/${e.id}`} className="font-semibold text-forest-500 hover:underline">{p?.registryNo ?? "—"}</Link></Td>
                  <Td>
                    <span className="font-medium text-ink">{p?.fullName ?? "—"}</span>
                    <span className="ml-2 text-[11px] text-soot/55">
                      {p ? ageSex(p.dob, p.sex) : ""}
                    </span>
                  </Td>
                  <Td><Badge tone={stageTone(st.stage)}>{st.stage ? `Stage ${st.stage}` : "—"}</Badge></Td>
                  <Td align="center">
                    <div className="mx-auto w-24">
                      <Progress value={c.pct} tone={c.pct >= 80 ? "info" : c.pct >= 50 ? "warn" : "bad"} />
                      <span className="mt-1 block text-[10px] tabular-nums text-soot/60">{c.pct}%</span>
                    </div>
                  </Td>
                  <Td><span className="text-xs text-soot/70">{relTime(e.updatedAt, NOW)}</span></Td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Card><p className="py-6 text-center text-sm text-soot/60">No episodes visible to you yet.</p></Card>
        )}
      </div>

      <div className="mt-6">
        <SectionTitle>Recent activity</SectionTitle>
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {myAudit.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Badge tone={a.action === "create" ? "ok" : a.action === "delete" ? "bad" : a.action === "export" ? "gold" : "info"}>
                  {a.action}
                </Badge>
                <span className="flex-1 truncate text-sm text-ink">{a.entityLabel}</span>
                <span className="hidden text-[11px] text-soot/55 sm:inline">{a.userEmail}</span>
                <span className="text-[11px] tabular-nums text-soot/50">{fmtDate(a.at)}</span>
              </li>
            ))}
            {myAudit.length === 0 && <li className="px-4 py-6 text-center text-sm text-soot/60">No activity recorded.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
