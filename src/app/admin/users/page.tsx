"use client";

import { useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS, type Role } from "@/lib/session";
import { canAdmin, scopeLabel } from "@/lib/access";
import { CENTRES, findCentre } from "@/lib/centres";
import { fmtDateTime, relTime } from "@/lib/format";
import { Badge, Card, Modal, PageHeader, Stat, Table, Td, Th, Toast } from "@/components/ui";

const NOW = new Date("2026-08-08T09:00:00Z").getTime();

export default function AdminUsersPage() {
  useTitle("Users");
  const { state, updateUser, addUser } = useStore();
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "clinician" as Role, centreId: CENTRES[0].id });

  const users = useMemo(() => {
    let out = state.users;
    const s = q.trim().toLowerCase();
    if (s) out = out.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    if (roleF !== "all") out = out.filter((u) => u.role === roleF);
    return out;
  }, [state.users, q, roleF]);

  const counts = useMemo(() => ({
    total: state.users.length,
    active: state.users.filter((u) => u.status === "active").length,
    no2fa: state.users.filter((u) => !u.twoFactor).length,
    suspended: state.users.filter((u) => u.status === "suspended").length,
  }), [state.users]);

  if (!session) return null;
  if (!canAdmin(session)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Users" />
        <Card><p className="text-sm text-soot">Only a System Admin can manage users.</p></Card>
      </div>
    );
  }

  function sendInvite() {
    if (!session) return;
    if (!form.name.trim() || !form.email.trim()) { setToast("Name and email are required"); return; }
    addUser(session, { ...form, status: "invited", twoFactor: true });
    setInvite(false);
    setForm({ name: "", email: "", role: "clinician", centreId: CENTRES[0].id });
    setToast("Invitation created — the user sets their own password");
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Accounts are created here. There is no self-registration."
        actions={<button onClick={() => setInvite(true)} className="btn-primary">Invite user</button>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total accounts" value={counts.total} tone="info" />
        <Stat label="Active" value={counts.active} tone="ok" />
        <Stat label="Without 2FA" value={counts.no2fa} sub="should be zero" tone={counts.no2fa ? "bad" : "ok"} />
        <Stat label="Suspended" value={counts.suspended} tone="muted" />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <input className="input" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={roleF} onChange={(e) => setRoleF(e.target.value)}>
              <option value="all">All roles</option>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Table head={
        <tr><Th>Name</Th><Th>Email</Th><Th>Role &amp; scope</Th><Th>Centre</Th>
          <Th align="center">2FA</Th><Th align="center">Status</Th><Th align="right">Last active</Th></tr>
      } minWidth={980}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-cream/50">
            <Td><span className="font-medium text-ink">{u.name}</span></Td>
            <Td><span className="text-xs text-soot">{u.email}</span></Td>
            <Td>
              <select className="input !py-1 !text-xs" value={u.role}
                onChange={(e) => { updateUser(session, u.id, { role: e.target.value as Role }); setToast(`${u.name} is now ${ROLE_LABELS[e.target.value as Role]}`); }}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <span className="mt-1 block text-[12px] text-soot/72">{scopeLabel(u.role)}</span>
            </Td>
            <Td><Badge tone="muted">{findCentre(u.centreId).code}</Badge></Td>
            <Td align="center">
              <button
                onClick={() => { updateUser(session, u.id, { twoFactor: !u.twoFactor }); setToast(`2FA ${u.twoFactor ? "disabled" : "enabled"} for ${u.name}`); }}
                className={"rounded-full px-2 py-0.5 text-[13px] font-semibold " + (u.twoFactor ? "bg-sage-100 text-sage-700" : "bg-danger-50 text-danger-700")}>
                {u.twoFactor ? "On" : "Off"}
              </button>
            </Td>
            <Td align="center">
              <select className="input !py-1 !text-xs" value={u.status}
                onChange={(e) => { updateUser(session, u.id, { status: e.target.value as "active" | "invited" | "suspended" }); setToast(`${u.name} — ${e.target.value}`); }}>
                <option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option>
              </select>
            </Td>
            <Td align="right"><span className="text-xs text-soot/80" title={fmtDateTime(u.lastActive)}>{relTime(u.lastActive, NOW)}</span></Td>
          </tr>
        ))}
        {users.length === 0 && <tr><Td><span className="text-sm text-soot/75">No users match.</span></Td></tr>}
      </Table>

      <Modal open={invite} onClose={() => setInvite(false)} title="Invite a user">
        <div className="grid gap-3">
          <div><label className="label">Full name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr Nur Aisyah" /></div>
          <div><label className="label">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@hospital.gov.my" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <p className="mt-1 text-[13px] text-soot/75">{scopeLabel(form.role)}</p></div>
            <div><label className="label">Centre</label>
              <select className="input" value={form.centreId} onChange={(e) => setForm({ ...form, centreId: e.target.value })}>
                {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <p className="rounded-xl border border-line bg-cream px-3 py-2 text-[13px] leading-relaxed text-soot/80">
            The user receives an invitation link, sets their own password and enrols an
            authenticator app. Two-factor authentication is enabled by default.
          </p>
          <div className="flex gap-2">
            <button onClick={sendInvite} className="btn-primary">Send invitation</button>
            <button onClick={() => setInvite(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
