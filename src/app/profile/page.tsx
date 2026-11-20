"use client";

import { useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import { api, errorText, API_ROLE_LABELS } from "@/lib/api";
import { initials } from "@/components/Shell";
import { fmtDateTime } from "@/lib/format";
import { passwordProblems } from "@/components/AuthFrame";
import { Badge, Card, Modal, PageHeader, Toast } from "@/components/ui";

export default function ProfilePage() {
  useTitle("Profile");
  const { session, signOut, reloadMe } = useSession();
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!session) return null;
  const me = session.user;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account, centres and sign-in security." />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-forest-500 text-xl font-bold text-white">
            {initials(session.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-display text-xl font-bold text-ink">{me.full_name ?? session.name}</h2>
            <p className="break-all text-sm text-soot/80">{me.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="info">{API_ROLE_LABELS[me.role]}</Badge>
              {me.two_factor_enabled && <Badge tone="ok">2FA enabled</Badge>}
              <Badge tone="muted">{me.status}</Badge>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button onClick={() => setEdit(true)} className="btn-secondary">Edit details</button>
            <button onClick={() => setPw(true)} className="btn-secondary">Change password</button>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2">
          <Item label="Display name" value={me.display_name ?? "—"} />
          <Item label="Phone" value={me.phone ?? "—"} />
          <Item label={me.id_type === "passport" ? "Passport" : "MyKad"} value={me.id_number_masked ?? "—"} />
          <Item label="Working in" value={session.centreName} />
          <Item label="Last sign-in" value={me.last_sign_in_at ? fmtDateTime(me.last_sign_in_at) : "—"} />
          <Item label="Member since" value={fmtDateTime(me.created_at)} />
        </dl>

        {me.centres.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] font-semibold text-soot/72">Centres</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {me.centres.map((c) => (
                <li key={c.id}>
                  <Badge tone={c.id === me.active_centre_id ? "info" : "muted"}>
                    {c.code} · {c.name}{c.is_primary ? " (primary)" : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-8 border-t border-line pt-4 text-center">
        <button
          onClick={() => signOut()}
          className="text-xs text-soot/70 underline-offset-2 transition-colors hover:text-soot hover:underline touch:min-h-[44px] touch:px-4 touch:text-sm"
        >
          Sign out of the registry
        </button>
      </div>

      <EditDetails
        open={edit}
        onClose={() => setEdit(false)}
        initial={{ display_name: me.display_name ?? "", full_name: me.full_name ?? "", phone: me.phone ?? "" }}
        onSaved={async () => { await reloadMe(); setEdit(false); setToast("Details saved"); }}
      />
      <ChangePassword open={pw} onClose={() => setPw(false)} onDone={() => signOut()} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-soot/72">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function EditDetails({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void;
  initial: { display_name: string; full_name: string; phone: string };
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setError(null);
    try {
      await api.updateMe({ display_name: form.display_name.trim(), full_name: form.full_name.trim(), phone: form.phone.trim() || undefined });
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit your details">
      <div className="grid grid-cols-1 gap-3">
        <div><label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="label">Display name</label>
          <input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="How your name appears in the app" /></div>
        <div><label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        {error && <p className="text-[13px] text-danger-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary">Save</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePassword({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weak = next ? passwordProblems(next) : [];

  async function save() {
    if (weak.length) { setError(`Your new password needs ${weak.join(", ")}.`); return; }
    if (next !== confirm) { setError("The two new passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      await api.changePassword(current, next);
      onDone(); // every session is revoked — sign in again
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <div className="grid grid-cols-1 gap-3">
        <div><label className="label">Current password</label>
          <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>
        <div><label className="label">New password</label>
          <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></div>
        <div><label className="label">Confirm new password</label>
          <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
        <p className="text-[13px] text-soot/72">You will be signed out on every device and sign in again with the new password.</p>
        {error && <p className="text-[13px] text-danger-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy || !current || !next || !confirm} className="btn-primary">Change password</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
