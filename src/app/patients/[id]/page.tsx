"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, ApiError, errorText, type CancerType, type EpisodeSummary, type Patient, type PatientInput } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { fmtDate, fmtDateTime, formatMykad } from "@/lib/format";
import PatientForm, { identityComplete, identityProblem, type PatientFormValue } from "@/components/PatientForm";
import PatientAccessPanel from "@/components/PatientAccessPanel";
import { Badge, Card, Modal, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { Select } from "@/components/Select";

function toForm(p: Patient): PatientFormValue {
  return {
    full_name: p.full_name ?? "", id_type: p.id_type, id_number: p.id_number ?? "",
    date_of_birth: p.date_of_birth ?? "", sex: p.sex ?? "", ethnic: p.ethnic ?? "", state: p.state ?? "",
  };
}

/** Only the fields that changed; identity type and number always travel together. */
function changes(before: PatientFormValue, after: PatientFormValue): PatientInput {
  const out: PatientInput = {};
  if (after.full_name.trim() !== before.full_name) out.full_name = after.full_name.trim();
  if (after.id_type !== before.id_type || after.id_number !== before.id_number) {
    out.id_type = after.id_type; out.id_number = after.id_number;
  }
  for (const k of ["date_of_birth", "sex", "ethnic", "state"] as const) {
    if (after[k] !== before[k]) out[k] = after[k];
  }
  return out;
}

/** One patient record (GET /patients/{id}); edit when the caller may (PATCH). */
export default function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PatientFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [opening, setOpening] = useState(false);
  useTitle(patient ? (patient.full_name ?? patient.registry_no) : "Patient record");

  const clinical = !!session && CLINICAL.includes(session.role);

  useEffect(() => {
    if (!clinical || !id) return;
    let alive = true;
    api.patient(id)
      .then((p) => { if (alive) setPatient(p); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setLoadError(errorText(e));
      });
    return () => { alive = false; };
  }, [clinical, id]);

  if (!session) return null;
  if (!clinical) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Patient record" />
        <Card><p className="text-sm text-soot">System administrators do not work with patient records.</p></Card>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Patient not found" />
        <Card>
          <p className="text-sm text-soot">
            This record does not exist, or it is outside what you may see. If a colleague registered this patient,
            look the identity number up on <Link href="/patients/new" className="font-semibold text-forest-600 underline underline-offset-2">New patient</Link> to request access.
          </p>
        </Card>
      </div>
    );
  }
  if (loadError) {
    return <Card><p className="text-sm text-danger-700">{loadError}</p></Card>;
  }
  if (!patient) return <Card><p className="text-sm text-soot/72">Loading…</p></Card>;

  const badge = ACCESS_LABEL[patient.access];
  const age = patient.age_years;
  const restricted = !patient.full_access;

  function startEdit() {
    setForm(toForm(patient!));
    setSaveError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || saving) return;
    const body = changes(toForm(patient!), form);
    if (Object.keys(body).length === 0) { setEditing(false); return; }
    if (body.full_name === "" || body.id_number === "") { setSaveError("Full name and identity number are required."); return; }
    if (body.id_number !== undefined) {
      const idProblem = identityProblem(form);
      if (idProblem || !identityComplete(form)) { setSaveError(idProblem ?? "Enter a complete identity number."); return; }
    }
    setSaving(true); setSaveError(null);
    try {
      setPatient(await api.updatePatient(patient!.id, body));
      setEditing(false);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={patient.full_name ?? `Patient ${patient.registry_no}`}
        subtitle={`${patient.registry_no} · ${patient.centre.name}`}
        actions={
          editing ? null : patient.can_edit ? (
            <button className="btn-primary" onClick={startEdit}>Edit demography</button>
          ) : (
            <button className="btn-secondary" onClick={() => setAsking(true)}>{restricted ? "Request access" : "Request edit access"}</button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle right={<Badge tone={badge.tone}>{badge.text}</Badge>}>Demography</SectionTitle>
          {editing && form ? (
            <form onSubmit={save}>
              <PatientForm value={form} onChange={setForm} lockIdentity />
              {saveError && <p className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">{saveError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          ) : (
            restricted ? (
              <>
                <p className="mb-4 rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-[13.5px] text-soot">
                  Personal details are visible only to the doctor who added this patient and to colleagues they share it with.
                  You can see the age, sex and cancer records. Use <span className="font-semibold">Request access</span> to ask for the rest.
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Item label="Age" value={age !== null ? `${age} years` : undefined} />
                  <Item label="Sex" value={patient.sex} />
                  <Restricted label="Full name" />
                  <Restricted label={patient.id_type === "mykad" ? "MyKad" : "Passport"} />
                  <Restricted label="Date of birth" />
                  <Restricted label="Ethnic" />
                  <Restricted label="State" />
                </dl>
              </>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Item label="Full name" value={patient.full_name} />
                <Item label={patient.id_type === "mykad" ? "MyKad" : "Passport"} value={patient.id_number ? (patient.id_type === "mykad" ? formatMykad(patient.id_number) : patient.id_number) : patient.id_number_masked} mono />
                <Item label="Date of birth" value={patient.date_of_birth ? `${fmtDate(patient.date_of_birth)}${age !== null ? ` (${age}y)` : ""}` : undefined} />
                <Item label="Sex" value={patient.sex} />
                <Item label="Ethnic" value={patient.ethnic} />
                <Item label="State" value={patient.state} />
              </dl>
            )
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <SectionTitle>Record</SectionTitle>
            <dl className="grid gap-3">
              <Item label="Registry number" value={patient.registry_no} mono />
              <Item label="Centre" value={`${patient.centre.name} (${patient.centre.code})`} />
              <Item label="Registered" value={fmtDateTime(patient.created_at)} />
              <Item label="Last updated" value={fmtDateTime(patient.updated_at)} />
            </dl>
          </Card>
          <Episodes episodes={patient.episodes} canEdit={patient.can_edit} limit={patient.cancer_record_limit} onOpen={() => setOpening(true)} />
          <PatientAccessPanel patientId={patient.id} />
        </div>
      </div>

      <RequestAccess open={asking} onClose={() => setAsking(false)} patientId={patient.id} canView={!restricted} />
      {opening && <OpenEpisode patientId={patient.id} onClose={() => setOpening(false)} />}
    </div>
  );
}

/** The patient's cancer records with how far each form is filled. */
function Episodes({ episodes, canEdit, limit, onOpen }: { episodes: EpisodeSummary[]; canEdit: boolean; limit: number; onOpen: () => void }) {
  // The registry allows `limit` cancer records per patient (a System Admin setting).
  const full = episodes.length >= limit;
  return (
    <Card>
      <SectionTitle right={canEdit && episodes.length > 0
        ? <button className="text-[13px] font-semibold text-forest-600 hover:underline disabled:cursor-not-allowed disabled:text-soot/45 disabled:no-underline"
            onClick={onOpen} disabled={full}
            title={full ? `A patient can have ${limit === 1 ? "one cancer record" : `up to ${limit} cancer records`}` : undefined}>+ New record</button>
        : undefined}>Cancer records</SectionTitle>
      {episodes.length === 0 ? (
        <div>
          <p className="text-[13.5px] text-soot/80">
            {canEdit ? "None yet. Open one with the suspected cancer type; its form shows what to record." : "None recorded."}
          </p>
          {canEdit && <button className="btn-primary mt-3" onClick={onOpen}>Open cancer record</button>}
        </div>
      ) : (
        <ul className="grid gap-2">
          {episodes.map((e) => (
            <li key={e.id}>
              <Link href={`/episodes/${e.id}`} className="block rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-forest-500/50 hover:bg-cream/60">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{e.cancer_type_name}</span>
                  <span className="text-[13px] font-bold tabular-nums text-ink">{e.progress.percent}%</span>
                </div>
                <div className="mt-1.5"><Progress value={e.progress.percent} tone={e.progress.percent >= 80 ? "info" : e.progress.percent >= 40 ? "warn" : "bad"} /></div>
                <p className="mt-1 text-[12.5px] text-soot/72">{e.progress.filled}/{e.progress.total} fields · updated {fmtDate(e.updated_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Pick the suspected cancer type and open a record for it. */
function OpenEpisode({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const router = useRouter();
  const [types, setTypes] = useState<CancerType[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.cancerTypes().then(setTypes).catch((e) => setError(errorText(e)));
  }, []);

  async function open() {
    setBusy(true); setError(null);
    try {
      const ep = await api.createEpisode(patientId, code);
      router.push(`/episodes/${ep.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Open cancer record">
      <p className="text-sm text-soot">Choose the suspected cancer type. If it turns out different, you can change it later on the record.</p>
      <label className="label mt-4">Suspected cancer type</label>
      <Select ariaLabel="Suspected cancer type" value={code} onChange={setCode}
        placeholder={types ? "— choose —" : "Loading…"}
        options={(types ?? []).map((t) => ({ value: t.code, label: t.name }))} />
      {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={open} disabled={busy || !code}>{busy ? "Opening…" : "Open record"}</button>
      </div>
    </Modal>
  );
}

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] text-soot/72">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Restricted({ label }: { label: string }) {
  return (
    <div>
      <dt className="text-[13px] text-soot/72">{label}</dt>
      <dd className="mt-0.5 text-sm italic text-soot/60">Restricted</dd>
    </div>
  );
}

/** Ask the owner for the personal data (view) or for editing too (edit). */
function RequestAccess({ open, onClose, patientId, canView }: { open: boolean; onClose: () => void; patientId: string; canView: boolean }) {
  const [permission, setPermission] = useState<"view" | "edit">(canView ? "edit" : "view");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("busy"); setError(null);
    try {
      await api.requestPatientAccess(patientId, permission, reason.trim());
      setState("sent");
      window.dispatchEvent(new Event("mugis:access-requests-changed"));
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={canView ? "Request edit access" : "Request access"}>
      {state === "sent" ? (
        <>
          <p className="text-sm text-ink">Request sent. You will be emailed when it is decided; track it under <Link href="/patients/access-requests" className="font-semibold text-forest-600 underline underline-offset-2">Access Requests</Link>.</p>
          <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <>
          <p className="text-sm text-soot">The clinician who registered this patient decides. If they have left, a Head of Department of the centre does.</p>
          {!canView && (
            <div className="mt-4 grid gap-2 text-[13.5px] text-ink">
              <label className="flex items-center gap-2">
                <input type="radio" name="req-permission" checked={permission === "view"} onChange={() => setPermission("view")} />
                View — see the name and identity number
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="req-permission" checked={permission === "edit"} onChange={() => setPermission("edit")} />
                View and edit — also update the patient and continue the cancer records
              </label>
            </div>
          )}
          <label className="label mt-4">Reason (optional)</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Taking over follow-up" />
          {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={send} disabled={state === "busy"}>Send request</button>
          </div>
        </>
      )}
    </Modal>
  );
}
