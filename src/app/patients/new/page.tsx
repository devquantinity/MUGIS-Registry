"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, ApiError, errorText, type PatientLookup } from "@/lib/api";
import PatientForm, { emptyPatient, identityComplete, identityProblem, type PatientFormValue } from "@/components/PatientForm";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { Select } from "@/components/Select";

/** Register a patient (POST /patients), warning about duplicates as you type. */
export default function NewPatientPage() {
  useTitle("New patient");
  const router = useRouter();
  const { session } = useSession();
  const [form, setForm] = useState<PatientFormValue>(emptyPatient);
  const [centreId, setCentreId] = useState(session?.centreId ?? "");
  const [lookup, setLookup] = useState<PatientLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Where this user may add patients: the centres they belong to (a Head of
  // Service belongs to every centre unless an administrator removed some).
  const centreOptions = useMemo(
    () => (session?.user.centres ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code })),
    [session],
  );

  // Duplicate check once the identity number is complete.
  const complete = identityComplete(form);
  useEffect(() => {
    setLookup(null);
    if (!complete) return;
    let alive = true;
    const t = window.setTimeout(() => {
      api.lookupPatient(form.id_type, form.id_number).then((r) => { if (alive) setLookup(r); }).catch(() => undefined);
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
  }, [complete, form.id_type, form.id_number]);

  if (!session) return null;
  if (!CLINICAL.includes(session.role)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="New patient" />
        <Card><p className="text-sm text-soot">System administrators do not work with patient records.</p></Card>
      </div>
    );
  }

  const blocked = lookup?.status === "visible" || lookup?.status === "exists";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.full_name.trim() || !form.id_number.trim()) { setError("Full name and identity number are required."); return; }
    const idProblem = identityProblem(form);
    if (idProblem || !identityComplete(form)) { setError(idProblem ?? "Enter a complete identity number."); return; }
    setBusy(true); setError(null);
    try {
      const p = await api.createPatient({
        full_name: form.full_name.trim(), id_type: form.id_type, id_number: form.id_number,
        date_of_birth: form.date_of_birth || undefined, sex: form.sex || undefined,
        ethnic: form.ethnic || undefined, state: form.state || undefined,
        centre_id: centreId || undefined,
      });
      router.push(`/patients/${p.id}`);
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiError && (err.reason === "patient_exists" || err.reason === "patient_exists_elsewhere")) {
        api.lookupPatient(form.id_type, form.id_number).then(setLookup).catch(() => undefined);
      }
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New patient" subtitle="Demography. Only the name and an identity number are required — the rest can be completed later." />
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Demography</SectionTitle>
          <PatientForm value={form} onChange={setForm} />
          {lookup && <Duplicate lookup={lookup} idType={form.id_type} idNumber={form.id_number} />}
          {error && !blocked && <p className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">{error}</p>}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <SectionTitle>Centre</SectionTitle>
            {centreOptions.length > 1 ? (
              <Select ariaLabel="Centre" value={centreId} onChange={setCentreId} options={centreOptions} placeholder="— choose —" />
            ) : (
              <p className="text-sm text-ink">{session.centreName}</p>
            )}
            <p className="mt-2 text-[13px] text-soot/72">
              The registry number is issued per centre, e.g. MUG-{centreOptions.find((c) => c.value === centreId)?.hint ?? session.centreCode}-000001.
            </p>
          </Card>
          <button type="submit" disabled={busy || blocked} className="btn-primary w-full !py-2.5">
            {busy ? "Saving…" : "Register patient"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** What to do when the identity number is already registered. */
function Duplicate({ lookup, idType, idNumber }: { lookup: PatientLookup; idType: "mykad" | "passport"; idNumber: string }) {
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (lookup.status === "none") {
    return <p className="mt-4 text-[13px] text-sage-700">✓ Not yet registered.</p>;
  }
  if (lookup.status === "visible") {
    return (
      <div className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-2.5 text-[13.5px] text-goldink/85">
        This patient is already registered as <span className="font-mono font-semibold">{lookup.registry_no}</span>.{" "}
        <Link href={`/patients/${lookup.patient_id}`} className="font-semibold underline underline-offset-2">Open the record</Link>
      </div>
    );
  }

  async function send() {
    setState("busy"); setError(null);
    try {
      // By identity number: which record it is stays hidden until access is granted.
      await api.requestAccessByIdentity({ id_type: idType, id_number: idNumber, permission, reason: reason.trim() });
      setState("sent");
      window.dispatchEvent(new Event("mugis:access-requests-changed"));
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-300/60 bg-gold-100/60 px-3 py-3 text-[13.5px] text-goldink/85">
      <p>This patient is already registered by another doctor. Their details stay with that doctor, but you can ask for access.</p>
      {state === "sent" ? (
        <p className="mt-2 font-semibold">Request sent — you will be emailed when it is decided. Track it under Access Requests.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-end">
          <div>
            <label className="label">Access</label>
            <Select ariaLabel="Access" value={permission} onChange={(v) => setPermission(v as "view" | "edit")}
              options={[{ value: "view", label: "View" }, { value: "edit", label: "View and edit" }]} />
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Patient referred to me" />
          </div>
          <button type="button" onClick={send} disabled={state === "busy"} className="btn-primary">Request access</button>
          {error && <p className="text-danger-700 sm:col-span-3">{error}</p>}
        </div>
      )}
    </div>
  );
}
