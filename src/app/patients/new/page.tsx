"use client";

import { useRouter } from "next/navigation";
import { useTitle } from "@/lib/useTitle";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canCreate } from "@/lib/access";
import { CENTRES, findCentre } from "@/lib/centres";
import { ETHNIC, STATES, schemaFor } from "@/lib/parameters";
import { hashId, ageFrom, formatMykad, mykadIdentity } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";

export default function NewPatientPage() {
  useTitle("New patient");
  const router = useRouter();
  const { session } = useSession();
  const { state, addPatient, addEpisode } = useStore();
  const groups = useMemo(() => schemaFor("gastric-adeno"), []);

  const [form, setForm] = useState({
    fullName: "", mykad: "", passport: "", dob: "", sex: "" as "" | "Male" | "Female",
    ethnic: "", state: "", centreId: session?.centreId ?? CENTRES[0].id,
  });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // MyKad drives identity: dashes insert themselves, and once the number is
  // plausible the date of birth (first six digits) and sex (last digit) fill
  // in automatically — both stay editable.
  function onMykad(raw: string) {
    const mykad = formatMykad(raw);
    const { dob, sex } = mykadIdentity(mykad);
    setForm((f) => ({ ...f, mykad, dob: dob ?? f.dob, sex: sex ?? f.sex }));
  }

  const duplicate = useMemo(() => {
    const k = form.mykad.trim();
    if (k.length < 12) return null;
    const target = hashId(k);
    const hit = state.patients.find((p) => hashId(p.mykad) === target);
    if (!hit) return null;
    return { sameCentre: hit.centreId === form.centreId, centre: findCentre(hit.centreId), hash: target };
  }, [form.mykad, form.centreId, state.patients]);

  const age = form.dob ? ageFrom(form.dob) : null;
  const filled = ["fullName", "mykad", "dob", "sex", "ethnic", "state"]
    .filter((k) => form[k as keyof typeof form]).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!session) return;
    // Nothing is mandatory — the registry philosophy is save-part-complete.
    // Only impossible data (future DOB) and same-centre duplicates block.
    if (form.dob && new Date(form.dob) > new Date()) return setError("Date of birth cannot be in the future.");
    if (duplicate?.sameCentre) return setError("This patient already exists in your centre.");

    const p = addPatient(session, {
      fullName: form.fullName.trim() || "Unnamed patient", mykad: form.mykad.trim(), passport: form.passport.trim(),
      dob: form.dob, sex: form.sex, ethnic: form.ethnic, state: form.state, centreId: form.centreId,
    });
    const ep = addEpisode(session, p.id, "gastric-adeno");
    router.push(`/episodes/${ep.id}`);
  }

  if (!session) return null;
  if (!canCreate(session)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="New patient" />
        <Card><p className="text-sm text-soot">Your role does not permit creating records.</p></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1250px]">
      <PageHeader
        title="New patient"
        subtitle="Step 1 of 12 — Demography. The clinical groups follow, one step at a time."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* -------- form -------- */}
        <form onSubmit={submit} className="lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle>Demography</SectionTitle>
              <span className="text-[11px] tabular-nums text-soot/60">{filled}/6 core fields</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Full name</label>
                <input className="input" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)}
                  placeholder="As per identity document" autoFocus />
              </div>
              <div>
                <label className="label">MyKad No</label>
                <input className="input font-mono" value={form.mykad} onChange={(e) => onMykad(e.target.value)}
                  inputMode="numeric" placeholder="000000-00-0000" />
                <p className="mt-1 text-[11px] text-soot/55">Dashes, date of birth and sex fill in automatically.</p>
              </div>
              <div>
                <label className="label">Passport No</label>
                <input className="input font-mono" value={form.passport} onChange={(e) => set("passport")(e.target.value)}
                  placeholder="Non-citizens only" />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <DatePicker value={form.dob} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => set("dob")(iso)} placeholder="Date of birth" />
                {form.dob && (age !== null ? <p className="mt-1 text-[11px] text-soot/60">Age {age}</p> : <p className="mt-1 text-[11px] font-semibold text-danger-600">Date is in the future</p>)}
              </div>
              <div>
                <label className="label">Sex</label>
                <select className="input" value={form.sex} onChange={(e) => set("sex")(e.target.value)}>
                  <option value="">— select —</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div>
                <label className="label">Ethnic</label>
                <select className="input" value={form.ethnic} onChange={(e) => set("ethnic")(e.target.value)}>
                  <option value="">— select —</option>
                  {ETHNIC.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="label">State</label>
                <select className="input" value={form.state} onChange={(e) => set("state")(e.target.value)}>
                  <option value="">— select —</option>
                  {STATES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Centre</label>
                <select className="input" value={form.centreId} onChange={(e) => set("centreId")(e.target.value)}>
                  {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button type="submit" className="btn-primary">Continue to Step 2 — Referrals →</button>
              <button type="button" onClick={() => router.back()} className="btn-secondary">← Back</button>
            </div>
          </Card>
        </form>

        {/* -------- right rail: steps ahead + identity check -------- */}
        <div className="space-y-4">
          <Card>
            <SectionTitle>Identity check</SectionTitle>
            {form.mykad.trim().length < 12 ? (
              <p className="text-xs leading-relaxed text-soot/60">
                Enter the MyKad number and the registry checks — by hashed identifier — whether
                this patient already exists at any centre, without exposing anyone&apos;s clinical data.
              </p>
            ) : duplicate ? (
              <div className={"rounded-xl border px-3 py-2.5 " +
                (duplicate.sameCentre ? "border-danger-200 bg-danger-50" : "border-gold-300 bg-gold-100/70")}>
                <Badge tone={duplicate.sameCentre ? "bad" : "warn"}>
                  {duplicate.sameCentre ? "Duplicate in your centre" : "Exists at another centre"}
                </Badge>
                <p className="mt-1.5 text-xs leading-relaxed text-soot">
                  {duplicate.sameCentre
                    ? "Open the existing record rather than creating a second one."
                    : `Registered at ${duplicate.centre.name}. You may still register here — none of their clinical data is shown to you.`}
                </p>
                <p className="mt-1 font-mono text-[10px] text-soot/50">hash {duplicate.hash}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-sage-600/25 bg-sage-100 px-3 py-2.5">
                <Badge tone="ok">No match found</Badge>
                <p className="mt-1.5 text-xs text-soot">This identifier is new to the registry.</p>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>The steps ahead</SectionTitle>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2.5 rounded-lg bg-forest-50 px-2.5 py-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-500 text-[10px] font-bold text-white">1</span>
                <span className="text-xs font-semibold text-forest-600">Demography — you are here</span>
              </li>
              {groups.map((g) => (
                <li key={g.id} className="flex items-center gap-2.5 px-2.5 py-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[10px] font-bold text-soot/60">{g.no}</span>
                  <span className="text-xs text-soot/70">{g.title}</span>
                  <span className="ml-auto text-[10px] tabular-nums text-soot/40">
                    {g.fields.filter((f) => f.type !== "computed").length} fields
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-soot/60">
              Nothing is mandatory after this step — the record saves part-complete and shows a
              completeness score, so data can be entered as it becomes available.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
