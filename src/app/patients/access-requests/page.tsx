"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, errorText, API_ROLE_LABELS, type AccessRequest, type Page } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, Modal, PageHeader, Table, Td, Th } from "@/components/ui";
import { Select } from "@/components/Select";

type Box = "incoming" | "outgoing";
const PAGE_SIZE = 20;

const STATUS_TONE: Record<AccessRequest["status"], "warn" | "ok" | "bad"> = {
  pending: "warn", approved: "ok", denied: "bad", revoked: "bad",
};

/**
 * Patient access requests: those waiting on me (as owner, or as HOD for a
 * departed owner) and those I sent.
 */
export default function AccessRequestsPage() {
  useTitle("Access requests");
  const { session } = useSession();
  const [box, setBox] = useState<Box>("incoming");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AccessRequest[] | null>(null);
  const [meta, setMeta] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ req: AccessRequest; approve: boolean } | null>(null);

  const clinical = !!session && CLINICAL.includes(session.role);

  // ?box=outgoing from the dashboard tile.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("box") === "outgoing") setBox("outgoing");
  }, []);

  const load = useCallback(() => {
    if (!clinical) return;
    setError(null);
    api.accessRequests({ box, status: status || undefined, page, page_size: PAGE_SIZE })
      .then((r) => { setItems(r.items); setMeta(r.page); })
      .catch((e) => { setError(errorText(e)); setItems([]); });
  }, [clinical, box, status, page]);
  useEffect(load, [load]);

  if (!session) return null;
  if (!clinical) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Access requests" />
        <Card><p className="text-sm text-soot">System administrators do not work with patient records.</p></Card>
      </div>
    );
  }

  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.page_size)) : 1;
  const switchBox = (b: Box) => { setBox(b); setPage(1); setItems(null); };

  return (
    <div>
      <PageHeader
        title="Access requests"
        subtitle="Colleagues asking to view or edit patients you are responsible for, and the requests you have sent."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-xl bg-ink/[0.05] p-1">
          {(["incoming", "outgoing"] as Box[]).map((b) => (
            <button key={b} role="tab" aria-selected={box === b} onClick={() => switchBox(b)}
              className={"rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors " +
                (box === b ? "bg-paper text-ink shadow-sm" : "text-soot hover:text-ink")}>
              {b === "incoming" ? "For me to decide" : "Sent by me"}
            </button>
          ))}
        </div>
        <div className="w-44">
          <Select ariaLabel="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" },
              { value: "denied", label: "Denied" }, { value: "", label: "All" }]} />
        </div>
        {meta && <span className="ml-auto text-[13px] text-soot/72">{meta.total} request{meta.total === 1 ? "" : "s"}</span>}
      </div>

      {error && <p className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">{error}</p>}

      {items === null ? (
        <Card><p className="text-sm text-soot/72">Loading…</p></Card>
      ) : items.length === 0 ? (
        <EmptyState
          title={box === "incoming" ? "Nothing waiting on you" : "No requests sent"}
          hint={box === "incoming"
            ? "When a colleague asks for access to a patient you registered, it appears here and you are emailed."
            : "Request access from New patient, when an identity number is already registered by someone else."}
        />
      ) : (
        <>
          <Table head={
            <tr>
              <Th>Patient</Th>
              <Th>{box === "incoming" ? "Requested by" : "Status"}</Th>
              <Th>Access</Th><Th>Reason</Th><Th>Sent</Th>
              {box === "incoming" ? <Th>Status</Th> : <Th>Decision</Th>}
              {box === "incoming" && <Th align="right"> </Th>}
            </tr>
          }>
            {items.map((r) => (
              <tr key={r.id}>
                <Td>
                  {r.registry_no ? (
                    <Link href={`/patients/${r.patient_id}`} className="font-mono text-[13px] hover:underline">{r.registry_no}</Link>
                  ) : <span className="text-soot/72">—</span>}
                  {r.patient_name && <div className="text-sm font-medium text-ink">{r.patient_name}</div>}
                </Td>
                {box === "incoming" ? (
                  <Td>
                    <div className="text-sm font-medium text-ink">{r.requester.full_name || r.requester.email}</div>
                    <div className="text-[13px] text-soot/72">{API_ROLE_LABELS[r.requester.role]}</div>
                  </Td>
                ) : (
                  <Td><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></Td>
                )}
                <Td>{r.permission === "edit" ? "View and edit" : "View"}</Td>
                <Td className="max-w-[24ch] text-[13.5px] text-soot">{r.reason || "—"}</Td>
                <Td className="text-[13px] text-soot/80">{fmtDateTime(r.created_at)}</Td>
                {box === "incoming" ? (
                  <Td><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></Td>
                ) : (
                  <Td className="text-[13px] text-soot/80">
                    {r.decided_at ? fmtDateTime(r.decided_at) : "—"}
                    {r.decision_note && <div className="text-soot">“{r.decision_note}”</div>}
                  </Td>
                )}
                {box === "incoming" && (
                  <Td align="right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-ghost !px-2.5 !py-1 text-[13px]" onClick={() => setDeciding({ req: r, approve: false })}>Deny</button>
                        <button className="btn-primary !px-2.5 !py-1 text-[13px]" onClick={() => setDeciding({ req: r, approve: true })}>Approve</button>
                      </div>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </Table>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="text-soot/72">Page {page} of {pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {deciding && (
        <Decide
          req={deciding.req}
          approve={deciding.approve}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            load();
            window.dispatchEvent(new Event("mugis:access-requests-changed"));
          }}
        />
      )}
    </div>
  );
}

function Decide({ req, approve, onClose, onDone }: {
  req: AccessRequest; approve: boolean; onClose: () => void; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = req.requester.full_name || req.requester.email;
  const what = req.permission === "edit" ? "view and edit" : "view";

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api.decideAccess(req.id, approve, note.trim() || undefined);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={approve ? "Approve access" : "Deny access"}>
      <p className="text-sm text-ink">
        {approve ? "Allow" : "Refuse"} <span className="font-semibold">{who}</span> to {what}{" "}
        <span className="font-mono">{req.registry_no ?? "this patient"}</span>{req.patient_name ? ` (${req.patient_name})` : ""}.
      </p>
      {!approve && (
        <>
          <label className="label mt-4">Note to the requester (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </>
      )}
      {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : approve ? "Approve" : "Deny"}</button>
      </div>
    </Modal>
  );
}
