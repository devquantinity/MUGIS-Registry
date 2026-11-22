"use client";

/**
 * Registry overview for the clinical roles: patients, average completeness,
 * new diagnoses and surgical approach, grouped by hospital (default) or by
 * the doctor who added the patients.
 *
 * Every number comes from the API, which counts only the patients the viewer
 * could open in the patient list (row-level security). Nothing personal is
 * shown: groups are hospitals or doctors.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  api, API_ROLE_LABELS, ApiError,
  type ApiRole, type CancerType, type DashboardGroup, type DashboardGroupBy,
  type DashboardOverview as Overview, type NewDiagnoses, type SurgicalApproach,
} from "@/lib/api";
import { CHART, Card, DonutChart, HBar, SectionTitle } from "@/components/ui";
import { Select } from "@/components/Select";

/** Categorical hues for groups, in fixed order; a fifth group and on fold into Other. */
const GROUP_HUES = CHART.cat;

const APPROACHES: { key: keyof SurgicalApproach; label: string; color: string }[] = [
  { key: "open", label: "Open", color: CHART.cat[0] },
  { key: "laparoscopic", label: "Laparoscopic", color: CHART.cat[1] },
  { key: "robotic", label: "Robotic", color: CHART.cat[2] },
  { key: "no_surgery", label: "No surgery", color: CHART.cat[3] },
  { key: "not_recorded", label: "Not recorded", color: CHART.other },
];

const SHOWN = 8; // groups listed before "Show all"

function groupName(g: { label: string; sub: string }, by: DashboardGroupBy) {
  if (by === "centre") return g.label;
  return `${g.label} · ${API_ROLE_LABELS[g.sub as ApiRole] ?? g.sub}`;
}

function monthLabel(ym: string, i: number) {
  const [y, m] = ym.split("-").map(Number);
  const short = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return i === 0 || m === 1 ? `${short} ${String(y).slice(2)}` : short;
}

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : "Could not load the figures.";
}

export function DashboardOverview() {
  const [by, setBy] = useState<DashboardGroupBy>("centre");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOverview(null);
    setError(null);
    api.dashboardOverview(by)
      .then((o) => { if (alive) setOverview(o); })
      .catch((e) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, [by]);

  // Colour follows the group, not its rank in a chart: fixed from the
  // overview's order (most patients first), so filtering diagnoses by cancer
  // type never repaints a hospital.
  const hueOf = useMemo(() => {
    const m = new Map<string, string>();
    overview?.groups.slice(0, GROUP_HUES.length).forEach((g, i) => m.set(g.id, GROUP_HUES[i]));
    return (id: string) => m.get(id);
  }, [overview]);

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Registry overview</h2>
          <p className="text-[13px] text-soot/72">Patients you can see, {by === "centre" ? "by hospital" : "by the doctor who added them"}</p>
        </div>
        <Segmented
          value={by}
          onChange={setBy}
          options={[["centre", "By hospital"], ["individual", "Yours"]]}
          ariaLabel="Group figures"
        />
      </div>

      {error && <Card><p className="text-sm text-danger-700">{error}</p></Card>}

      {!error && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PatientsCard overview={overview} by={by} />
          <CompletenessCard overview={overview} by={by} />
          <NewDiagnosesCard by={by} hueOf={hueOf} ready={!!overview} />
          <SurgicalApproachCard overview={overview} by={by} />
        </div>
      )}
    </section>
  );
}

/* ---------------- cards ---------------- */

function Headline({ value, unit }: { value: React.ReactNode; unit: string }) {
  return (
    <p className="mb-3 flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold leading-none tabular-nums tracking-[-0.01em] text-ink">{value}</span>
      <span className="text-[13px] text-soot/72">{unit}</span>
    </p>
  );
}

function Loading() {
  return <p className="text-sm text-soot/72">Loading…</p>;
}

/** The first SHOWN rows, with a toggle for the rest. */
function useShowAll<T>(rows: T[]) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const toggle = rows.length > SHOWN ? (
    <button onClick={() => setAll(!all)} className="mt-2 text-[13px] font-semibold text-forest-600 touch:py-2">
      {all ? "Show fewer" : `Show all ${rows.length}`}
    </button>
  ) : null;
  return { shown, toggle };
}

function PatientsCard({ overview, by }: { overview: Overview | null; by: DashboardGroupBy }) {
  const { shown, toggle } = useShowAll(overview?.groups ?? []);
  return (
    <Card>
      <SectionTitle>Number of patients</SectionTitle>
      {!overview ? <Loading /> : (
        <>
          <Headline value={overview.totals.patients} unit={overview.totals.patients === 1 ? "patient" : "patients"} />
          {overview.groups.length === 0 ? <p className="text-sm text-soot/80">No patients yet.</p> : (
            <HBar data={shown.map((g) => ({ label: groupName(g, by), value: g.patients }))} />
          )}
          {toggle}
        </>
      )}
    </Card>
  );
}

function CompletenessCard({ overview, by }: { overview: Overview | null; by: DashboardGroupBy }) {
  const withRecords = (overview?.groups ?? []).filter((g) => g.average_completeness !== null);
  const { shown, toggle } = useShowAll(withRecords);
  const pct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <Card>
      <SectionTitle>Average completeness</SectionTitle>
      {!overview ? <Loading /> : (
        <>
          <Headline
            value={overview.totals.average_completeness === null ? "—" : pct(overview.totals.average_completeness)}
            unit={`across ${overview.totals.cancer_records} cancer ${overview.totals.cancer_records === 1 ? "record" : "records"}`}
          />
          {withRecords.length === 0 ? <p className="text-sm text-soot/80">No cancer records yet.</p> : (
            <HBar max={100} format={pct}
              data={shown.map((g) => ({ label: `${groupName(g, by)} (${g.cancer_records})`, value: g.average_completeness ?? 0 }))} />
          )}
          {toggle}
          <p className="mt-2 text-[12.5px] text-soot/65">Share of each record&apos;s form fields answered, against the current form.</p>
        </>
      )}
    </Card>
  );
}

function NewDiagnosesCard({ by, hueOf, ready }: {
  by: DashboardGroupBy; hueOf: (id: string) => string | undefined; ready: boolean;
}) {
  const [types, setTypes] = useState<CancerType[]>([]);
  const [type, setType] = useState("");
  const [data, setData] = useState<NewDiagnoses | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.cancerTypes().then(setTypes).catch(() => undefined); }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.newDiagnoses({ group_by: by, cancer_type: type || undefined })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, [by, type]);

  // Up to four groups keep their own hue; the rest fold into Other.
  const series = useMemo(() => {
    if (!data || !ready) return [];
    const own = data.groups.filter((g) => hueOf(g.id));
    const rest = data.groups.filter((g) => !hueOf(g.id));
    const out = own.map((g) => ({ name: groupName(g, by), color: hueOf(g.id)!, counts: g.counts }));
    if (rest.length) {
      out.push({
        name: rest.length === 1 ? groupName(rest[0], by) : `Other (${rest.length})`,
        color: CHART.other,
        counts: data.months.map((_, i) => rest.reduce((s, g) => s + g.counts[i], 0)),
      });
    }
    return out;
  }, [data, ready, hueOf, by]);

  return (
    <Card className="lg:col-span-2">
      <SectionTitle right={
        <div className="w-[min(16rem,55vw)]">
          <Select ariaLabel="Cancer type" value={type} onChange={setType} size="sm"
            options={[{ value: "", label: "All cancer types" }, ...types.map((t) => ({ value: t.code, label: t.name }))]} />
        </div>
      }>New diagnoses</SectionTitle>
      {error ? <p className="text-sm text-danger-700">{error}</p> : !data || !ready ? <Loading /> : (
        <>
          <Headline value={data.total} unit="in the last 12 months, by date of diagnosis" />
          <StackedColumns months={data.months} totals={data.counts} series={series} />
          {data.undated > 0 && (
            <p className="mt-2 text-[12.5px] text-soot/65">
              {data.undated} {data.undated === 1 ? "record has" : "records have"} no date of diagnosis yet and {data.undated === 1 ? "is" : "are"} not counted.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function SurgicalApproachCard({ overview, by }: { overview: Overview | null; by: DashboardGroupBy }) {
  const rows = (overview?.groups ?? []).filter((g) => g.cancer_records > 0);
  const { shown, toggle } = useShowAll(rows);
  return (
    <Card className="lg:col-span-2">
      <SectionTitle>Surgical approach</SectionTitle>
      {!overview ? <Loading /> : overview.totals.cancer_records === 0 ? <p className="text-sm text-soot/80">No cancer records yet.</p> : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <DonutChart unit="records" stacked
            palette={APPROACHES.map((a) => a.color)}
            data={APPROACHES.map((a) => ({ label: a.label, value: overview.totals.surgical_approach[a.key] }))} />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-soot/80">{by === "centre" ? "By hospital" : "Yours"}</p>
            <ul className="space-y-2.5">
              {shown.map((g) => <ApproachRow key={g.id} group={g} name={groupName(g, by)} />)}
            </ul>
            {toggle}
            <p className="mt-3 text-[12.5px] text-soot/65">Laparotomy (oesophageal forms) is counted as open.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

/** One group's records as a 100% bar, a 2px gap between segments. */
function ApproachRow({ group, name }: { group: DashboardGroup; name: string }) {
  const total = group.cancer_records;
  const parts = APPROACHES.map((a) => ({ ...a, n: group.surgical_approach[a.key] })).filter((p) => p.n > 0);
  const summary = parts.map((p) => `${p.label} ${p.n}`).join(", ");
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-soot">{name}</span>
        <span className="text-xs font-bold tabular-nums text-ink">{total}</span>
      </div>
      <div className="flex h-[10px] w-full gap-[2px]" role="img" aria-label={`${name}: ${summary}`}>
        {parts.map((p) => (
          <div key={p.key} className="group relative h-full first:rounded-l-full last:rounded-r-full transition-[filter] hover:brightness-[0.9]"
            style={{ width: `${(p.n / total) * 100}%`, background: p.color, minWidth: 3 }}>
            <span className="pointer-events-none absolute bottom-[14px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[12px] font-semibold text-paper opacity-0 shadow-raised transition-opacity group-hover:opacity-100">
              {p.label} · {p.n} ({Math.round((p.n / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </li>
  );
}

/* ---------------- charts ---------------- */

/**
 * Monthly columns stacked by group. Hovering a month shows every group's
 * count; a hidden table carries the same numbers for screen readers.
 */
function StackedColumns({ months, totals, series, height = 170 }: {
  months: string[];
  totals: number[];
  series: { name: string; color: string; counts: number[] }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...totals);
  const plotH = height - 24; // room for the value chip

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-xs text-soot">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />{s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="relative" style={{ height }} aria-hidden>
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ bottom: plotH * f }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-line" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-[6px]" style={{ height }}>
          {months.map((m, i) => {
            const colH = totals[i] === 0 ? 0 : Math.max(4, (totals[i] / max) * plotH);
            return (
              <div key={m} className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {hover === i && (
                  <div className="pointer-events-none absolute z-10 min-w-[9rem] rounded-xl bg-ink px-3 py-2 text-[12px] text-paper shadow-raised"
                    style={{ bottom: colH + 8, ...(i > months.length / 2 ? { right: 0 } : { left: 0 }) }}>
                    <p className="mb-1 font-semibold">{monthLabel(m, 0)} · {totals[i]}</p>
                    {series.filter((s) => s.counts[i] > 0).map((s) => (
                      <p key={s.name} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="tabular-nums">{s.counts[i]}</span>
                      </p>
                    ))}
                  </div>
                )}
                <div className={"flex w-full max-w-[34px] flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] " + (hover === i ? "brightness-[0.92]" : "")}
                  style={{ height: colH }}>
                  {series.map((s) => s.counts[i] > 0 && (
                    <div key={s.name} style={{ flexGrow: s.counts[i], flexBasis: 0, background: s.color, minHeight: 2 }} />
                  ))}
                </div>
                {totals[i] > 0 && hover !== i && (
                  <span className="pointer-events-none absolute text-[11px] font-semibold tabular-nums text-soot" style={{ bottom: colH + 3 }}>
                    {totals[i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[6px]" aria-hidden>
        {months.map((m, i) => (
          <p key={m} className="flex-1 truncate text-center text-[11.5px] text-soot/72">{monthLabel(m, i)}</p>
        ))}
      </div>
      {/* A table ignores sr-only's clipping: the wrapper does it. */}
      <div className="sr-only"><table>
        <caption>New diagnoses per month</caption>
        <thead><tr><th>Month</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}<th>Total</th></tr></thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}><td>{m}</td>{series.map((s) => <td key={s.name}>{s.counts[i]}</td>)}<td>{totals[i]}</td></tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T; onChange: (v: T) => void; options: [T, string][]; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel}
      className="inline-flex items-center rounded-[10px] border border-white/60 bg-white/60 p-0.5 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.06]">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={"rounded-[8px] px-3 py-1 text-[14px] font-medium transition-colors touch:py-2 " +
            (value === v ? "bg-forest-500 text-white" : "text-soot/72 hover:text-ink")}>
          {l}
        </button>
      ))}
    </div>
  );
}
