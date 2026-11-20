"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText, API_ROLE_LABELS, type ApiRole, type Centre, type RoleInfo } from "@/lib/api";
import { useTitle } from "@/lib/useTitle";
import AuthFrame, { FormError, Spinner } from "@/components/AuthFrame";
import { Select } from "@/components/Select";
import { registerServerError, validateRegister, type FieldErrors, type RegisterField } from "@/lib/registerValidation";

/** The message under a field, tied to it for screen readers. */
function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return <p id={`${id}-error`} className="mt-1 text-[13px] leading-snug text-danger-700">{text}</p>;
}

/**
 * Public registration. Any email domain. The application is reviewed —
 * consultants and fellows by their centre's HOD (or a Head of Service),
 * HODs by a system administrator — and an activation link is emailed on
 * approval. A Head of Service cannot apply here: an administrator invites
 * them (the server offers only roles with self_register).
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
  // Fields left once (blurred) show their problems; after a submit, all do.
  const [touched, setTouched] = useState<Partial<Record<RegisterField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.centres(), api.roles()])
      .then(([c, r]) => { setCentres(c); setRoles(r.filter((x) => x.self_register)); })
      .catch((e) => setLoadError(errorText(e)));
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((s) => {
      // A changed field drops the server's complaint about it (the ID type also clears the number's).
      if (!s[k as RegisterField] && !(k === "id_type" && s.id_number)) return s;
      const next = { ...s }; delete next[k as RegisterField]; if (k === "id_type") delete next.id_number;
      return next;
    });
    setError(null);
  };
  const touch = (k: RegisterField) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const problems = validateRegister(form, true);
  const shown = (k: RegisterField): string | undefined => {
    if (serverErrors[k]) return serverErrors[k];
    if (submitted || touched[k]) return problems[k];
    // Typing in the confirmation shows a mismatch at once; it reads better than waiting for blur.
    if (k === "confirm" && form.confirm && form.confirm !== form.password) return problems.confirm;
    return undefined;
  };
  const invalid = (k: RegisterField) => ({
    "aria-invalid": shown(k) ? true : undefined,
    "aria-describedby": shown(k) ? `${k}-error` : undefined,
  });
  const bad = (k: RegisterField) => (shown(k) ? " !border-danger-600/60 focus:!ring-danger-600/15" : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const first = (Object.keys(problems) as RegisterField[])[0];
    if (first) {
      setError("Please fix the highlighted fields.");
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true); setError(null); setServerErrors({});
    try {
      const r = await api.register({
        email: form.email.trim(), password: form.password, full_name: form.full_name.trim(),
        phone: form.phone.trim(), id_type: form.id_type, id_number: form.id_number.trim(),
        centre_id: form.centre_id, role: form.role as ApiRole,
      });
      setDone(r.message);
    } catch (err) {
      const r = registerServerError(err);
      if (r.field) {
        setServerErrors({ [r.field]: r.text });
        setError("Please fix the highlighted field.");
        document.getElementById(r.field)?.focus();
      } else setError(r.text);
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
      <form onSubmit={submit} noValidate className="mg-pop">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Request an account</h1>
        <p className="mt-1 text-sm text-soot/80">
          Your request is reviewed before you can sign in.
        </p>

        <FormError>{loadError}</FormError>

        <div className="mt-5 grid grid-cols-1 gap-3.5">
          <div>
            <label htmlFor="full_name" className="label">Full name</label>
            <input id="full_name" className={"input" + bad("full_name")} {...invalid("full_name")} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} onBlur={touch("full_name")} autoComplete="name" placeholder="Dr Nur Aisyah binti Rahman" />
            <FieldError id="full_name" text={shown("full_name")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className={"input" + bad("email")} {...invalid("email")} value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={touch("email")} autoComplete="email" spellCheck={false} placeholder="you@hospital.gov.my" />
              <FieldError id="email" text={shown("email")} />
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone</label>
              <input id="phone" type="tel" className={"input" + bad("phone")} {...invalid("phone")} value={form.phone} onChange={(e) => set("phone", e.target.value)} onBlur={touch("phone")} autoComplete="tel" placeholder="012-345 6789" />
              <FieldError id="phone" text={shown("phone")} />
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
              <input id="id_number" className={"input" + bad("id_number")} {...invalid("id_number")} value={form.id_number} onChange={(e) => set("id_number", e.target.value)} onBlur={touch("id_number")} autoComplete="off" spellCheck={false}
                placeholder={form.id_type === "mykad" ? "900101-14-5678" : "A12345678"} />
              <FieldError id="id_number" text={shown("id_number")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="label">Centre</label>
              <Select
                ariaLabel="Centre"
                value={form.centre_id}
                onChange={(v) => set("centre_id", v)}
                placeholder={centres.length ? "— choose your centre —" : "No centres available"}
                disabled={!centres.length}
                options={centres.map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
                className={bad("centre_id")}
              />
              <FieldError id="centre_id" text={shown("centre_id")} />
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
                className={bad("role")}
              />
              <FieldError id="role" text={shown("role")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" className={"input" + bad("password")} {...invalid("password")} value={form.password} onChange={(e) => set("password", e.target.value)} onBlur={touch("password")} autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="confirm" className="label">Confirm password</label>
              <input id="confirm" type="password" className={"input" + bad("confirm")} {...invalid("confirm")} value={form.confirm} onChange={(e) => set("confirm", e.target.value)} onBlur={touch("confirm")} autoComplete="new-password" />
            </div>
          </div>
          {(() => {
            // One line under both password boxes: the rule, or what is wrong.
            const msg = shown("password") ?? shown("confirm");
            return (
              <p id={shown("password") ? "password-error" : shown("confirm") ? "confirm-error" : undefined}
                className={"-mt-1 text-[13px] " + (msg ? "text-danger-700" : "text-soot/72")}>
                {msg ?? "At least 12 characters, with an uppercase letter, a lowercase letter and a number."}
              </p>
            );
          })()}
        </div>

        <FormError>{error}</FormError>

        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full !py-2.5">
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
