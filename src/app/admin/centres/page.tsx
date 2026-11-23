"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import { api, errorText, type Centre } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, Modal, PageHeader, Stat, Table, Td, Th, Toast } from "@/components/ui";

type Form = { code: string; name: string; state: string };
const emptyForm: Form = { code: "", name: "", state: "" };

/** SYSTEM_ADMIN: participating centres (GET/POST/PATCH /admin/centres). */
export default function AdminCentresPage() {
  useTitle("Centres");
  const { session } = useSession();
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Centre | "new" | null>(null);
  const [confirm, setConfirm] = useState<Centre | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminCentres().then((c) => { setCentres(c); setLoadError(null); }).catch((e) => setLoadError(errorText(e)));
  }, []);
  useEffect(() => { if (session && session.role === "admin") load(); }, [session, load]);

  const counts = useMemo(() => ({
    total: centres?.length ?? 0,
    active: centres?.filter((c) => c.is_active).length ?? 0,
  }), [centres]);

  if (!session) return null;
  if (session.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Centres" />
        <Card><p className="text-sm text-soot">Only a System Admin can manage centres.</p></Card>
      </div>
    );
  }

  async function setActive(c: Centre, is_active: boolean) {
    try {
      await api.updateCentre(c.id, { is_active });
      setToast(`${c.code} ${is_active ? "reactivated" : "deactivated"}`);
      load();
    } catch (e) {
      setToast(errorText(e));
    }
    setConfirm(null);
  }

  return (
    <div>
      <PageHeader
        title="Participating centres"
        subtitle="Active centres appear on the registration form. Deactivating one stops new members joining; current members keep it until moved."
        actions={<button onClick={() => setEditing("new")} className="btn-primary">Add centre</button>}
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Centres" value={counts.total} tone="info" />
        <Stat label="Active" value={counts.active} tone="ok" />
        <Stat label="Inactive" value={counts.total - counts.active} tone="muted" />
      </div>

      {loadError && <Card className="mb-4"><p className="text-sm text-danger-700">{loadError}</p></Card>}

      {/* Phones and tablets: a card per centre. */}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
        {(centres ?? []).map((c) => (
          <li key={c.id} className="card flex min-w-0 flex-col p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <div className="min-w-0 grow basis-40">
                <p className="text-base font-semibold leading-snug text-ink">{c.name}</p>
                <p className="mt-0.5 text-[13.5px] text-soot"><span className="font-semibold text-ink">{c.code}</span>{c.state ? ` · ${c.state}` : ""}</p>
              </div>
              <Badge tone={c.is_active ? "ok" : "muted"} className="mt-0.5 shrink-0">{c.is_active ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="mt-1 text-[12.5px] text-soot/72">Updated {fmtDateTime(c.updated_at)}</p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <button onClick={() => setEditing(c)} className="btn-secondary">Edit</button>
              {c.is_active
                ? <button onClick={() => setConfirm(c)} className="btn-secondary">Deactivate</button>
                : <button onClick={() => setActive(c, true)} className="btn-secondary">Reactivate</button>}
            </div>
          </li>
        ))}
        {centres && centres.length === 0 && (
          <li className="card p-4 text-sm text-soot/75">No centres yet — add the first one. Nobody can register until a centre exists.</li>
        )}
        {!centres && !loadError && <li className="card p-4 text-sm text-soot/75">Loading…</li>}
      </ul>

      <Table className="hidden lg:block" head={
        <tr><Th>Centre</Th><Th>Code</Th><Th>State</Th><Th align="center">Status</Th><Th align="right">Updated</Th><Th align="right"> </Th></tr>
      } minWidth={820}>
        {(centres ?? []).map((c) => (
          <tr key={c.id} className="hover:bg-cream/50">
            <Td><span className="font-medium text-ink">{c.name}</span></Td>
            <Td><Badge tone="muted">{c.code}</Badge></Td>
            <Td><span className="text-xs text-soot">{c.state ?? "—"}</span></Td>
            <Td align="center"><Badge tone={c.is_active ? "ok" : "muted"}>{c.is_active ? "Active" : "Inactive"}</Badge></Td>
            <Td align="right"><span className="text-xs text-soot/80">{fmtDateTime(c.updated_at)}</span></Td>
            <Td align="right">
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setEditing(c)} className="btn-secondary !px-2.5 !py-1 text-[13px]">Edit</button>
                {c.is_active
                  ? <button onClick={() => setConfirm(c)} className="btn-secondary !px-2.5 !py-1 text-[13px]">Deactivate</button>
                  : <button onClick={() => setActive(c, true)} className="btn-secondary !px-2.5 !py-1 text-[13px]">Reactivate</button>}
              </div>
            </Td>
          </tr>
        ))}
        {centres && centres.length === 0 && (
          <tr><Td><span className="text-sm text-soot/75">No centres yet — add the first one. Nobody can register until a centre exists.</span></Td></tr>
        )}
        {!centres && !loadError && <tr><Td><span className="text-sm text-soot/75">Loading…</span></Td></tr>}
      </Table>

      <CentreForm
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={(msg) => { setEditing(null); setToast(msg); load(); }}
      />

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Deactivate ${confirm?.code ?? ""}?`}>
        <p className="text-sm leading-relaxed text-soot">
          {confirm?.name} disappears from the registration form and nobody new can be added to it.
          People already at this centre keep it until an administrator moves them.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirm(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => confirm && setActive(confirm, false)} className="btn bg-danger-600 text-white hover:bg-danger-700">Deactivate</button>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function CentreForm({ target, onClose, onSaved }: {
  target: Centre | "new" | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    setForm(target && target !== "new" ? { code: target.code, name: target.name, state: target.state ?? "" } : emptyForm);
  }, [target]);

  const isNew = target === "new";
  const codeOk = /^[A-Za-z0-9]{2,20}$/.test(form.code.trim());

  async function save() {
    if (!codeOk || !form.name.trim()) {
      setError("Code must be 2–20 letters or numbers, and the name is required.");
      return;
    }
    setBusy(true); setError(null);
    const body = { code: form.code.trim(), name: form.name.trim(), state: form.state.trim() || undefined };
    try {
      if (isNew) {
        await api.createCentre(body);
        onSaved(`${body.code.toUpperCase()} added`);
      } else if (target) {
        await api.updateCentre(target.id, body);
        onSaved(`${body.code.toUpperCase()} updated`);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={target !== null} onClose={onClose} title={isNew ? "Add a centre" : "Edit centre"}>
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
          <div><label className="label">Code</label>
            <input className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="HKL" maxLength={20} /></div>
          <div><label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hospital Kuala Lumpur" /></div>
        </div>
        <div><label className="label">State</label>
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="WP Kuala Lumpur" /></div>
        <p className="text-[13px] text-soot/72">The code is letters and numbers only, stored in capitals and unique.</p>
        {error && <p className="text-[13px] text-danger-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary">{isNew ? "Add centre" : "Save changes"}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
