"use client";

import { useCallback, useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import { canAdmin } from "@/lib/access";
import {
  api, errorText, API_ROLE_LABELS, CLINICAL_ROLES,
  type AdminUser, type ApiRole, type Centre, type Page, type StaffSummary, type UserStatus,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, Modal, PageHeader, Table, Td, Th, Toast } from "@/components/ui";
import { Select } from "@/components/Select";

const STATUS_LABEL: Record<UserStatus, string> = {
  invited: "Invited", pending_approval: "Awaiting approval", approved: "Awaiting activation",
  active: "Active", rejected: "Rejected", suspended: "Suspended",
};
const STATUS_TONE: Record<UserStatus, "ok" | "muted" | "warn" | "bad" | "info"> = {
  invited: "info", pending_approval: "warn", approved: "warn", active: "ok", rejected: "bad", suspended: "muted",
};
const PAGE_SIZE = 25;

/** SYSTEM_ADMIN: the user directory (GET/POST/PATCH /admin/users). */
export default function AdminUsersPage() {
  useTitle("Users");
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [centre, setCentre] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminUser[]; page: Page } | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<AdminUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = !!session && canAdmin(session);

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    api.users({ q: query, role, status, centre_id: centre, page, page_size: PAGE_SIZE })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [query, role, status, centre, page]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  useEffect(() => { if (isAdmin) api.adminCentres().then(setCentres).catch(() => undefined); }, [isAdmin]);

  if (!session) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Users" />
        <Card><p className="text-sm text-soot">Only a System Admin can manage users.</p></Card>
      </div>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.page.total / PAGE_SIZE)) : 1;
  const done = (msg: string) => { setToast(msg); load(); };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Everyone with an account, in any state. Clinical staff normally self-register and are approved under Registrations; invite here to add someone directly."
        actions={<button onClick={() => setInviting(true)} className="btn-primary">Invite user</button>}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="label">Search</label>
            <input className="input" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="label">Role</label>
            <Select ariaLabel="Filter by role" value={role} onChange={(v) => { setRole(v); setPage(1); }}
              placeholder="All roles"
              options={[{ value: "", label: "All roles" }, ...(Object.keys(API_ROLE_LABELS) as ApiRole[]).map((r) => ({ value: r, label: API_ROLE_LABELS[r] }))]} />
          </div>
          <div>
            <label className="label">Status</label>
            <Select ariaLabel="Filter by status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
              placeholder="Any status"
              options={[{ value: "", label: "Any status" }, ...(Object.keys(STATUS_LABEL) as UserStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
          </div>
          <div>
            <label className="label">Centre</label>
            <Select ariaLabel="Filter by centre" value={centre} onChange={(v) => { setCentre(v); setPage(1); }}
              placeholder="All centres"
              options={[{ value: "", label: "All centres" }, ...centres.map((c) => ({ value: c.id, label: c.name, hint: c.code }))]} />
          </div>
        </div>
      </Card>

      {error && <Card className="mb-4"><p className="text-sm text-danger-700">{error}</p></Card>}

      <Table head={
        <tr><Th>Name</Th><Th>Role</Th><Th>Centre</Th><Th align="center">2FA</Th><Th align="center">Status</Th><Th align="right">Last active</Th><Th align="right"> </Th></tr>
      } minWidth={980}>
        {(data?.items ?? []).map((u) => (
          <tr key={u.id} className="hover:bg-cream/50">
            <Td>
              <span className="block font-medium text-ink">{u.full_name ?? u.email}</span>
              <span className="block text-xs text-soot">{u.email}</span>
            </Td>
            <Td><span className="text-sm text-ink">{API_ROLE_LABELS[u.role]}</span></Td>
            <Td>{u.primary_centre ? <Badge tone="muted">{u.primary_centre.code}</Badge> : <span className="text-xs text-soot/60">—</span>}</Td>
            <Td align="center"><Badge tone={u.two_factor_enabled ? "ok" : "bad"}>{u.two_factor_enabled ? "On" : "Not set up"}</Badge></Td>
            <Td align="center"><Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge></Td>
            <Td align="right"><span className="text-xs text-soot/80">{u.last_active_at ? fmtDateTime(u.last_active_at) : "—"}</span></Td>
            <Td align="right">
              <button onClick={() => setManaging(u)} className="btn-secondary !px-2.5 !py-1 text-[13px]">Manage</button>
            </Td>
          </tr>
        ))}
        {data && data.items.length === 0 && <tr><Td><span className="text-sm text-soot/75">No users match.</span></Td></tr>}
        {!data && !error && <tr><Td><span className="text-sm text-soot/75">Loading…</span></Td></tr>}
      </Table>

      {data && data.page.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-soot">
          <span>{data.page.total} users · page {page} of {pages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn-secondary !py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      <ManageUser
        userId={managing?.id ?? null}
        selfId={session.user.id}
        centres={centres}
        onClose={() => setManaging(null)}
        onChanged={done}
      />
      <InviteUser open={inviting} centres={centres} onClose={() => setInviting(false)} onInvited={(m) => { setInviting(false); done(m); }} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ---- consultant picker for a fellow's supervisor ------------------------ */
function useConsultants(centreIds: string[]): StaffSummary[] {
  const [list, setList] = useState<StaffSummary[]>([]);
  const key = centreIds.join(",");
  useEffect(() => {
    if (!key) { setList([]); return; }
    Promise.all(key.split(",").map((id) => api.consultants(id).catch(() => [] as StaffSummary[])))
      .then((lists) => {
        const seen = new Map<string, StaffSummary>();
        lists.flat().forEach((s) => seen.set(s.id, s));
        setList([...seen.values()]);
      });
  }, [key]);
  return list;
}

/* ---- manage one user ---------------------------------------------------- */
function ManageUser({ userId, selfId, centres, onClose, onChanged }: {
  userId: string | null; selfId: string; centres: Centre[];
  onClose: () => void; onChanged: (msg: string) => void;
}) {
  const [u, setU] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<ApiRole | "">("");
  const [centreIds, setCentreIds] = useState<string[]>([]);
  const [primary, setPrimary] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setU(null); setError(null); setConfirmReset(false);
    if (!userId) return;
    api.user(userId).then((x) => {
      setU(x);
      setRole(x.role);
      setCentreIds((x.centres ?? []).map((c) => c.id));
      setPrimary(x.primary_centre?.id ?? "");
      setSupervisor(x.supervisor_id ?? "");
    }).catch((e) => setError(errorText(e)));
  }, [userId]);

  const consultants = useConsultants(role === "FELLOW" ? centreIds : []);

  if (!userId) return null;
  const isAdminUser = u?.role === "SYSTEM_ADMIN";
  const isSelf = u?.id === selfId;
  const multi = role === "FELLOW";

  async function run(body: Parameters<typeof api.updateUser>[1], msg: string) {
    if (!u) return;
    setBusy(true); setError(null);
    try {
      const x = await api.updateUser(u.id, body);
      setU(x);
      onChanged(msg);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function saveAccess() {
    if (!u || !role) return;
    const body: Parameters<typeof api.updateUser>[1] = {};
    if (role !== u.role) body.role = role as ApiRole;
    const current = (u.centres ?? []).map((c) => c.id).sort().join(",");
    if (centreIds.slice().sort().join(",") !== current || primary !== (u.primary_centre?.id ?? "")) {
      body.centre_ids = centreIds;
      if (primary && centreIds.includes(primary)) body.primary_centre_id = primary;
    }
    if (role === "FELLOW" && supervisor && supervisor !== (u.supervisor_id ?? "")) body.supervisor_id = supervisor;
    if (Object.keys(body).length === 0) { setError("Nothing has changed."); return; }
    run(body, `${u.full_name ?? u.email} updated — they will sign in again`);
  }

  function toggleCentre(id: string) {
    if (multi) {
      setCentreIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
      if (!primary) setPrimary(id);
    } else {
      setCentreIds([id]);
      setPrimary(id);
    }
  }

  return (
    <Modal open onClose={onClose} title={u ? (u.full_name ?? u.email) : "Loading…"} wide>
      {!u ? (
        <p className="text-sm text-soot/75">{error ?? "Loading…"}</p>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-soot">
            <span>{u.email}</span>
            <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
            <Badge tone={u.two_factor_enabled ? "ok" : "bad"}>2FA {u.two_factor_enabled ? "on" : "not set up"}</Badge>
            {u.phone && <span>· {u.phone}</span>}
          </div>

          {isAdminUser ? (
            <p className="rounded-xl border border-line bg-cream px-3 py-2.5 text-[13.5px] text-soot/85">
              System administrator accounts are managed directly in the database, not here — their
              role and centres cannot be changed through the app.
            </p>
          ) : (
            <section className="grid gap-3">
              <h4 className="text-[13px] font-semibold uppercase tracking-wide text-soot/70">Role and centres</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Role</label>
                  <Select
                    ariaLabel="Role" value={role} disabled={isSelf}
                    onChange={(v) => {
                      setRole(v as ApiRole);
                      if (v !== "FELLOW" && centreIds.length > 1) { setCentreIds([primary || centreIds[0]]); }
                    }}
                    options={CLINICAL_ROLES.map((r) => ({ value: r, label: API_ROLE_LABELS[r] }))}
                  />
                </div>
                {role === "FELLOW" && (
                  <div>
                    <label className="label">Supervising consultant</label>
                    <Select
                      ariaLabel="Supervisor" value={supervisor}
                      onChange={setSupervisor}
                      placeholder={consultants.length ? "— choose —" : "No consultants at these centres"}
                      disabled={!consultants.length}
                      options={consultants.map((c) => ({ value: c.id, label: c.full_name ?? c.email, hint: c.email }))}
                      menuWidth={320}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="label">{multi ? "Centres (a fellow may belong to several)" : "Centre"}</label>
                <div className="flex flex-wrap gap-1.5">
                  {centres.filter((c) => c.is_active || centreIds.includes(c.id)).map((c) => {
                    const on = centreIds.includes(c.id);
                    return (
                      <button
                        key={c.id} type="button" onClick={() => toggleCentre(c.id)}
                        className={"rounded-full border px-3 py-1 text-[13px] font-medium transition-colors " +
                          (on ? "border-forest-500 bg-forest-50 text-forest-700" : "border-ink/10 text-soot hover:bg-ink/[0.04]")}
                      >
                        {c.code}{on && primary === c.id ? " · primary" : ""}
                      </button>
                    );
                  })}
                </div>
                {multi && centreIds.length > 1 && (
                  <div className="mt-2 max-w-xs">
                    <label className="label">Primary centre</label>
                    <Select ariaLabel="Primary centre" value={primary} onChange={setPrimary}
                      options={centres.filter((c) => centreIds.includes(c.id)).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
                  </div>
                )}
              </div>
              <div>
                <button onClick={saveAccess} disabled={busy} className="btn-primary">Save role and centres</button>
                {isSelf && <span className="ml-3 text-[13px] text-soot/72">You cannot change your own role.</span>}
              </div>
            </section>
          )}

          <section className="grid gap-2 border-t border-line pt-4">
            <h4 className="text-[13px] font-semibold uppercase tracking-wide text-soot/70">Account</h4>
            <div className="flex flex-wrap gap-2">
              {u.status === "active" && !isSelf && (
                <button disabled={busy} onClick={() => run({ status: "suspended" }, `${u.email} suspended`)} className="btn bg-danger-600 text-white hover:bg-danger-700">Suspend</button>
              )}
              {u.status === "suspended" && (
                <button disabled={busy} onClick={() => run({ status: "active" }, `${u.email} reinstated`)} className="btn-primary">Reinstate</button>
              )}
              {u.status === "invited" && (
                <button disabled={busy} onClick={async () => {
                  try { await api.resendInvitation(u.id); onChanged(`Invitation re-sent to ${u.email}`); } catch (e) { setError(errorText(e)); }
                }} className="btn-secondary">Re-send invitation</button>
              )}
              {u.two_factor_enabled && (
                confirmReset
                  ? <button disabled={busy} onClick={() => run({ reset_two_factor: true }, `2FA reset for ${u.email} — they set it up again at next sign-in`)} className="btn bg-danger-600 text-white hover:bg-danger-700">Confirm 2FA reset</button>
                  : <button onClick={() => setConfirmReset(true)} className="btn-secondary">Reset 2FA (lost phone)</button>
              )}
            </div>
            <p className="text-[13px] text-soot/72">Any change here signs the user out everywhere.</p>
          </section>

          {error && <p className="text-[13px] text-danger-700">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

/* ---- invite ------------------------------------------------------------- */
function InviteUser({ open, centres, onClose, onInvited }: {
  open: boolean; centres: Centre[]; onClose: () => void; onInvited: (msg: string) => void;
}) {
  const [form, setForm] = useState({ email: "", full_name: "", role: "CONSULTANT" as ApiRole, centre_id: "", supervisor_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const consultants = useConsultants(form.role === "FELLOW" && form.centre_id ? [form.centre_id] : []);

  useEffect(() => {
    if (open) { setError(null); setForm({ email: "", full_name: "", role: "CONSULTANT", centre_id: "", supervisor_id: "" }); }
  }, [open]);

  async function send() {
    if (!form.email.trim() || !form.centre_id) { setError("Email and centre are required."); return; }
    setBusy(true); setError(null);
    try {
      await api.inviteUser({
        email: form.email.trim(), full_name: form.full_name.trim() || undefined, role: form.role,
        centre_id: form.centre_id, supervisor_id: form.role === "FELLOW" && form.supervisor_id ? form.supervisor_id : undefined,
      });
      onInvited(`Invitation sent to ${form.email.trim()}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a user">
      <div className="grid gap-3">
        <div><label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr Nur Aisyah" /></div>
        <div><label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@hospital.gov.my" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="label">Role</label>
            <Select ariaLabel="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v as ApiRole, supervisor_id: "" })}
              options={CLINICAL_ROLES.map((r) => ({ value: r, label: API_ROLE_LABELS[r] }))} /></div>
          <div><label className="label">Centre</label>
            <Select ariaLabel="Centre" value={form.centre_id} onChange={(v) => setForm({ ...form, centre_id: v, supervisor_id: "" })}
              placeholder="— choose —"
              options={centres.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} /></div>
        </div>
        {form.role === "FELLOW" && form.centre_id && (
          <div><label className="label">Supervising consultant (optional)</label>
            <Select ariaLabel="Supervisor" value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })}
              placeholder={consultants.length ? "— choose —" : "No consultants at this centre yet"}
              disabled={!consultants.length}
              options={consultants.map((c) => ({ value: c.id, label: c.full_name ?? c.email, hint: c.email }))} /></div>
        )}
        <p className="rounded-xl border border-line bg-cream px-3 py-2 text-[13px] leading-relaxed text-soot/80">
          They get a 7-day link to set their password, then set up an authenticator app. System
          administrators are not invited here — they are created in the database.
        </p>
        {error && <p className="text-[13px] text-danger-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={send} disabled={busy} className="btn-primary">Send invitation</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
