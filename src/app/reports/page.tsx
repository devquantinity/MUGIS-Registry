"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { useMemo, useState } from "react";
import { useScoped, usePatientMap } from "@/lib/useScoped";
import { CENTRES } from "@/lib/centres";
import { requiredFieldIds } from "@/lib/parameters";
import { completeness, deriveStage, cciScore, STAGE_ORDER } from "@/lib/staging";
import { canExport } from "@/lib/access";
import { ageFrom, toCsv, download } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { BarChart, Card, CHART, DonutChart, HBar, PageHeader, RangeFilter, RANGE_MS, SectionTitle, Stat, Table, Td, Th, Toast, type TimeRange } from "@/components/ui";

function tally(items: string[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const i of items) if (i) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export default function ReportsPage() {
  useTitle("Reports");
  const { ramp } = useTheme();
  const { episodes, patients, session } = useScoped();
  const pmap = usePatientMap();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);
  const [centre, setCentre] = useState("all");
  const [range, setRange] = useState<TimeRange>("12m");
  const [toast, setToast] = useState<string | null>(null);

  const NOW_MS = new Date("2026-08-08T09:00:00Z").getTime();
  const eps = useMemo(() => {
    let out = centre === "all" ? episodes : episodes.filter((e) => e.centreId === centre);
    const ms = RANGE_MS[range];
    if (ms !== null) {
      const cutoff = NOW_MS - ms;
      out = out.filter((e) => {
        const t = new Date(String(e.data.dateDiagnosis ?? "")).getTime();
        return Number.isFinite(t) && t >= cutoff;
      });
    }
    return out;
  }, [episodes, centre, range, NOW_MS]);

  const m = useMemo(() => {
    const resected = eps.filter((e) => e.data.surgery && e.data.surgery !== "No Surgery");
    const nodeCounts = resected.map((e) => Number(e.data.nodeHarvested ?? 0)).filter((n) => n > 0);
    const adequateNodes = nodeCounts.filter((n) => n >= 16).length;
    const r0 = resected.filter((e) =>
      e.data.proximalMargin === "Negative" && e.data.distalMargin === "Negative" && e.data.circMargin === "Negative").length;
    const majorComp = resected.filter((e) => ["IIIA", "IIIB", "IVA", "IVB", "V"].includes(String(e.data.cd30 ?? ""))).length;
    const mortality30 = resected.filter((e) => e.data.cd30 === "V").length;
    const neoadj = eps.filter((e) => e.data.neoadjChemo === "Yes").length;
    const mis = resected.filter((e) => ["Laparoscopic", "Robotic"].includes(String(e.data.method ?? ""))).length;
    const opTimes = resected.map((e) => Number(e.data.opTime ?? 0)).filter((n) => n > 0);
    const ebls = resected.map((e) => Number(e.data.ebl ?? 0)).filter((n) => n > 0);
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
    const deaths = eps.filter((e) => e.data.death === "Yes").length;
    const cancerDeaths = eps.filter((e) => e.data.causeOfDeath === "Cancer Related").length;
    const recur = eps.filter((e) => e.data.recurrence === "Yes").length;
    return {
      resected: resected.length, adequateNodes, nodeMedian: avg(nodeCounts), r0, majorComp, mortality30,
      neoadj, mis, avgOp: avg(opTimes), avgEbl: avg(ebls), deaths, cancerDeaths, recur,
    };
  }, [eps]);

  const stageData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of eps) counts.set(deriveStage(e.data).stage ?? "Not derived", (counts.get(deriveStage(e.data).stage ?? "Not derived") ?? 0) + 1);
    return [...STAGE_ORDER, "Not derived"].filter((s) => counts.has(s))
      .map((s) => ({ label: s === "Not derived" ? "n/d" : s, value: counts.get(s)! }));
  }, [eps]);

  const ageBands = useMemo(() => {
    const bands = [["<40", 0, 39], ["40–49", 40, 49], ["50–59", 50, 59], ["60–69", 60, 69], ["70–79", 70, 79], ["80+", 80, 200]] as const;
    return bands.map(([label, lo, hi]) => ({
      label,
      value: eps.filter((e) => {
        const p = pmap.get(e.patientId);
        const a = p ? ageFrom(p.dob) : null;
        return a !== null && a >= lo && a <= hi;
      }).length,
    }));
  }, [eps, pmap]);

  const cciBands = useMemo(() => {
    const out = [{ label: "0–2 Low", value: 0 }, { label: "3–4 Moderate", value: 0 }, { label: "5+ High", value: 0 }];
    for (const e of eps) {
      const p = pmap.get(e.patientId);
      const s = cciScore(e.data, p?.dob).score;
      out[s >= 5 ? 2 : s >= 3 ? 1 : 0].value++;
    }
    return out;
  }, [eps, pmap]);

  const byCentreTable = useMemo(() => {
    const ms = RANGE_MS[range];
    const cutoff = ms === null ? null : NOW_MS - ms;
    const inRange = (e: (typeof episodes)[number]) => {
      if (cutoff === null) return true;
      const t = new Date(String(e.data.dateDiagnosis ?? "")).getTime();
      return Number.isFinite(t) && t >= cutoff;
    };
    return CENTRES.map((c) => {
      const list = episodes.filter((e) => e.centreId === c.id && inRange(e));
      const res = list.filter((e) => e.data.surgery && e.data.surgery !== "No Surgery");
      const comp = list.map((e) => completeness(e.data, req).pct);
      return {
        centre: c,
        episodes: list.length,
        resections: res.length,
        mis: res.filter((e) => ["Laparoscopic", "Robotic"].includes(String(e.data.method ?? ""))).length,
        avgComplete: comp.length ? Math.round(comp.reduce((a, b) => a + b, 0) / comp.length) : 0,
      };
    }).filter((r) => r.episodes > 0).sort((a, b) => b.episodes - a.episodes);
  }, [episodes, req, range, NOW_MS]);

  function exportSummary() {
    const rows: (string | number)[][] = [
      ["Episodes", eps.length], ["Resections", m.resected],
      ["Minimally invasive", m.mis], ["R0 resections", m.r0],
      ["Adequate nodal yield (>=16)", m.adequateNodes], ["Mean nodes harvested", m.nodeMedian],
      ["Neoadjuvant given", m.neoadj], ["Major complication (CD >=IIIA)", m.majorComp],
      ["30-day mortality", m.mortality30], ["Recurrence", m.recur],
      ["Deaths", m.deaths], ["Cancer-related deaths", m.cancerDeaths],
      ["Mean operating time (min)", m.avgOp], ["Mean EBL (ml)", m.avgEbl],
    ];
    download(`mugis-audit-summary-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Metric", "Value"], rows));
    setToast("Audit summary exported");
  }

  if (!session) return null;
  const pctOf = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <PageHeader
        title="Reports"
        subtitle={`${eps.length} episodes · ${patients.length} patients in scope`}
        actions={
          <>
            <RangeFilter value={range} onChange={setRange} />
            <select className="input !w-auto !py-1.5 text-xs" value={centre} onChange={(e) => setCentre(e.target.value)}>
              <option value="all">All centres</option>
              {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {canExport(session) && <button onClick={exportSummary} className="btn-secondary">Export summary</button>}
            {canExport(session) && <Link href="/reports/export" className="btn-primary">Data export</Link>}
          </>
        }
      />

      <SectionTitle>Operative audit</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Resections" value={m.resected} sub={`${pctOf(m.resected, eps.length)} of episodes`} tone="ok" />
        <Stat label="R0 resection rate" value={pctOf(m.r0, m.resected)} sub={`${m.r0} of ${m.resected}`} tone="ok" />
        <Stat label="Adequate nodal yield" value={pctOf(m.adequateNodes, m.resected)} sub="≥16 nodes harvested" tone={m.adequateNodes / Math.max(1, m.resected) > 0.6 ? "ok" : "warn"} />
        <Stat label="30-day mortality" value={pctOf(m.mortality30, m.resected)} sub={`${m.mortality30} Clavien-Dindo V`} tone={m.mortality30 === 0 ? "ok" : "bad"} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Minimally invasive" value={pctOf(m.mis, m.resected)} sub={`${m.mis} lap or robotic`} tone="info" />
        <Stat label="Major complications" value={pctOf(m.majorComp, m.resected)} sub="Clavien-Dindo ≥ IIIA" tone={m.majorComp / Math.max(1, m.resected) < 0.15 ? "ok" : "warn"} />
        <Stat label="Mean operating time" value={`${m.avgOp} min`} tone="muted" />
        <Stat label="Mean blood loss" value={`${m.avgEbl} ml`} tone="muted" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Stage at diagnosis</SectionTitle>
          {stageData.length ? (
            <BarChart
              data={stageData}
              color={(d, i) =>
                d.label === "n/d" ? CHART.other
                  : ramp(stageData.length <= 1 ? 1 : i / (stageData.length - 1))}
            />
          ) : <p className="py-8 text-center text-sm text-soot/60">No data.</p>}
        </Card>
        <Card>
          <SectionTitle>Age distribution</SectionTitle>
          <BarChart data={ageBands} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle>Comorbidity burden</SectionTitle>
          <DonutChart data={cciBands} unit="patients" size={148} palette={[CHART.status.ok, CHART.status.warn, CHART.status.bad]} />
        </Card>
        <Card>
          <SectionTitle>Tumour location</SectionTitle>
          <HBar data={tally(eps.map((e) => String(e.data.specLocation || e.data.tumourLocation || ""))).slice(0, 6)} />
        </Card>
        <Card>
          <SectionTitle>Lymph node dissection</SectionTitle>
          <HBar data={tally(eps.map((e) => String(e.data.lnDissection ?? ""))).slice(0, 6)} />
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle>Outcome</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Neoadjuvant given" value={pctOf(m.neoadj, eps.length)} sub={`${m.neoadj} episodes`} tone="info" />
          <Stat label="Recurrence recorded" value={m.recur} sub={pctOf(m.recur, eps.length)} tone="warn" />
          <Stat label="Deaths" value={m.deaths} sub={pctOf(m.deaths, eps.length)} tone="bad" />
          <Stat label="Cancer-related deaths" value={m.cancerDeaths} sub={pctOf(m.cancerDeaths, Math.max(1, m.deaths)) + " of deaths"} tone="bad" />
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>By centre</SectionTitle>
        <Table head={
          <tr>
            <Th>Centre</Th><Th align="center">Episodes</Th><Th align="center">Resections</Th>
            <Th align="center">Minimally invasive</Th><Th align="center">Avg completeness</Th>
          </tr>
        } minWidth={700}>
          {byCentreTable.map((r) => (
            <tr key={r.centre.id} className="hover:bg-cream/50">
              <Td><span className="font-medium text-ink">{r.centre.name}</span>
                <span className="ml-2 text-[11px] text-soot/55">{r.centre.state}</span></Td>
              <Td align="center"><span className="tabular-nums">{r.episodes}</span></Td>
              <Td align="center"><span className="tabular-nums">{r.resections}</span></Td>
              <Td align="center"><span className="tabular-nums">{r.mis}</span></Td>
              <Td align="center"><span className="tabular-nums">{r.avgComplete}%</span></Td>
            </tr>
          ))}
          {byCentreTable.length === 0 && <tr><Td><span className="text-sm text-soot/60">No data in scope.</span></Td></tr>}
        </Table>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
