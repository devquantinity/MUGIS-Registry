"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import {
  api, ApiError, errorText,
  type CancerForm, type CancerType, type Episode, type Patient,
} from "@/lib/api";
import { answerError, changesOf, draftFrom, fieldIndex, type Draft, type DraftValue } from "@/lib/episodeForm";
import { fmtDateTime } from "@/lib/format";
import { EpisodeForm } from "@/components/EpisodeForm";
import { Badge, Card, Modal, PageHeader } from "@/components/ui";
import { Select } from "@/components/Select";

/**
 * One cancer episode (GET/PATCH /cancer-episodes/{id}), filled against its
 * cancer type's live form. Only changed answers are sent; the server merges
 * them, re-checks every rule and reports answers it removed.
 */
export default function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [form, setForm] = useState<CancerForm | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ key: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retyping, setRetyping] = useState(false);
  useTitle(patient ? `${patient.full_name} · ${episode?.cancer_type_name ?? "Record"}` : "Cancer record");

  const clinical = !!session && CLINICAL.includes(session.role);

  /** Show a saved episode: its answers become the new starting point. */
  const adopt = useCallback(async (ep: Episode, knownForm?: CancerForm | null) => {
    const f = knownForm && knownForm.code === ep.cancer_type && knownForm.version === ep.form_version
      ? knownForm : await api.cancerForm(ep.cancer_type);
    setForm(f);
    setEpisode(ep);
    setDraft(draftFrom(ep.data));
    return f;
  }, []);

  useEffect(() => {
    if (!clinical || !id) return;
    let alive = true;
    api.episode(id)
      .then(async (ep) => {
        if (!alive) return;
        await adopt(ep);
        const p = await api.patient(ep.patient_id).catch(() => null);
        if (alive) setPatient(p);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setLoadError(errorText(e));
      });
    return () => { alive = false; };
  }, [clinical, id, adopt]);

  const changes = useMemo(
    () => (form && episode ? changesOf(form.form, episode.data, draft) : {}),
    [form, episode, draft]);
  const dirty = Object.keys(changes).length > 0;

  // Leaving with unsaved answers asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const labelsOf = useCallback((keys: string[], f: CancerForm | null) => {
    const idx = f ? fieldIndex(f.form) : new Map();
    return keys.map((k) => idx.get(k)?.label ?? k).join(", ");
  }, []);

  if (!session) return null;
  if (!clinical) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Cancer record" />
        <Card><p className="text-sm text-soot">System administrators do not work with patient records.</p></Card>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Record not found" />
        <Card><p className="text-sm text-soot">This record does not exist, or its patient is outside what you may see.</p></Card>
      </div>
    );
  }
  if (loadError) return <Card><p className="text-sm text-danger-700">{loadError}</p></Card>;
  if (!episode || !form) return <Card><p className="text-sm text-soot/72">Loading…</p></Card>;

  const readOnly = !episode.can_edit;

  function onChange(key: string, v: DraftValue) {
    setDraft((d) => ({ ...d, [key]: v }));
    if (fieldError?.key === key) setFieldError(null);
    setNotice(null);
  }

  async function save() {
    if (!dirty || saving || !episode) return;
    setSaving(true); setSaveError(null); setFieldError(null); setNotice(null);
    // Answers the draft now hides are sent as cleared; say so, as the server
    // would for anything it removes itself.
    const hidden = Object.keys(changes).filter((k) => changes[k] === null && episode.data[k] !== undefined && (draft[k] ?? "") !== "");
    try {
      const ep = await api.updateEpisode(episode.id, { data: changes });
      const f = await adopt(ep, form);
      const removed = [...new Set([...hidden, ...(ep.dropped ?? [])])];
      if (removed.length) setNotice(`Saved. Removed answers that no longer apply: ${labelsOf(removed, f)}.`);
      else setNotice("Saved.");
    } catch (e) {
      const fe = e instanceof ApiError && e.reason === "invalid_episode_answer" ? answerError(e.message) : null;
      if (fe) {
        const label = fieldIndex(form!.form).get(fe.key)?.label ?? fe.key;
        setFieldError(fe);
        setSaveError(`${label}: ${fe.text}`);
      } else setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const footer = !readOnly && (
    <div className="sticky bottom-3 z-10">
      <Card className="!py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-soot/80">
            {dirty ? `${Object.keys(changes).length} unsaved change${Object.keys(changes).length === 1 ? "" : "s"}` : "All changes saved"}
          </span>
          {saveError && <span className="text-[13px] font-medium text-danger-700">{saveError}</span>}
          {!saveError && notice && <span className="text-[13px] font-medium text-sage-700">{notice}</span>}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost" disabled={!dirty || saving} onClick={() => { setDraft(draftFrom(episode.data)); setFieldError(null); setSaveError(null); }}>Discard</button>
            <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={episode.cancer_type_name}
        subtitle={patient ? `${patient.full_name} · ${patient.registry_no} · updated ${fmtDateTime(episode.updated_at)}` : `Updated ${fmtDateTime(episode.updated_at)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/patients/${episode.patient_id}`} className="btn-secondary">Patient record</Link>
            {!readOnly && <button className="btn-secondary" onClick={() => setRetyping(true)}>Change cancer type</button>}
          </div>
        }
      />
      {readOnly && (
        <p className="mb-4 rounded-xl border border-line bg-cream/70 px-3 py-2.5 text-[13.5px] text-soot">
          <Badge>View only</Badge> <span className="ml-1">You can see this record but not change it. Ask for edit access on the patient record.</span>
        </p>
      )}

      <EpisodeForm form={form.form} draft={draft} saved={episode.data} onChange={onChange}
        readOnly={readOnly} error={fieldError} footer={footer} />

      {retyping && (
        <Retype
          episode={episode} dirty={dirty} onClose={() => setRetyping(false)}
          onDone={async (ep) => {
            setRetyping(false);
            const before = form; // dropped answers are named by the form they came from
            await adopt(ep);
            setNotice(ep.dropped?.length
              ? `Now filed as ${ep.cancer_type_name}. Removed answers not on this form: ${labelsOf(ep.dropped, before)}.`
              : `Now filed as ${ep.cancer_type_name}. Every answer carried over.`);
          }}
        />
      )}
    </div>
  );
}

/** Re-file the episode under another cancer type (the suspected type turned out wrong). */
function Retype({ episode, dirty, onClose, onDone }: {
  episode: Episode; dirty: boolean; onClose: () => void; onDone: (ep: Episode) => void;
}) {
  const [types, setTypes] = useState<CancerType[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.cancerTypes().then(setTypes).catch((e) => setError(errorText(e)));
  }, []);

  async function submit() {
    setBusy(true); setError(null);
    try {
      onDone(await api.updateEpisode(episode.id, { cancer_type: code }));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const options = (types ?? []).filter((t) => t.code !== episode.cancer_type).map((t) => ({ value: t.code, label: t.name }));
  return (
    <Modal open onClose={onClose} title="Change cancer type">
      <p className="text-sm text-soot">
        Currently <span className="font-semibold text-ink">{episode.cancer_type_name}</span>. Answers that also exist on the
        new type&apos;s form carry over; the rest are removed, and you will see which.
      </p>
      {dirty && <p className="mt-3 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2 text-[13.5px] text-goldink/85">Save or discard your unsaved changes first.</p>}
      <label className="label mt-4">New cancer type</label>
      <Select ariaLabel="New cancer type" value={code} onChange={setCode} options={options} placeholder={types ? "— choose —" : "Loading…"} />
      {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy || !code || dirty}>{busy ? "Changing…" : "Change type"}</button>
      </div>
    </Modal>
  );
}
