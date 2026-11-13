"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, errorText, API_ROLE_LABELS, type ApiRole, type Centre, type RoleInfo } from "@/lib/api";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner, passwordProblems } from "@/components/AuthFrame";
import { Select } from "@/components/Select";

/**
 * Public registration. Any email domain. The application is reviewed —
 * consultants and fellows by their centre's HOD (or a Head of Service),
 * HODs and Heads of Service by a system administrator — and an activation
 * link is emailed on approval.
 */
export default function RegisterPage() {
  useTitle("Request an account");
  const [centres, setCentres] = useState<Centre[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", id_type: "mykad" as "mykad" | "passport", id_number: "",
    centre_id: "", role: "" as ApiRole | "", password: "", confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.centres(), api.roles()])
      .then(([c, r]) => { setCentres(c); setRoles(r.filter((x) => x.self_register)); })
      .catch((e) => setLoadError(errorText(e)));
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const weak = form.password ? passwordProblems(form.password) : [];
  const mismatch = form.confirm !== "" && form.confirm !== form.password;
  const complete = form.full_name.trim() && form.email.trim() && form.phone.trim() && form.id_number.trim()
    && form.centre_id && form.role && form.password && form.confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete || busy) return;
    if (weak.length) { setError(`Your password needs ${weak.join(", ")}.`); return; }
    if (mismatch) { setError("The two passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      const r = await api.register({
        email: form.email.trim(), password: form.password, full_name: form.full_name.trim(),
        phone: form.phone.trim(), id_type: form.id_type, id_number: form.id_number.trim(),
        centre_id: form.centre_id, role: form.role as ApiRole,
      });
      setDone(r.message);
    } catch (err) {
      setError(errorText(err) + (err instanceof ApiError && err.reason === "invalid_request" ? ` (${err.message})` : ""));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthFrame>
        <div className="mg-pop">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Request received</h1>
          <p className="mt-2 text-sm leading-relaxed text-soot/85">
            Thank you. Your registration will be reviewed by your centre&rsquo;s Head of Department
            (or a system administrator). Once it is approved you will get an email with a link to
            activate your account — then sign in with the password you just chose.
          </p>
          <Link href="/" className="btn-primary mt-6 w-full !py-2.5">Back to sign in</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <form onSubmit={submit} className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Request an account</h1>
        <p className="mt-1 text-sm text-soot/80">
          Your request is reviewed before you can sign in.
        </p>

        <FormError>{loadError}</FormError>

        <div className="mt-5 grid gap-3.5">
          <div>
            <label htmlFor="full_name" className="label">Full name</label>
            <input id="full_name" className="input" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" placeholder="Dr Nur Aisyah binti Rahman" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" spellCheck={false} placeholder="you@hospital.gov.my" />
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone</label>
              <input id="phone" type="tel" className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="012-345 6789" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
            <div>
              <label className="label">Identity document</label>
              <Select
                ariaLabel="Identity document"
                value={form.id_type}
                onChange={(v) => set("id_type", v)}
                options={[{ value: "mykad", label: "MyKad" }, { value: "passport", label: "Passport" }]}
              />
            </div>
            <div>
              <label htmlFor="id_number" className="label">{form.id_type === "mykad" ? "MyKad number" : "Passport number"}</label>
              <input id="id_number" className="input" value={form.id_number} onChange={(e) => set("id_number", e.target.value)} autoComplete="off" spellCheck={false}
                placeholder={form.id_type === "mykad" ? "900101-14-5678" : "A12345678"} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Centre</label>
              <Select
                ariaLabel="Centre"
                value={form.centre_id}
                onChange={(v) => set("centre_id", v)}
                placeholder={centres.length ? "— choose your centre —" : "No centres available"}
                disabled={!centres.length}
                options={centres.map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <Select
                ariaLabel="Role"
                value={form.role}
                onChange={(v) => set("role", v as ApiRole)}
                placeholder="— choose your role —"
                options={roles.map((r) => ({ value: r.name, label: API_ROLE_LABELS[r.name], hint: r.description }))}
                menuWidth={320}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="confirm" className="label">Confirm password</label>
              <input id="confirm" type="password" className="input" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <p className={"-mt-1 text-[13px] " + (weak.length || mismatch ? "text-danger-700" : "text-soot/72")}>
            {mismatch ? "The passwords do not match." : weak.length ? `Needs ${weak.join(", ")}.` : "At least 12 characters, with an uppercase letter, a lowercase letter and a number."}
          </p>
        </div>

        <FormError>{error}</FormError>

        <button type="submit" disabled={busy || !complete} className="btn-primary mt-5 w-full !py-2.5">
          {busy ? <><Spinner /> Sending…</> : <>Submit request <span aria-hidden>→</span></>}
        </button>

        <p className="mt-5 text-center text-sm text-soot/80">
          Already have an account?{" "}
          <Link href="/" className="font-semibold text-forest-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
