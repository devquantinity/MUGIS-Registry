"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import {
  api, ApiError, errorText,
  type CancerForm, type CancerType, type FieldType, type FormDefinition, type FormField, type FormSection,
} from "@/lib/api";
import { fieldsOf } from "@/lib/episodeForm";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, Check, Modal, PageHeader } from "@/components/ui";
import { Select } from "@/components/Select";

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text", textarea: "Long text", number: "Number", date: "Date", select: "Dropdown", multiselect: "Multiple choice",
};
const KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;

function slug(label: string): string {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return /^[a-z]/.test(s) ? s : `f_${s}`;
}

function copy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/**
 * SYSTEM_ADMIN: change a cancer type's form (PUT /admin/cancer-types/{code}/form).
 * Each save is a new version; other cancer types are not touched. Anything
 * already saved can be relabelled or retired, never deleted — answers may use it.
 */
export default function CancerFormsPage() {
  useTitle("Cancer forms");
  const { session } = useSession();
  const [types, setTypes] = useState<CancerType[] | null>(null);
  const [code, setCode] = useState("");
  const [base, setBase] = useState<CancerForm | null>(null);
  const [edit, setEdit] = useState<FormDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ section: number } | "section" | null>(null);

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    api.cancerTypes().then((t) => { setTypes(t); if (t[0]) setCode(t[0].code); }).catch((e) => setError(errorText(e)));
  }, [isAdmin]);

  const load = useCallback((c: string) => {
    setBase(null); setEdit(null); setError(null); setConflict(false); setNotice(null);
    api.cancerForm(c).then((f) => { setBase(f); setEdit(copy(f.form)); }).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => { if (code) load(code); }, [code, load]);

  // What was saved before: those keys and values are permanent.
  const saved = useMemo(() => {
    const sections = new Set(base?.form.sections.map((s) => s.key));
    const fields = new Set(base ? fieldsOf(base.form).map((f) => f.key) : []);
    const options = new Map(base ? fieldsOf(base.form).map((f) => [f.key, new Set((f.options ?? []).map((o) => o.value))]) : []);
    return { sections, fields, options };
  }, [base]);

  const dirty = !!base && !!edit && JSON.stringify(base.form) !== JSON.stringify(edit);

  if (!session) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Cancer forms" />
        <Card><p className="text-sm text-soot">Only a System Admin changes the cancer forms.</p></Card>
      </div>
    );
  }

  function mutate(fn: (f: FormDefinition) => void) {
    setEdit((cur) => {
      if (!cur) return cur;
      const next = copy(cur);
      fn(next);
      return next;
    });
    setNotice(null);
  }

  async function save() {
    if (!base || !edit || saving) return;
    setSaving(true); setError(null); setConflict(false); setNotice(null);
    try {
      const f = await api.updateCancerForm(base.code, base.version, edit);
      setBase(f); setEdit(copy(f.form));
      setTypes((t) => t?.map((x) => (x.code === f.code ? { ...x, form_version: f.version } : x)) ?? t);
      setNotice(`Saved as version ${f.version}. New entries use it now; saved answers are unchanged.`);
    } catch (e) {
      setError(e instanceof ApiError && e.reason === "invalid_form_definition" ? e.message.replace(/^invalid form definition: /, "") : errorText(e));
      setConflict(e instanceof ApiError && e.reason === "form_version_conflict");
    } finally {
      setSaving(false);
    }
  }

  const allKeys = edit ? new Set(fieldsOf(edit).map((f) => f.key)) : new Set<string>();

  return (
    <div>
      <PageHeader
        title="Cancer forms"
        subtitle="What each cancer type's record form asks. Saving makes a new version; other cancer types are not affected."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-80">
          <Select ariaLabel="Cancer type" value={code} placeholder={types ? "— choose —" : "Loading…"}
            onChange={(c) => { if (!dirty || window.confirm("Discard unsaved changes to this form?")) setCode(c); }}
            options={(types ?? []).map((t) => ({ value: t.code, label: t.name, hint: `v${t.form_version}` }))} />
        </div>
        {base && <span className="text-[13px] text-soot/72">Version {base.version} · saved {fmtDateTime(base.created_at)}</span>}
      </div>

      <p className="mb-4 rounded-xl border border-line bg-cream/70 px-3 py-2.5 text-[13.5px] text-soot">
        Fields and choices that are already saved can be renamed or <b>retired</b> (hidden from new entry; answers already
        recorded keep showing), but not deleted or changed to another type. Retiring is undone by ticking it back.
      </p>

      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">
          <span>{error}</span>
          {conflict && <button className="btn-secondary !py-1 text-[13px]" onClick={() => load(code)}>Reload the latest version</button>}
        </div>
      )}

      {!edit ? (
        !error && <Card><p className="text-sm text-soot/72">Loading…</p></Card>
      ) : (
        <div className="space-y-4">
          {edit.sections.map((s, si) => (
            <SectionEditor key={s.key} section={s} isNew={!saved.sections.has(s.key)}
              savedFields={saved.fields} savedOptions={saved.options}
              onChange={(fn) => mutate((f) => fn(f.sections[si]))}
              onRemove={() => mutate((f) => { f.sections.splice(si, 1); })}
              onAddField={() => setAdding({ section: si })} />
          ))}
          <button className="btn-secondary" onClick={() => setAdding("section")}>+ Add section</button>

          <div className="sticky bottom-3 z-10">
            <Card className="!py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] text-soot/80">{dirty ? "Unsaved changes" : "No changes"}</span>
                {notice && <span className="text-[13px] font-medium text-sage-700">{notice}</span>}
                <div className="ml-auto flex gap-2">
                  <button className="btn-ghost" disabled={!dirty || saving} onClick={() => base && setEdit(copy(base.form))}>Discard</button>
                  <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save new version"}</button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {adding === "section" && edit && (
        <AddSection taken={new Set(edit.sections.map((s) => s.key))} onClose={() => setAdding(null)}
          onAdd={(sec) => { mutate((f) => { f.sections.push(sec); }); setAdding(null); }} />
      )}
      {adding && adding !== "section" && edit && (
        <AddField taken={allKeys} earlier={edit.sections.slice(0, adding.section + 1).flatMap((s) => s.fields)}
          onClose={() => setAdding(null)}
          onAdd={(fld) => { mutate((f) => { f.sections[adding.section].fields.push(fld); }); setAdding(null); }} />
      )}
    </div>
  );
}

function SectionEditor({ section, isNew, savedFields, savedOptions, onChange, onRemove, onAddField }: {
  section: FormSection; isNew: boolean; savedFields: Set<string>; savedOptions: Map<string, Set<string>>;
  onChange: (fn: (s: FormSection) => void) => void; onRemove: () => void; onAddField: () => void;
}) {
  const [open, setOpen] = useState(false);
  const live = section.fields.filter((f) => !f.retired).length;
  return (
    <Card padded={false} className={section.retired ? "opacity-75" : ""}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={"text-soot/70 transition-transform " + (open ? "rotate-90" : "")}>▸</span>
          <span className="truncate font-display text-base font-bold text-ink">{section.label}</span>
          <span className="text-[12.5px] text-soot/72">{live} field{live === 1 ? "" : "s"}{section.retired ? " · retired" : ""}</span>
          {isNew && <Badge tone="info">New</Badge>}
        </button>
        {isNew
          ? <button className="text-[13px] font-semibold text-danger-700 hover:underline" onClick={onRemove}>Remove</button>
          : <Check checked={!section.retired} onChange={(on) => onChange((s) => { s.retired = on ? undefined : true; })} label={<span className="text-[13px]">In use</span>} />}
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3">
          <label className="label">Section title</label>
          <input className="input max-w-md" value={section.label} onChange={(e) => onChange((s) => { s.label = e.target.value; })} />
          <div className="mt-4 divide-y divide-line">
            {section.fields.map((f, fi) => (
              <FieldEditor key={f.key} field={f} isNew={!savedFields.has(f.key)} savedOptions={savedOptions.get(f.key) ?? new Set()}
                onChange={(fn) => onChange((s) => fn(s.fields[fi]))}
                onRemove={() => onChange((s) => { s.fields.splice(fi, 1); })} />
            ))}
          </div>
          <button className="btn-secondary mt-3" onClick={onAddField}>+ Add field</button>
        </div>
      )}
    </Card>
  );
}

function FieldEditor({ field, isNew, savedOptions, onChange, onRemove }: {
  field: FormField; isNew: boolean; savedOptions: Set<string>;
  onChange: (fn: (f: FormField) => void) => void; onRemove: () => void;
}) {
  const [newOpt, setNewOpt] = useState("");
  const choice = field.type === "select" || field.type === "multiselect";
  const values = new Set((field.options ?? []).map((o) => o.value));
  const addOption = () => {
    const v = newOpt.trim();
    if (!v || values.has(v)) return;
    onChange((f) => { f.options = [...(f.options ?? []), { value: v, label: v }]; });
    setNewOpt("");
  };
  return (
    <div className={"py-3 " + (field.retired ? "opacity-70" : "")}>
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-sm flex-1" aria-label="Field label" value={field.label}
          onChange={(e) => onChange((f) => { f.label = e.target.value; })} />
        <Badge>{TYPE_LABEL[field.type]}{field.unit ? ` · ${field.unit}` : ""}</Badge>
        <code className="text-[12px] text-soot/70">{field.key}</code>
        {field.show_if && (
          <span className="text-[12.5px] text-soot/72">
            shown when {field.show_if.field} {field.show_if.in ? "is" : "is not"} {(field.show_if.in ?? field.show_if.not_in ?? []).join(" / ")}
          </span>
        )}
        <div className="ml-auto">
          {isNew
            ? <button className="text-[13px] font-semibold text-danger-700 hover:underline" onClick={onRemove}>Remove</button>
            : <Check checked={!field.retired} onChange={(on) => onChange((f) => { f.retired = on ? undefined : true; })} label={<span className="text-[13px]">In use</span>} />}
        </div>
      </div>
      {choice && (
        <div className="mt-2 pl-1">
          <div className="flex flex-wrap gap-1.5">
            {(field.options ?? []).map((o, oi) => {
              const kept = savedOptions.has(o.value);
              return (
                <span key={o.value} className={"inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[13px] " +
                  (o.retired ? "border-line bg-cream text-soot/60 line-through" : "border-line bg-paper text-ink")}>
                  <input className="w-32 bg-transparent outline-none" aria-label={`Label for ${o.value}`} value={o.label}
                    onChange={(e) => onChange((f) => { f.options![oi].label = e.target.value; })} />
                  {kept ? (
                    <button className="text-[12px] font-semibold text-soot/80 no-underline hover:text-ink"
                      title={o.retired ? "Offer this choice again" : "Stop offering this choice"}
                      onClick={() => onChange((f) => { f.options![oi].retired = o.retired ? undefined : true; })}>
                      {o.retired ? "restore" : "retire"}
                    </button>
                  ) : (
                    <button className="text-[12px] font-semibold text-danger-700" title="Remove (not saved yet)"
                      onClick={() => onChange((f) => { f.options = f.options!.filter((x) => x.value !== o.value); })}>×</button>
                  )}
                </span>
              );
            })}
          </div>
          <div className="mt-2 flex max-w-sm gap-2">
            <input className="input !py-1.5 text-[13px]" placeholder="New choice" value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} />
            <button className="btn-secondary !py-1.5 text-[13px]" disabled={!newOpt.trim() || values.has(newOpt.trim())} onClick={addOption}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddSection({ taken, onAdd, onClose }: {
  taken: Set<string>; onAdd: (s: FormSection) => void; onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const key = slug(label);
  const bad = !label.trim() ? "" : taken.has(key) ? "A section with this name already exists." : "";
  return (
    <Modal open onClose={onClose} title="Add section">
      <label className="label">Section title</label>
      <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      <p className="mt-1 text-[13px] text-soot/72">Add its fields after creating it. It needs at least one before saving.</p>
      {bad && <p className="mt-2 text-[13.5px] text-danger-700">{bad}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!label.trim() || !!bad} onClick={() => onAdd({ key, label: label.trim(), fields: [] })}>Add section</button>
      </div>
    </Modal>
  );
}

function AddField({ taken, earlier, onAdd, onClose }: {
  taken: Set<string>; earlier: FormField[]; onAdd: (f: FormField) => void; onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<FieldType>("select");
  const [options, setOptions] = useState("No\nYes");
  const [unit, setUnit] = useState("");
  const [cond, setCond] = useState("");
  const [condValues, setCondValues] = useState<string[]>([]);

  const k = keyTouched ? key : slug(label);
  const choice = type === "select" || type === "multiselect";
  const opts = [...new Set(options.split("\n").map((o) => o.trim()).filter(Boolean))];
  const controller = earlier.find((f) => f.key === cond);
  const problem = !label.trim() ? "Give the field a label."
    : !KEY_RE.test(k) ? "The key must start with a letter and use lower-case letters, digits and _."
    : taken.has(k) ? "Another field already uses this key."
    : choice && opts.length === 0 ? "Add at least one choice."
    : cond && condValues.length === 0 ? "Pick the answers that show this field." : "";

  function add() {
    const f: FormField = { key: k, label: label.trim(), type };
    if (choice) f.options = opts.map((o) => ({ value: o, label: o }));
    if (type === "number" && unit.trim()) f.unit = unit.trim();
    if (cond) f.show_if = { field: cond, in: condValues };
    onAdd(f);
  }

  const controllers = earlier.filter((f) => (f.type === "select" || f.type === "multiselect") && !f.retired);
  return (
    <Modal open onClose={onClose} title="Add field" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Key (permanent)</label>
          <input className="input font-mono text-[13px]" value={k} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} />
        </div>
        <div>
          <label className="label">Type</label>
          <Select ariaLabel="Type" value={type} onChange={(v) => setType(v as FieldType)}
            options={(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
        </div>
        {type === "number" && (
          <div>
            <label className="label">Unit (optional)</label>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. mm" />
          </div>
        )}
        {choice && (
          <div className="sm:col-span-2">
            <label className="label">Choices, one per line</label>
            <textarea className="input min-h-[96px]" value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">Show only when (optional)</label>
          <Select ariaLabel="Condition field" value={cond} onChange={(v) => { setCond(v); setCondValues([]); }}
            options={[{ value: "", label: "Always shown" }, ...controllers.map((f) => ({ value: f.key, label: f.label }))]} />
          {controller && (
            <div className="mt-2 flex flex-wrap gap-3">
              {(controller.options ?? []).filter((o) => !o.retired).map((o) => (
                <Check key={o.value} checked={condValues.includes(o.value)} label={<span className="text-[13px]">{o.label}</span>}
                  onChange={(on) => setCondValues((v) => (on ? [...v, o.value] : v.filter((x) => x !== o.value)))} />
              ))}
            </div>
          )}
        </div>
      </div>
      {problem && label && <p className="mt-3 text-[13.5px] text-danger-700">{problem}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!!problem} onClick={add}>Add field</button>
      </div>
    </Modal>
  );
}
