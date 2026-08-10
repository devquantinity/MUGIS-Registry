"use client";

import { useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { canSeeAudit } from "@/lib/access";
import { CENTRES, findCentre } from "@/lib/centres";
import { fmtDateTime, download, toCsv } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Stat, Table, Td, Th, Toast } from "@/components/ui";

const ACTIONS = ["create", "update", "delete", "view", "export", "signin", "signout"] as const;

export default function AuditPage() {
  useTitle("Audit trail");
  const { state } = useStore();
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [centre, setCentre] = useState("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const perPage = 25;

  const rows = useMemo(() => {
    let out = state.audit;
    const s = q.trim().toLowerCase();
    if (s) out = out.filter((a) =>
      a.entityLabel.toLowerCase().includes(s) || a.userEmail.toLowerCase().includes(s));
    if (action !== "all") out = out.filter((a) => a.action === action);
    if (entity !== "all") out = out.filter((a) => a.entity === entity);
    if (centre !== "all") out = out.filter((a) => a.centreId === centre);
    return out;
  }, [state.audit, q, action, entity, centre]);

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const view = rows.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  const counts = useMemo(() => ({
    total: state.audit.length,
    exports: state.audit.filter((a) => a.action === "export").length,
    deletes: state.audit.filter((a) => a.action === "delete").length,
    edits: state.audit.filter((a) => a.action === "update").length,
  }), [state.audit]);

  if (!session) return null;
  if (!canSeeAudit(session)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Audit trail" />
        <Card>
          <p className="text-sm text-soot">
            The audit trail is visible to System Admin and Head of Service only.
            You are signed in as {ROLE_LABELS[session.role]}.
          </p>
        </Card>
      </div>
    );
  }

  function exportAudit() {
    const headers = ["Timestamp", "User", "Role", "Centre", "Action", "Entity", "Label", "Changes"];
    const data = rows.map((a) => [
      a.at, a.userEmail, a.userRole, findCentre(a.centreId).code, a.action, a.entity, a.entityLabel,
      a.changes?.map((c) => `${c.field}: ${c.from} -> ${c.to}`).join("; ") ?? "",
    ]);
    download(`mugis-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, data));
    setToast(`Exported ${rows.length} audit entries`);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <PageHeader
        title="Audit trail"
        subtitle="Immutable. Every creation, modification, deletion and export is recorded."
        actions={<button onClick={exportAudit} className="btn-secondary">Export log</button>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total entries" value={counts.total} tone="info" />
        <Stat label="Modifications" value={counts.edits} tone="info" />
        <Stat label="Exports" value={counts.exports} sub="review periodically" tone="gold" />
        <Stat label="Deletions" value={counts.deletes} tone={counts.deletes ? "bad" : "ok"} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Search</label>
            <input className="input" placeholder="Record or user" value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">Action</label>
            <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="all">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Entity</label>
            <select className="input" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
              <option value="all">All</option><option value="patient">Patient</option>
              <option value="episode">Episode</option><option value="user">User</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="label">Centre</label>
            <select className="input" value={centre} onChange={(e) => { setCentre(e.target.value); setPage(1); }}>
              <option value="all">All centres</option>
              {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {view.length === 0 ? (
        <EmptyState title="No audit entries match" hint="Try clearing the filters." />
      ) : (
        <>
          <Table head={
            <tr><Th w="150px">Timestamp</Th><Th>User</Th><Th align="center">Action</Th>
              <Th>Record</Th><Th>Change</Th></tr>
          } minWidth={980}>
            {view.map((a) => (
              <tr key={a.id} className="hover:bg-cream/50">
                <Td><span className="whitespace-nowrap text-[11px] tabular-nums text-soot/70">{fmtDateTime(a.at)}</span></Td>
                <Td>
                  <span className="block text-xs font-medium text-ink">{a.userEmail}</span>
                  <span className="text-[10px] text-soot/55">{ROLE_LABELS[a.userRole]} · {findCentre(a.centreId).code}</span>
                </Td>
                <Td align="center">
                  <Badge tone={a.action === "create" ? "ok" : a.action === "delete" ? "bad" : a.action === "export" ? "gold" : "info"}>
                    {a.action}
                  </Badge>
                </Td>
                <Td>
                  <span className="text-xs text-ink">{a.entityLabel}</span>
                  <span className="ml-1 text-[10px] text-soot/45">{a.entity}</span>
                </Td>
                <Td>
                  {a.changes?.length ? (
                    <ul className="space-y-0.5">
                      {a.changes.slice(0, 3).map((c, i) => (
                        <li key={i} className="text-[11px] text-soot">
                          <span className="font-medium text-ink">{c.field}</span>
                          <span className="mx-1 text-soot/40">{c.from || "—"} →</span>
                          <span className="font-medium text-forest-600">{c.to || "—"}</span>
                        </li>
                      ))}
                      {a.changes.length > 3 && <li className="text-[10px] text-soot/50">+{a.changes.length - 3} more</li>}
                    </ul>
                  ) : <span className="text-[11px] text-soot/40">—</span>}
                </Td>
              </tr>
            ))}
          </Table>

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-soot/60">
                Page {Math.min(page, pages)} of {pages} · {rows.length} entries
              </p>
              <div className="flex gap-2">
                <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
