"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useScoped } from "@/lib/useScoped";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { canEdit } from "@/lib/access";
import { findCentre } from "@/lib/centres";
import { ETHNIC, STATES, requiredFieldIds } from "@/lib/parameters";
import { Select, opts } from "@/components/Select";
import { cancerLabel } from "@/lib/types";
import { completeness, deriveStage, cciScore, stageTone } from "@/lib/staging";
import { ageFrom, fmtDate, fmtDateTime, formatMykad, maskMykad } from "@/lib/format";
import { Badge, Card, EmptyState, Modal, PageHeader, Progress, SectionTitle, Table, Td, Th, Toast } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";

export default function PatientDetailPage() {
  useTitle("Patient record");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { patients, episodes, hidden, session } = useScoped();
  const { state, updatePatient, deletePatient, addEpisode } = useStore();
  const { session: sess } = useSession();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);

  const [reveal, setReveal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const patient = patients.find((p) => p.id === id);
  const eps = useMemo(() => episodes.filter((e) => e.patientId === id), [episodes, id]);
  const audit = useMemo(
    () => state.audit.filter((a) => a.entityId === id || eps.some((e) => e.id === a.entityId)).slice(0, 12),
    [state.audit, id, eps]
  );

  const [form, setForm] = useState(() => patient ? {
    fullName: patient.fullName, mykad: patient.mykad, passport: patient.passport,
    dob: patient.dob, sex: patient.sex, ethnic: patient.ethnic, state: patient.state,
  } : null);

  if (!session || !sess) return null;

  if (!patient) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Patient not found" />
        <EmptyState
          title="No such record, or not visible to you"
          hint={`You are signed in as ${ROLE_LABELS[sess.role]}. Your role may not include this patient.`}
          action={<Link href="/patients" className="btn-secondary">Back to patients</Link>}
        />
      </div>
    );
  }

  const mine = canEdit(sess, patient.createdBy);
  const centre = findCentre(patient.centreId);
  const age = ageFrom(patient.dob);

  function saveEdit() {
    if (!form || !sess) return;
    updatePatient(sess, patient!.id, form);
    setEditing(false);
    setToast("Patient record updated");
  }

  return (
    <div>
      <Link href="/patients" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-soot/75 hover:text-ink">
        ← All patients
      </Link>

      <PageHeader
        title={patient.fullName}
        subtitle={`${patient.registryNo} · ${centre.name}`}
        actions={
          <>
            {!hidden && (
              <button onClick={() => setReveal((v) => !v)} className="btn-secondary">
                {reveal ? "Hide MyKad" : "Reveal MyKad"}
              </button>
            )}
            {mine && <button onClick={() => { setForm({ ...patient }); setEditing(true); }} className="btn-secondary">Edit</button>}
            {mine && <button onClick={() => setConfirmDel(true)} className="btn-secondary !text-danger-700">Delete</button>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Demography</SectionTitle>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              ["Registry number", patient.registryNo],
              ["MyKad", hidden ? "—" : maskMykad(patient.mykad, reveal)],
              ["Passport", patient.passport || "—"],
              ["Date of birth", fmtDate(patient.dob)],
              ["Age", age !== null ? `${age} years` : "—"],
              ["Sex", patient.sex || "—"],
              ["Ethnic", patient.ethnic || "—"],
              ["State", patient.state || "—"],
              ["Centre", `${centre.name} (${centre.code})`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-semibold text-soot/72">{k}</dt>
                <dd className="mt-0.5 text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <SectionTitle>Record</SectionTitle>
          <dl className="space-y-3">
            <div>
              <dt className="text-[13px] font-semibold text-soot/72">Entered by</dt>
              <dd className="mt-0.5 text-sm text-ink">{patient.createdBy}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-soot/72">Created</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmtDateTime(patient.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-soot/72">Last updated</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmtDateTime(patient.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-soot/72">Your access</dt>
              <dd className="mt-1">
                <Badge tone={mine ? "ok" : "muted"}>{mine ? "Read and write" : "Read only"}</Badge>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle right={
          mine ? (
            <button
              onClick={() => { const e = addEpisode(sess, patient.id, "gastric-adeno"); router.push(`/episodes/${e.id}`); }}
              className="text-xs font-semibold text-forest-500 hover:text-forest-600">
              + Add episode
            </button>
          ) : undefined
        }>
          Cancer episodes
        </SectionTitle>

        {eps.length === 0 ? (
          <Card><p className="py-6 text-center text-sm text-soot/75">No episodes recorded for this patient.</p></Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {eps.map((e) => {
              const st = deriveStage(e.data);
              const c = completeness(e.data, req);
              const cci = cciScore(e.data, patient.dob);
              return (
                <Link key={e.id} href={`/episodes/${e.id}`} className="card block p-4 transition-colors hover:border-forest-200 hover:bg-cream/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{cancerLabel(e.cancerType)}</p>
                      <p className="mt-0.5 text-[13px] text-soot/75">
                        Dx {fmtDate(String(e.data.dateDiagnosis ?? ""))} · updated {fmtDate(e.updatedAt)}
                      </p>
                    </div>
                    <Badge tone={e.status === "active" ? "ok" : e.status === "draft" ? "warn" : "muted"}>{e.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={stageTone(st.stage)}>{st.stage ? `Stage ${st.stage}` : "Stage not derived"}</Badge>
                    <Badge tone={cci.score >= 5 ? "bad" : cci.score >= 3 ? "warn" : "ok"}>CCI {cci.score}</Badge>
                    {e.data.surgery && e.data.surgery !== "No Surgery" && <Badge tone="info">{String(e.data.surgery)}</Badge>}
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[12px] text-soot/75">
                      <span>Completeness</span><span className="tabular-nums">{c.pct}%</span>
                    </div>
                    <Progress value={c.pct} tone={c.pct >= 80 ? "info" : c.pct >= 50 ? "warn" : "bad"} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <SectionTitle>Audit trail for this patient</SectionTitle>
        <Table head={<tr><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Detail</Th></tr>} minWidth={620}>
          {audit.map((a) => (
            <tr key={a.id}>
              <Td><span className="text-xs tabular-nums text-soot/80">{fmtDateTime(a.at)}</span></Td>
              <Td><Badge tone={a.action === "create" ? "ok" : a.action === "delete" ? "bad" : "info"}>{a.action}</Badge></Td>
              <Td><span className="text-xs text-soot">{a.userEmail}</span></Td>
              <Td>
                <span className="text-xs text-ink">{a.entityLabel}</span>
                {a.changes?.length ? (
                  <span className="ml-1 text-[13px] text-soot/75">
                    ({a.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; ")})
                  </span>
                ) : null}
              </Td>
            </tr>
          ))}
          {audit.length === 0 && <tr><Td><span className="text-sm text-soot/75">No entries.</span></Td></tr>}
        </Table>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit demography">
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Full name</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="label">MyKad</label>
              <input className="input font-mono" value={form.mykad} onChange={(e) => setForm({ ...form, mykad: formatMykad(e.target.value) })} inputMode="numeric" />
            </div>
            <div>
              <label className="label">Passport</label>
              <input className="input font-mono" value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <DatePicker value={form.dob} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => setForm({ ...form, dob: iso })} />
            </div>
            <div>
              <label className="label">Sex</label>
              <Select
                ariaLabel="Sex"
                value={form.sex}
                onChange={(v) => setForm({ ...form, sex: v as "Male" | "Female" })}
                options={[{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }]}
              />
            </div>
            <div>
              <label className="label">Ethnic</label>
              <Select
                ariaLabel="Ethnic"
                value={form.ethnic}
                onChange={(v) => setForm({ ...form, ethnic: v })}
                options={opts(ETHNIC)}
              />
            </div>
            <div>
              <label className="label">State</label>
              <Select
                ariaLabel="State"
                value={form.state}
                onChange={(v) => setForm({ ...form, state: v })}
                options={opts(STATES)}
              />
            </div>
            <div className="mt-2 flex gap-2 sm:col-span-2">
              <button onClick={saveEdit} className="btn-primary">Save changes</button>
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete patient record">
        <p className="text-sm text-soot">
          This removes <span className="font-semibold text-ink">{patient.fullName}</span> and every
          episode attached to the record. The deletion itself is written to the audit trail.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { deletePatient(sess, patient.id); router.push("/patients"); }}
            className="btn bg-danger-600 text-white hover:bg-danger-700">
            Delete permanently
          </button>
          <button onClick={() => setConfirmDel(false)} className="btn-secondary">Cancel</button>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
