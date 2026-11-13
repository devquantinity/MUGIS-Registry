"use client";

import { useCallback, useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import {
  api, errorText, API_ROLE_LABELS,
  type Centre, type Page, type Registration, type StaffSummary,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, Modal, PageHeader, Table, Td, Th, Toast } from "@/components/ui";
import { Select } from "@/components/Select";

type Tab = "pending_approval" | "approved" | "rejected";
const TABS: { value: Tab; label: string }[] = [
  { value: "pending_approval", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];
const PAGE_SIZE = 25;

/** Tell the sidebar badge to recount. */
function changed() {
  window.dispatchEvent(new Event("mugis:registrations-changed"));
}

/**
 * The review queue (GET /registrations). What each reviewer sees is decided
 * by the backend: SYSTEM_ADMIN everything; Head of Service consultants and
 * fellows everywhere; HOD consultants and fellows at their own centre.
 */
export default function RegistrationsPage() {
  useTitle("Registrations");
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>("pending_approval");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [centre, setCentre] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Registration[]; page: Page } | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<Registration | null>(null);
  const [rejecting, setRejecting] = useState<Registration | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reviewer = session?.role === "admin" || session?.role === "head" || session?.role === "hod";

  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    api.registrations({ status: tab, q: query, centre_id: centre, page, page_size: PAGE_SIZE })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [tab, query, centre, page]);

  useEffect(() => { if (reviewer) load(); }, [reviewer, load]);
  useEffect(() => { if (reviewer && session?.role !== "hod") api.centres().then(setCentres).catch(() => undefined); }, [reviewer, session?.role]);

  if (!session) return null;
  if (!reviewer) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Registrations" />
        <Card><p className="text-sm text-soot">Registrations are reviewed by Heads of Department, Heads of Service and system administrators.</p></Card>
      </div>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.page.total / PAGE_SIZE)) : 1;
  const done = (msg: string) => { setToast(msg); changed(); load(); };

  return (
    <div>
      <PageHeader
        title="Registrations"
        subtitle={session.role === "hod"
          ? `Applications from consultants and fellows at ${session.centreName}.`
          : session.role === "head"
            ? "Applications from consultants and fellows at every centre."
            : "Every application. HOD and Head of Service applications are yours alone to review."}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-[10px] bg-ink/[0.05] p-0.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value} role="tab" aria-selected={tab === t.value}
                onClick={() => { setTab(t.value); setPage(1); }}
                className={"rounded-[8px] px-3 py-1.5 text-[14px] font-medium transition-colors " +
                  (tab === t.value ? "bg-white text-ink shadow-sm dark:bg-white/[0.12]" : "text-soot hover:text-ink")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="label">Search</label>
            <input className="input" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {session.role !== "hod" && (
            <div className="min-w-[200px]">
              <label className="label">Centre</label>
              <Select ariaLabel="Filter by centre" value={centre} onChange={(v) => { setCentre(v); setPage(1); }}
                placeholder="All centres"
                options={[{ value: "", label: "All centres" }, ...centres.map((c) => ({ value: c.id, label: c.name, hint: c.code }))]} />
            </div>
          )}
        </div>
      </Card>

      {error && <Card className="mb-4"><p className="text-sm text-danger-700">{error}</p></Card>}

      <Table head={
        <tr><Th>Applicant</Th><Th>Role</Th><Th>Centre</Th><Th>Identity</Th><Th align="right">Submitted</Th><Th align="right"> </Th></tr>
      } minWidth={960}>
        {(data?.items ?? []).map((r) => (
          <tr key={r.id} className="hover:bg-cream/50">
            <Td>
              <span className="block font-medium text-ink">{r.full_name ?? "—"}</span>
              <span className="block text-xs text-soot">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span>
            </Td>
            <Td><span className="text-sm text-ink">{API_ROLE_LABELS[r.role]}</span></Td>
            <Td>{r.centre ? <Badge tone="muted">{r.centre.code}</Badge> : "—"}</Td>
            <Td>
              <span className="block font-mono text-[13px] text-ink">{r.id_number ?? "—"}</span>
              <span className="block text-[12px] text-soot/70">{r.id_type === "passport" ? "Passport" : "MyKad"}</span>
            </Td>
            <Td align="right">
              <span className="block text-xs text-soot/80">{fmtDateTime(r.created_at)}</span>
              {r.reviewed_at && <span className="block text-[12px] text-soot/65">reviewed {fmtDateTime(r.reviewed_at)}</span>}
            </Td>
            <Td align="right">
              {r.status === "pending_approval" ? (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setApproving(r)} className="btn-primary !px-2.5 !py-1 text-[13px]">Approve</button>
                  <button onClick={() => setRejecting(r)} className="btn-secondary !px-2.5 !py-1 text-[13px]">Reject</button>
                </div>
              ) : r.status === "rejected" ? (
                <span className="text-[12.5px] text-soot/75" title={r.rejection_reason}>{r.rejection_reason ? `“${r.rejection_reason}”` : "Rejected"}</span>
              ) : (
                <Badge tone="ok">Activation link sent</Badge>
              )}
            </Td>
          </tr>
        ))}
        {data && data.items.length === 0 && (
          <tr><Td><span className="text-sm text-soot/75">{tab === "pending_approval" ? "Nothing waiting for review." : "None yet."}</span></Td></tr>
        )}
        {!data && !error && <tr><Td><span className="text-sm text-soot/75">Loading…</span></Td></tr>}
      </Table>

      {data && data.page.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-soot">
          <span>{data.page.total} applications · page {page} of {pages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn-secondary !py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      <Approve reg={approving} onClose={() => setApproving(null)} onDone={(m) => { setApproving(null); done(m); }} />
      <Reject reg={rejecting} onClose={() => setRejecting(null)} onDone={(m) => { setRejecting(null); done(m); }} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function Approve({ reg, onClose, onDone }: { reg: Registration | null; onClose: () => void; onDone: (m: string) => void }) {
  const [consultants, setConsultants] = useState<StaffSummary[]>([]);
  const [supervisor, setSupervisor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupervisor(""); setError(null); setConsultants([]);
    if (reg?.role === "FELLOW" && reg.centre) {
      api.consultants(reg.centre.id).then(setConsultants).catch(() => setConsultants([]));
    }
  }, [reg]);

  async function approve() {
    if (!reg) return;
    setBusy(true); setError(null);
    try {
      await api.approveRegistration(reg.id, supervisor || undefined);
      onDone(`${reg.full_name ?? reg.email} approved — activation link emailed`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!reg} onClose={onClose} title="Approve registration">
      {reg && (
        <div className="grid gap-3">
          <p className="text-sm text-soot">
            <span className="font-medium text-ink">{reg.full_name}</span> ({reg.email}) as{" "}
            {API_ROLE_LABELS[reg.role]} at {reg.centre?.name ?? "—"}. Check the identity number{" "}
            <span className="font-mono text-ink">{reg.id_number}</span> before approving.
          </p>
          {reg.role === "FELLOW" && (
            <div>
              <label className="label">Supervising consultant (optional)</label>
              <Select ariaLabel="Supervisor" value={supervisor} onChange={setSupervisor}
                placeholder={consultants.length ? "— choose —" : "No consultants at this centre yet"}
                disabled={!consultants.length}
                options={consultants.map((c) => ({ value: c.id, label: c.full_name ?? c.email, hint: c.email }))} />
              <p className="mt-1 text-[13px] text-soot/72">Can also be set later by a system administrator.</p>
            </div>
          )}
          <p className="text-[13px] text-soot/72">The applicant gets an email with a 3-day link to activate the account.</p>
          {error && <p className="text-[13px] text-danger-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={approve} disabled={busy} className="btn-primary">Approve</button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Reject({ reg, onClose, onDone }: { reg: Registration | null; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setReason(""); setError(null); }, [reg]);

  async function reject() {
    if (!reg) return;
    setBusy(true); setError(null);
    try {
      await api.rejectRegistration(reg.id, reason.trim() || undefined);
      onDone(`${reg.full_name ?? reg.email} rejected`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!reg} onClose={onClose} title="Reject registration">
      {reg && (
        <div className="grid gap-3">
          <p className="text-sm text-soot">
            <span className="font-medium text-ink">{reg.full_name}</span> ({reg.email}) will be told by email. They may apply again.
          </p>
          <div>
            <label className="label">Reason (optional, included in the email)</label>
            <textarea className="input min-h-[90px]" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not on the HKL roster" />
          </div>
          {error && <p className="text-[13px] text-danger-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={reject} disabled={busy} className="btn bg-danger-600 text-white hover:bg-danger-700">Reject</button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
