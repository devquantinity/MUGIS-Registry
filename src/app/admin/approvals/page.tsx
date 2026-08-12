"use client";

import { useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { canApproveExport, canDecideOn } from "@/lib/access";
import { findCentre } from "@/lib/centres";
import { fmtDateTime, relTime } from "@/lib/format";
import type { ExportRequest } from "@/lib/types";
import { Badge, Card, EmptyState, Field, Modal, PageHeader, SectionTitle, Toast, type ToastData } from "@/components/ui";

const STATUS_TONE = {
  pending: "warn", approved: "ok", rejected: "bad", used: "muted", expired: "muted",
} as const;

const STATUS_LABEL: Record<ExportRequest["status"], string> = {
  pending: "Awaiting decision", approved: "Approved", rejected: "Refused",
  used: "Approved · used", expired: "Expired unused",
};

/** An approval that was never used before its window closed reads as expired. */
function effectiveStatus(r: ExportRequest, now: number): ExportRequest["status"] {
  if (r.status === "approved" && r.expiresAt && new Date(r.expiresAt).getTime() <= now) {
    return "expired";
  }
  return r.status;
}

function Row({ r, now, onDecide }: {
  r: ExportRequest; now: number; onDecide: (r: ExportRequest, approve: boolean) => void;
}) {
  const { session } = useSession();
  const status = effectiveStatus(r, now);
  const mine = session?.email === r.requestedBy;
  const canAct = !!session && status === "pending" && canDecideOn(session, r.requestedBy);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-ink">{r.ref}</span>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            <Badge tone={r.includesIdentifiers ? "warn" : "muted"}>
              {r.includesIdentifiers ? "Identifiable" : "De-identified"}
            </Badge>
            {r.ethicsRef && <Badge tone="info">{r.ethicsRef}</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-soot/80">
            {r.requestedByName} · {ROLE_LABELS[r.requestedRole]} ·{" "}
            {relTime(r.requestedAt, now)}
          </p>
        </div>
        <div className="text-right text-[13px] text-soot/80">
          <p><span className="font-bold tabular-nums text-ink">{r.scopeRecords}</span> records</p>
          <p>{r.scopeGroups} groups · {r.format.toUpperCase()}</p>
          <p>{r.scopeCentreId === "all" ? "All centres in scope" : findCentre(r.scopeCentreId).code}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-cream px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">{r.basis}</p>
        <p className="mt-1 text-sm leading-relaxed text-soot">{r.purpose}</p>
        <p className="mt-1.5 text-[12px] text-soot/75">
          Requested retention: {r.retentionDays} days
        </p>
      </div>

      {r.decidedAt && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[13px] text-soot/80">
            <span className="font-semibold text-ink">
              {status === "rejected" ? "Refused" : "Approved"} by {r.decidedByName}
            </span>{" "}
            · {fmtDateTime(r.decidedAt)}
          </p>
          {r.decisionNote && (
            <p className="mt-1 text-sm leading-relaxed text-soot">{r.decisionNote}</p>
          )}
          {status === "approved" && r.expiresAt && (
            <p className="mt-1.5 text-[12px] text-soot/75">
              Single use · lapses {fmtDateTime(r.expiresAt)} if not taken up.
            </p>
          )}
          {r.usedAt && (
            <p className="mt-1.5 text-[12px] text-soot/75">
              Extract produced {fmtDateTime(r.usedAt)}. Approval now closed.
            </p>
          )}
        </div>
      )}

      {status === "pending" && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          {mine ? (
            <p className="text-[13px] text-soot/80">
              Your own request — someone else has to decide it.
            </p>
          ) : !canAct ? (
            <p className="text-[13px] text-soot/80">Your role cannot decide export requests.</p>
          ) : (
            <>
              <button onClick={() => onDecide(r, false)}
                className="btn border border-danger-200 text-danger-700 hover:bg-danger-50">
                Refuse
              </button>
              <button onClick={() => onDecide(r, true)} className="btn-primary">
                Approve release
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ApprovalsPage() {
  useTitle("Export approvals");
  const { state, decideExport } = useStore();
  const { session } = useSession();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [pending, setPending] = useState<{ r: ExportRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState("");

  const now = Date.now();
  const requests = useMemo(
    () => [...state.exportRequests].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1)),
    [state.exportRequests]
  );
  const open = requests.filter((r) => effectiveStatus(r, now) === "pending");
  const settled = requests.filter((r) => effectiveStatus(r, now) !== "pending");

  if (!session) return null;

  if (!canApproveExport(session)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Export approvals" />
        <Card>
          <p className="text-sm leading-relaxed text-soot">
            Only an administrator, HOD or Head of Service can release direct
            identifiers. Your own requests appear on the Data export page.
          </p>
        </Card>
      </div>
    );
  }

  function decide() {
    if (!pending || !session) return;
    decideExport(session, pending.r.id, pending.approve, note.trim());
    setToast(pending.approve
      ? {
          tone: "success",
          title: `Identifiers released to ${pending.r.requestedByName}`,
          body: "Single use, valid 72 hours. The decision and the extract are both on the audit trail.",
          ref: pending.r.ref,
        }
      : {
          tone: "error",
          title: `Request refused`,
          body: `${pending.r.requestedByName} sees your reason and can re-file a corrected request. Nothing was released.`,
          ref: pending.r.ref,
        });
    setPending(null);
    setNote("");
  }

  return (
    <div>
      <PageHeader
        title="Export approvals"
        subtitle="Direct identifiers leave the registry only when a second, more senior person releases them against a stated purpose."
        actions={open.length > 0 ? <Badge tone="warn">{open.length} awaiting decision</Badge> : undefined}
      />

      <SectionTitle>Awaiting decision</SectionTitle>
      {open.length === 0 ? (
        <EmptyState title="Nothing waiting"
          hint="Requests to release names, MyKad numbers or dates of birth arrive here." />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {open.map((r) => (
            <Row key={r.id} r={r} now={now}
              onDecide={(req, approve) => { setPending({ r: req, approve }); setNote(""); }} />
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <>
          <div className="mt-6" />
          <SectionTitle right={<span className="text-[12px] text-soot/75">{settled.length} on record</span>}>
            Decided
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {settled.map((r) => (
              <Row key={r.id} r={r} now={now} onDecide={() => undefined} />
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.approve
          ? pending.r.includesIdentifiers ? "Approve release of identifiers" : "Approve this extract"
          : "Refuse this request"}
      >
        {pending && (
          <>
            <div className="rounded-xl border border-line bg-cream px-3 py-2.5">
              <p className="text-xs font-semibold text-ink">
                {pending.r.ref} · {pending.r.requestedByName}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-soot">{pending.r.purpose}</p>
              <p className="mt-1.5 text-[12px] text-soot/75">
                {pending.r.scopeRecords} records · {pending.r.basis}
                {pending.r.ethicsRef ? ` · ${pending.r.ethicsRef}` : ""}
              </p>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-soot">
              {pending.approve
                ? pending.r.includesIdentifiers
                  ? "Approving releases names, MyKad numbers and dates of birth for this request only. It can be used once, lapses after 72 hours, and both the decision and the extract are written to the audit trail."
                  : "This extract carries no direct identifiers. Approving lets the requester take it once, within 72 hours, and the extract is written to the audit trail."
                : "The requester sees your reason on the export page. Nothing is released."}
            </p>

            <div className="mt-4">
              <Field
                label={pending.approve ? "Note (optional)" : "Reason"}
                required={!pending.approve}
                hint={pending.approve
                  ? "What you checked before releasing — the ethics letter, the theatre list, the requester's role."
                  : "Say what would make this acceptable, so the request can be put right."}
              >
                <textarea className="input min-h-[84px] resize-y" value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={pending.approve
                    ? "NMRR reference checked against the approval letter."
                    : "No lawful basis to disclose identifiable data to a third party."} />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPending(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={decide}
                disabled={!pending.approve && note.trim().length < 10}
                className={pending.approve ? "btn-primary" : "btn bg-danger-600 text-white hover:bg-danger-700"}
              >
                {pending.approve ? "Approve release" : "Refuse request"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
