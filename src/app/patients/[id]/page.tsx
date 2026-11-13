"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, ApiError, errorText, type Patient, type PatientInput } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { ageFrom, fmtDate, fmtDateTime, formatMykad } from "@/lib/format";
import PatientForm, { type PatientFormValue } from "@/components/PatientForm";
import { Badge, Card, Modal, PageHeader, SectionTitle } from "@/components/ui";

function toForm(p: Patient): PatientFormValue {
  return {
    full_name: p.full_name, id_type: p.id_type, id_number: p.id_number ?? "",
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
  useTitle(patient ? patient.full_name : "Patient record");

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
  const age = patient.date_of_birth ? ageFrom(patient.date_of_birth) : null;

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
        title={patient.full_name}
        subtitle={`${patient.registry_no} · ${patient.centre.name}`}
        actions={
          editing ? null : patient.can_edit ? (
            <button className="btn-primary" onClick={startEdit}>Edit demography</button>
          ) : (
            <button className="btn-secondary" onClick={() => setAsking(true)}>Request edit access</button>
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
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Full name" value={patient.full_name} />
              <Item label={patient.id_type === "mykad" ? "MyKad" : "Passport"} value={patient.id_number ? (patient.id_type === "mykad" ? formatMykad(patient.id_number) : patient.id_number) : patient.id_number_masked} mono />
              <Item label="Date of birth" value={patient.date_of_birth ? `${fmtDate(patient.date_of_birth)}${age !== null ? ` (${age}y)` : ""}` : undefined} />
              <Item label="Sex" value={patient.sex} />
              <Item label="Ethnic" value={patient.ethnic} />
              <Item label="State" value={patient.state} />
            </dl>
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
          <Card>
            <SectionTitle right={<Badge>Soon</Badge>}>Cancer episodes</SectionTitle>
            <p className="text-[13.5px] text-soot/80">Episodes, staging and treatment come in the next phase.</p>
          </Card>
        </div>
      </div>

      <RequestEdit open={asking} onClose={() => setAsking(false)} patientId={patient.id} />
    </div>
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

function RequestEdit({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("busy"); setError(null);
    try {
      await api.requestPatientAccess(patientId, "edit", reason.trim());
      setState("sent");
      window.dispatchEvent(new Event("mugis:access-requests-changed"));
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request edit access">
      {state === "sent" ? (
        <>
          <p className="text-sm text-ink">Request sent. You will be emailed when it is decided; track it under <Link href="/patients/access-requests" className="font-semibold text-forest-600 underline underline-offset-2">Access Requests</Link>.</p>
          <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <>
          <p className="text-sm text-soot">The clinician who registered this patient decides. If they have left, a Head of Department of the centre does.</p>
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
