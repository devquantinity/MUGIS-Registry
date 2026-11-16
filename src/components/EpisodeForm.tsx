"use client";

/**
 * A cancer-episode form, drawn entirely from the form document the API
 * serves for the episode's cancer type (GET /cancer-types/{code}/form).
 * Nothing about any one cancer type is written here: a field added to the
 * Gastric form by an administrator simply appears.
 *
 * The page owns the answers; this draws the section rail (with live
 * progress) and the current section's fields.
 */
import { useEffect, useMemo, useState } from "react";
import type { Answers, FormDefinition, FormField, FormSection } from "@/lib/api";
import { answerText, answersOf, offeredOptions, progressOf, visibleKeys, type Draft, type DraftValue } from "@/lib/episodeForm";
import { Card, Progress } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { Select } from "@/components/Select";

const tick = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4.5 4.5L19 7" /></svg>
);

function FieldInput({ f, value, saved, onChange, disabled }: {
  f: FormField; value: DraftValue | undefined; saved: Answers;
  onChange: (v: DraftValue) => void; disabled?: boolean;
}) {
  const current = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const savedNow = saved[f.key];
  const keep = savedNow === undefined ? [] : Array.isArray(savedNow) ? savedNow : [String(savedNow)];

  if (f.type === "select") {
    const options = offeredOptions(f, keep);
    return (
      <Select
        ariaLabel={f.label}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(v) => onChange(v)}
        options={[
          { value: "", label: "— not recorded —" },
          ...options.map((o) => ({ value: o.value, label: o.retired ? `${o.label} (no longer offered)` : o.label })),
        ]}
      />
    );
  }
  if (f.type === "multiselect") {
    const options = offeredOptions(f, keep);
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.label}>
        {options.map((o) => {
          const on = current.includes(o.value);
          return (
            <button key={o.value} type="button" disabled={disabled} aria-pressed={on}
              onClick={() => onChange(on ? current.filter((x) => x !== o.value) : [...current, o.value])}
              className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
                (on ? "border-forest-500 bg-forest-50 text-forest-700" : "border-line bg-paper text-ink hover:border-forest-500/50")}>
              {on && tick}{o.label}{o.retired ? " (no longer offered)" : ""}
            </button>
          );
        })}
      </div>
    );
  }
  if (f.type === "textarea") {
    return (
      <textarea aria-label={f.label} className="input min-h-[72px] resize-y" value={typeof value === "string" ? value : ""} disabled={disabled}
        maxLength={f.max_length ?? 500} onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (f.type === "number") {
    return (
      <div className="relative">
        <input type="number" inputMode="decimal" aria-label={f.label} className={"input " + (f.unit ? "pr-20" : "")}
          value={typeof value === "string" ? value : ""} disabled={disabled}
          min={f.min} max={f.max} step={f.integer ? 1 : "any"}
          onChange={(e) => onChange(e.target.value)} />
        {f.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-soot/70">{f.unit}</span>}
      </div>
    );
  }
  if (f.type === "date") {
    // The picker has its own clear (× on the field, and in the calendar).
    return <DatePicker value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(iso) => onChange(iso)} />;
  }
  return <input type="text" aria-label={f.label} className="input" value={typeof value === "string" ? value : ""} disabled={disabled}
    maxLength={f.max_length ?? 500} onChange={(e) => onChange(e.target.value)} />;
}

function hint(f: FormField): string | undefined {
  const parts: string[] = [];
  if (f.help) parts.push(f.help);
  if (f.type === "number" && (f.min !== undefined || f.max !== undefined)) {
    const unit = f.unit ? ` ${f.unit}` : "";
    if (f.min !== undefined && f.max !== undefined) parts.push(`${f.min}–${f.max}${unit}`);
    else if (f.max !== undefined) parts.push(`up to ${f.max}${unit}`);
    if (f.integer) parts.push("whole number");
  }
  return parts.length ? parts.join(" · ") : undefined;
}

/** The fields of one section that are on screen: shown by their condition, and live or already answered. */
function shownFields(s: FormSection, vis: Set<string>, saved: Answers): FormField[] {
  return s.fields.filter((f) => vis.has(f.key) && ((!f.retired && !s.retired) || saved[f.key] !== undefined));
}

export function SectionFields({ section, draft, saved, vis, onChange, readOnly, error }: {
  section: FormSection; draft: Draft; saved: Answers; vis: Set<string>;
  onChange: (key: string, v: DraftValue) => void; readOnly?: boolean;
  error?: { key: string; text: string } | null;
}) {
  const fields = shownFields(section, vis, saved);
  if (fields.length === 0) {
    return <p className="text-sm text-soot/75">Nothing to record here yet — fields appear as earlier answers call for them.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((f) => {
        const retired = f.retired || section.retired;
        const wide = f.type === "textarea" || f.type === "multiselect";
        return (
          <div key={f.key} id={`field-${f.key}`} className={wide ? "sm:col-span-2 xl:col-span-3" : ""}>
            <label className="label">{f.label}</label>
            {retired ? (
              <p className="rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-sm text-ink">
                {answerText(f, saved[f.key])}
                <span className="ml-2 text-[12.5px] text-soot/72">No longer collected</span>
              </p>
            ) : (
              <FieldInput f={f} value={draft[f.key]} saved={saved} disabled={readOnly} onChange={(v) => onChange(f.key, v)} />
            )}
            {error?.key === f.key
              ? <p className="mt-1 text-[13px] font-medium text-danger-700">{error.text}</p>
              : hint(f) && <p className="mt-1 text-[13px] text-soot/72">{hint(f)}</p>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Section rail + the current section. When the server refuses an answer
 * (`error`), it jumps to the section holding that field.
 */
export function EpisodeForm({ form, draft, saved, onChange, readOnly, error, footer }: {
  form: FormDefinition; draft: Draft; saved: Answers;
  onChange: (key: string, v: DraftValue) => void; readOnly?: boolean;
  error?: { key: string; text: string } | null;
  /** Save buttons etc., under the section. */
  footer?: React.ReactNode;
}) {
  const answers = useMemo(() => answersOf(form, draft), [form, draft]);
  const vis = useMemo(() => visibleKeys(form, answers), [form, answers]);
  const progress = useMemo(() => progressOf(form, answers), [form, answers]);
  const sections = useMemo(
    () => form.sections.filter((s) => !s.retired || s.fields.some((f) => saved[f.key] !== undefined)),
    [form, saved]);
  const [step, setStep] = useState(0);
  const [all, setAll] = useState(false);

  // Jump to the field the server complained about.
  useEffect(() => {
    if (!error) return;
    const i = sections.findIndex((s) => s.fields.some((f) => f.key === error.key));
    if (i >= 0) { setAll(false); setStep(i); }
    window.setTimeout(() => document.getElementById(`field-${error.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [error, sections]);

  const cur = sections[Math.min(step, sections.length - 1)];
  const stat = (key: string) => progress.sections.find((p) => p.key === key) ?? { filled: 0, total: 0 };
  const go = (i: number) => { setStep(Math.max(0, Math.min(sections.length - 1, i))); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[270px,minmax(0,1fr)]">
      <div className="lg:sticky lg:top-[72px]">
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-soot/75">Progress</span>
              <span className="text-sm font-bold tabular-nums text-ink">{progress.percent}%</span>
            </div>
            <div className="mt-1.5"><Progress value={progress.percent} tone={progress.percent >= 80 ? "info" : progress.percent >= 40 ? "warn" : "bad"} /></div>
            <p className="mt-1.5 text-[12px] text-soot/72">{progress.filled}/{progress.total} fields shown so far · nothing is mandatory</p>
          </div>
          <nav className="scrollbar-none max-h-[56vh] overflow-y-auto py-1.5" aria-label="Sections">
            {sections.map((s, i) => {
              const st = stat(s.key);
              const done = st.total > 0 && st.filled === st.total;
              const here = !all && i === step;
              return (
                <button key={s.key} onClick={() => { setAll(false); go(i); }}
                  className={"flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors " + (here ? "bg-forest-50" : "hover:bg-cream")}>
                  <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12.5px] font-bold " +
                    (here ? "bg-forest-500 text-white" : done ? "bg-sage-100 text-sage-700" : st.filled > 0 ? "bg-gold-100 text-gold-600" : "bg-cream text-soot/70")}>
                    {done && !here ? tick : i + 2}
                  </span>
                  <span className={"min-w-0 flex-1 truncate text-xs " + (here ? "font-bold text-forest-600" : "font-medium text-ink")}>
                    {s.label}{s.retired ? " (retired)" : ""}
                  </span>
                  <span className="text-[12px] tabular-nums text-soot/65">{st.filled}/{st.total}</span>
                </button>
              );
            })}
          </nav>
          <div className="border-t border-line p-2">
            <button onClick={() => setAll(!all)} className="btn-secondary w-full !py-1.5 text-xs">
              {all ? "Back to section by section" : "View all sections"}
            </button>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        {all ? sections.map((s, i) => (
          <Card key={s.key}>
            <h3 className="mb-4 border-b border-line pb-2.5 font-display text-base font-bold text-ink">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-forest-50 text-[12.5px] font-bold text-forest-500">{i + 2}</span>
              {s.label}
            </h3>
            <SectionFields section={s} draft={draft} saved={saved} vis={vis} onChange={onChange} readOnly={readOnly} error={error} />
          </Card>
        )) : cur && (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-[13px] font-bold text-soot/72">Section {step + 2} of {sections.length + 1} · demography is on the patient record</p>
                <h3 className="mt-0.5 font-display text-lg font-bold text-ink">{cur.label}</h3>
                {cur.help && <p className="mt-0.5 text-[13px] text-soot/75">{cur.help}</p>}
              </div>
              <span className="text-[13px] tabular-nums text-soot/72">{stat(cur.key).filled}/{stat(cur.key).total} recorded</span>
            </div>
            <SectionFields section={cur} draft={draft} saved={saved} vis={vis} onChange={onChange} readOnly={readOnly} error={error} />
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
              <button className="btn-secondary" disabled={step === 0} onClick={() => go(step - 1)}>← Back</button>
              {step < sections.length - 1
                ? <button className="btn-secondary" onClick={() => go(step + 1)}>{sections[step + 1].label} →</button>
                : <span className="text-xs font-semibold text-sage-700">Last section</span>}
            </div>
          </Card>
        )}
        {footer}
      </div>
    </div>
  );
}
