/**
 * The rules a cancer-episode form follows on screen. They mirror the
 * backend's form engine (mugis-backend internal/forms) so what the user sees
 * — which fields show, the progress — matches what the server will accept
 * and report. The server stays the authority: it validates every save.
 *
 *  - A field with `show_if` shows only while the named earlier field is shown
 *    and has an answer that is (`in`) / is not (`not_in`) listed.
 *  - Retired fields and options are not offered for new entry; an answer
 *    already saved with one is still shown.
 *  - Progress counts live (not retired) fields that are currently shown.
 */
import type { Answer, Answers, EpisodeProgress, FormDefinition, FormField, FormOption } from "@/lib/api";

/** What an input holds while editing: numbers stay text until saved. */
export type DraftValue = string | string[];
export type Draft = Record<string, DraftValue>;

export function fieldsOf(form: FormDefinition): FormField[] {
  return form.sections.flatMap((s) => s.fields);
}

export function fieldIndex(form: FormDefinition): Map<string, FormField> {
  return new Map(fieldsOf(form).map((f) => [f.key, f]));
}

function chosen(v: Answer | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  return [String(v)];
}

/** Keys of the fields whose condition holds for these answers. */
export function visibleKeys(form: FormDefinition, a: Answers): Set<string> {
  const vis = new Set<string>();
  for (const f of fieldsOf(form)) {
    const c = f.show_if;
    if (!c) { vis.add(f.key); continue; }
    if (!vis.has(c.field)) continue;
    const picked = chosen(a[c.field]);
    if (picked.length === 0) continue;
    const listed = c.in ?? c.not_in ?? [];
    const hit = picked.some((v) => listed.includes(v));
    if (hit === (c.in !== undefined && c.in.length > 0)) vis.add(f.key);
  }
  return vis;
}

/** Same counting as the server: live, shown fields, overall and per live section. */
export function progressOf(form: FormDefinition, a: Answers): EpisodeProgress {
  const vis = visibleKeys(form, a);
  const out: EpisodeProgress = { filled: 0, total: 0, percent: 0, sections: [] };
  for (const s of form.sections) {
    if (s.retired) continue;
    let filled = 0, total = 0;
    for (const f of s.fields) {
      if (f.retired || !vis.has(f.key)) continue;
      total++;
      if (a[f.key] !== undefined) filled++;
    }
    out.filled += filled; out.total += total;
    out.sections.push({ key: s.key, filled, total });
  }
  out.percent = out.total ? Math.floor((out.filled * 100) / out.total) : 0;
  return out;
}

/** Options to offer: the live ones, plus a retired one already chosen. */
export function offeredOptions(f: FormField, current: string[]): FormOption[] {
  return (f.options ?? []).filter((o) => !o.retired || current.includes(o.value));
}

export function draftFrom(a: Answers): Draft {
  const d: Draft = {};
  for (const [k, v] of Object.entries(a)) d[k] = Array.isArray(v) ? [...v] : String(v);
  return d;
}

/** The answer a draft value stands for; null when empty. */
export function toAnswer(f: FormField, v: DraftValue | undefined): Answer | null {
  if (v === undefined) return null;
  if (f.type === "multiselect") return Array.isArray(v) && v.length ? v : null;
  const s = (Array.isArray(v) ? v.join(",") : v).trim();
  if (s === "") return null;
  if (f.type === "number") {
    const n = Number(s);
    return Number.isFinite(n) ? n : s; // the server explains a non-number
  }
  return s;
}

/** The draft as answers — for live visibility and progress. */
export function answersOf(form: FormDefinition, d: Draft): Answers {
  const idx = fieldIndex(form);
  const out: Answers = {};
  for (const [k, v] of Object.entries(d)) {
    const f = idx.get(k);
    const a = f ? toAnswer(f, v) : (v as Answer);
    if (a !== null) out[k] = a;
  }
  return out;
}

function same(a: Answer | null | undefined, b: Answer | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/**
 * What to send: only answers that changed. A field the draft hides is not
 * sent with a value (the server would refuse it); if it had a saved answer it
 * is cleared, as the server would on save anyway.
 */
export function changesOf(form: FormDefinition, saved: Answers, d: Draft): Record<string, Answer | null> {
  const idx = fieldIndex(form);
  const next = answersOf(form, d);
  const vis = visibleKeys(form, next);
  const out: Record<string, Answer | null> = {};
  for (const k of new Set([...Object.keys(saved), ...Object.keys(d)])) {
    const f = idx.get(k);
    if (!f) continue; // not on this form — leave it to the server
    const now = vis.has(k) ? toAnswer(f, d[k]) : null;
    if (!same(now, saved[k])) out[k] = now;
  }
  return out;
}

/** An invalid_episode_answer message names the field: "invalid answer: height: must be at most 250". */
export function answerError(message: string): { key: string; text: string } | null {
  const m = /^invalid answer: ([a-z][a-z0-9_]*): (.+)$/.exec(message);
  return m ? { key: m[1], text: m[2] } : null;
}

/** Human text for an answer, for read-only display. */
export function answerText(f: FormField, v: Answer | undefined): string {
  if (v === undefined) return "—";
  const label = (x: string) => f.options?.find((o) => o.value === x)?.label ?? x;
  if (Array.isArray(v)) return v.map(label).join(", ");
  if (f.type === "select") return label(String(v));
  return f.unit ? `${v} ${f.unit}` : String(v);
}
