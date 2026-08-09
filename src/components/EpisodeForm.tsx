"use client";

import { useMemo, useState } from "react";
import type { Field, Group } from "@/lib/parameters";
import { schemaFor, requiredFieldIds } from "@/lib/parameters";
import type { EpisodeData, Patient } from "@/lib/types";
import { bmi, bmiBand, cciScore, completeness, computedValue, deriveStage, derivePN, pnRule, stageTone } from "@/lib/staging";
import { Badge, Card, Progress } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";

function visible(f: Field, d: EpisodeData): boolean {
  if (!f.showIf) return true;
  return f.showIf.equals.includes(String(d[f.showIf.field] ?? ""));
}

function FieldInput({ f, value, onChange, disabled }: {
  f: Field; value: string | number | null; onChange: (v: string | number | null) => void; disabled?: boolean;
}) {
  const v = value ?? "";
  if (f.type === "select") {
    return (
      <select className="input" value={String(v)} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">— not recorded —</option>
        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "textarea") {
    return (
      <textarea className="input min-h-[68px] resize-y" value={String(v)} disabled={disabled}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (f.type === "number") {
    return (
      <div className="relative">
        <input type="number" className="input pr-12" value={String(v)} disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
        {f.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-soot/50">{f.unit}</span>}
      </div>
    );
  }
  if (f.type === "date") {
    return <DatePicker value={String(v)} disabled={disabled} onChange={(iso) => onChange(iso)} />;
  }
  return <input type="text" className="input" value={String(v)} disabled={disabled}
    onChange={(e) => onChange(e.target.value)} />;
}

function ComputedField({ f, data, patient }: { f: Field; data: EpisodeData; patient?: Patient }) {
  const raw = computedValue(f.computed!, data, patient?.dob);

  if (f.computed === "ajcc") {
    const s = deriveStage(data);
    return (
      <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5">
        <Badge tone={stageTone(s.stage)} className="text-[13px] !px-2.5 !py-1">
          {s.stage ? `Stage ${s.stage}` : "Not derivable"}
        </Badge>
        <p className="mt-1.5 text-[11px] leading-relaxed text-soot/70">{s.reason}</p>
      </div>
    );
  }
  if (f.computed === "pN") {
    const n = derivePN(data);
    return (
      <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5">
        <span className="text-sm font-bold text-ink">{n ?? "—"}</span>
        {n && <span className="ml-2 text-[11px] text-soot/60">{pnRule(n)}</span>}
      </div>
    );
  }
  if (f.computed === "bmi") {
    const v = bmi(data);
    const band = bmiBand(v);
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-cream/60 px-3 py-2.5">
        <span className="text-sm font-bold tabular-nums text-ink">{v ?? "—"}</span>
        {v !== null && <Badge tone={band.tone}>{band.label}</Badge>}
      </div>
    );
  }
  if (f.computed === "cci") {
    const { score, breakdown } = cciScore(data, patient?.dob);
    return (
      <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-ink">{score}</span>
          <Badge tone={score >= 5 ? "bad" : score >= 3 ? "warn" : "ok"}>
            {score >= 5 ? "High burden" : score >= 3 ? "Moderate" : "Low"}
          </Badge>
        </div>
        {breakdown.length > 0 && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-soot/65">
            {breakdown.map((b) => `${b.label} +${b.points}`).join(" · ")}
          </p>
        )}
      </div>
    );
  }
  return <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-sm text-ink">{raw}</div>;
}

export function GroupCard({ group, data, patient, onChange, readOnly }: {
  group: Group; data: EpisodeData; patient?: Patient;
  onChange: (id: string, v: string | number | null) => void; readOnly?: boolean;
}) {
  const shown = group.fields.filter((f) => visible(f, data));
  return (
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((f) => (
        <div key={f.id} className={f.type === "textarea" ? "sm:col-span-2 xl:col-span-3" : ""}>
          <label className="label">{f.label}{f.unit && f.type !== "number" ? ` (${f.unit})` : ""}</label>
          {f.type === "computed"
            ? <ComputedField f={f} data={data} patient={patient} />
            : <FieldInput f={f} value={data[f.id] ?? ""} onChange={(v) => onChange(f.id, v)} disabled={readOnly} />}
          {f.help && <p className="mt-1 text-[11px] text-soot/55">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}

function groupStats(g: Group, data: EpisodeData) {
  const answerable = g.fields.filter((f) => f.type !== "computed" && visible(f, data));
  const filled = answerable.filter((f) => data[f.id] !== null && data[f.id] !== undefined && data[f.id] !== "").length;
  return { filled, total: answerable.length, pct: answerable.length ? Math.round((filled / answerable.length) * 100) : 100 };
}

export function EpisodeForm({ cancerType, data, patient, onChange, readOnly, onExit }: {
  cancerType: string; data: EpisodeData; patient?: Patient;
  onChange: (id: string, v: string | number | null) => void; readOnly?: boolean;
  onExit?: () => void;
}) {
  const groups = useMemo(() => schemaFor(cancerType), [cancerType]);
  const [mode, setMode] = useState<"wizard" | "all">("wizard");
  const [step, setStep] = useState(0);
  const req = useMemo(() => requiredFieldIds(cancerType), [cancerType]);
  const comp = completeness(data, req);

  // Groups are numbered 2..12 in the MUGIS documents — Demography (group 1)
  // lives on the patient record. TOTAL_STEPS counts all twelve.
  const TOTAL = 12;
  const current = groups[Math.min(step, groups.length - 1)];

  function go(next: number) {
    setStep(Math.max(0, Math.min(groups.length - 1, next)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[270px,minmax(0,1fr)]">
      {/* ---------- left rail: where am I ---------- */}
      <div className="lg:sticky lg:top-[72px]">
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-soot/60">Completeness</span>
              <span className="text-sm font-bold tabular-nums text-ink">{comp.pct}%</span>
            </div>
            <div className="mt-1.5">
              <Progress value={comp.pct} tone={comp.pct >= 80 ? "info" : comp.pct >= 50 ? "warn" : "bad"} />
            </div>
            <p className="mt-1.5 text-[10px] text-soot/55">
              {comp.filled}/{comp.total} fields · nothing is mandatory
            </p>
          </div>

          <nav className="scrollbar-none max-h-[52vh] overflow-y-auto py-1.5">
            <button
              onClick={onExit}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-cream"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4.5 4.5L19 7" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-soot/70">1 · Demography</span>
                <span className="block text-[10px] text-soot/45">On the patient record</span>
              </span>
            </button>

            {groups.map((g, i) => {
              const st = groupStats(g, data);
              const isCurrent = mode === "wizard" && i === step;
              return (
                <button
                  key={g.id}
                  onClick={() => { setMode("wizard"); go(i); }}
                  className={"flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors " +
                    (isCurrent ? "bg-forest-50" : "hover:bg-cream")}
                >
                  <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold " +
                    (isCurrent ? "bg-forest-500 text-white"
                      : st.pct === 100 ? "bg-sage-100 text-sage-700"
                      : st.pct > 0 ? "bg-gold-100 text-gold-600"
                      : "bg-cream text-soot/50")}>
                    {st.pct === 100 && !isCurrent
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4.5 4.5L19 7" /></svg>
                      : g.no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={"block truncate text-xs " + (isCurrent ? "font-bold text-forest-600" : "font-medium text-ink")}>
                      {g.no} · {g.title}
                    </span>
                  </span>
                  <span className="text-[10px] tabular-nums text-soot/45">{st.filled}/{st.total}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-line p-2">
            <button
              onClick={() => setMode(mode === "wizard" ? "all" : "wizard")}
              className="btn-secondary w-full !py-1.5 text-xs"
            >
              {mode === "wizard" ? "View full record" : "Back to step-by-step"}
            </button>
          </div>
        </Card>
      </div>

      {/* ---------- right: the form ---------- */}
      <div className="min-w-0">
        {mode === "wizard" ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-[11px] font-bold text-soot/55">
                  Group {current.no} of {TOTAL}
                </p>
                <h3 className="mt-0.5 font-display text-lg font-bold text-ink">{current.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => (step === 0 ? onExit?.() : go(step - 1))}
                  className="btn-secondary !px-3.5 !py-1.5 text-xs">
                  ← {step === 0 ? "Patient" : `${groups[step - 1].no} · ${groups[step - 1].title}`}
                </button>
                {step < groups.length - 1 && (
                  <button onClick={() => go(step + 1)} className="btn-primary !px-3.5 !py-1.5 text-xs">
                    {groups[step + 1].no} · {groups[step + 1].title} →
                  </button>
                )}
              </div>
            </div>

            <GroupCard group={current} data={data} patient={patient} onChange={onChange} readOnly={readOnly} />

            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <button
                onClick={() => (step === 0 ? onExit?.() : go(step - 1))}
                className="btn-secondary">
                ← Back
              </button>
              {step < groups.length - 1 ? (
                <button onClick={() => go(step + 1)} className="btn-primary">Next →</button>
              ) : (
                <span className="text-xs font-semibold text-sage-700">Last group — remember to save.</span>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.id}>
                <h3 className="mb-4 border-b border-line pb-2.5 font-display text-base font-bold text-ink">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-forest-50 text-[11px] font-bold text-forest-500">{g.no}</span>
                  {g.title}
                </h3>
                <GroupCard group={g} data={data} patient={patient} onChange={onChange} readOnly={readOnly} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
