"use client";

import { useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useScoped, usePatientMap } from "@/lib/useScoped";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canExport, exportNeedsApproval } from "@/lib/access";
import { LEGAL_BASIS, type ExportRequest, type LegalBasis } from "@/lib/types";
import { fmtDateTime, relTime } from "@/lib/format";
import { CENTRES, findCentre } from "@/lib/centres";
import { schemaFor } from "@/lib/parameters";
import { cciScore, deriveStage } from "@/lib/staging";
import { ageFrom, download, toCsv } from "@/lib/format";
import { makeXlsx, downloadBlob } from "@/lib/xlsx";
import { printPdf } from "@/lib/pdf";
import { Badge, Card, Check, Field, Modal, PageHeader, RunButton, SectionTitle, Toast, type ToastData } from "@/components/ui";
import { Select, opts } from "@/components/Select";

export default function ExportPage() {
  useTitle("Data export");
  const { episodes, hidden, session } = useScoped();
  const pmap = usePatientMap();
  const { state, logAudit, requestExport, consumeExport } = useStore();
  const { session: sess } = useSession();

  const groups = useMemo(() => schemaFor("gastric-adeno"), []);
  const [selected, setSelected] = useState<string[]>(groups.map((g) => g.id));
  const [centre, setCentre] = useState("all");
  const [identifiers, setIdentifiers] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf" | "json">("xlsx");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [basis, setBasis] = useState<LegalBasis>(LEGAL_BASIS[0]);
  const [ethicsRef, setEthicsRef] = useState("");
  const [retention, setRetention] = useState(30);
  const [last, setLast] = useState<{ n: number; format: string; ids: boolean; at: number } | null>(null);

  const rows = useMemo(
    () => (centre === "all" ? episodes : episodes.filter((e) => e.centreId === centre)),
    [episodes, centre]
  );

  /**
   * An approval only counts for the person who asked, and only while it is
   * unused and inside its window. Anything else and the identifier columns
   * simply are not built — the gate is in the data path, not in the button.
   */
  const approval = useMemo<ExportRequest | null>(() => {
    if (!sess) return null;
    const now = Date.now();
    return state.exportRequests.find((r) =>
      r.requestedBy === sess.email &&
      r.status === "approved" &&
      (!r.expiresAt || new Date(r.expiresAt).getTime() > now)
    ) ?? null;
  }, [state.exportRequests, sess]);

  const myPending = useMemo(
    () => (sess ? state.exportRequests.find((r) => r.requestedBy === sess.email && r.status === "pending") ?? null : null),
    [state.exportRequests, sess]
  );

  const mine = useMemo(
    () => (sess ? state.exportRequests.filter((r) => r.requestedBy === sess.email) : []),
    [state.exportRequests, sess]
  );

  const myRefused = useMemo(
    () => (sess ? state.exportRequests.find((r) => r.requestedBy === sess.email && r.status === "rejected") ?? null : null),
    [state.exportRequests, sess]
  );

  /** Junior roles need a sign-off for any extract, not just identifiable ones. */
  const needsApproval = sess ? exportNeedsApproval(sess) : false;

  /** An approval only covers identifiers if it was granted for them. */
  const approvalCoversIds = !!approval?.includesIdentifiers;
  const wantIds = identifiers && !hidden;
  const includeIdentifiers = wantIds && approvalCoversIds;

  /**
   * Can a file be produced right now?
   *  - junior roles: only against a live approval
   *  - everyone else: yes, with identifiers stripped unless approved
   */
  const canRunNow = needsApproval ? !!approval : true;

  const columns = useMemo(() => {
    const base = ["registryNo", "centre", "age", "sex", "ethnic", "state"];
    const ids = includeIdentifiers ? ["fullName", "mykad", "dob"] : [];
    const fields = groups.filter((g) => selected.includes(g.id)).flatMap((g) => g.fields.filter((f) => f.type !== "computed").map((f) => f.id));
    return [...base, ...ids, ...fields, "cciScore", "ajccStage"];
  }, [groups, selected, includeIdentifiers]);

  function buildRows() {
    return rows.map((e) => {
      const p = pmap.get(e.patientId);
      const rec: Record<string, string | number | null> = {
        registryNo: p?.registryNo ?? "",
        centre: findCentre(e.centreId).code,
        age: p ? ageFrom(p.dob) : null,
        sex: p?.sex ?? "",
        ethnic: p?.ethnic ?? "",
        state: p?.state ?? "",
      };
      if (includeIdentifiers && p) {
        rec.fullName = p.fullName; rec.mykad = p.mykad; rec.dob = p.dob;
      }
      for (const g of groups) {
        if (!selected.includes(g.id)) continue;
        for (const f of g.fields) {
          if (f.type === "computed") continue;
          rec[f.id] = e.data[f.id] ?? "";
        }
      }
      rec.cciScore = cciScore(e.data, p?.dob).score;
      rec.ajccStage = deriveStage(e.data).stage ?? "";
      return rec;
    });
  }

  function run() {
    if (!sess) return;
    const data = buildRows();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      download(`mugis-export-${stamp}.csv`,
        toCsv(columns, data.map((r) => columns.map((c) => r[c] ?? ""))));
    } else if (format === "xlsx") {
      downloadBlob(`mugis-export-${stamp}.xlsx`,
        makeXlsx("MUGIS Export", columns, data.map((r) => columns.map((c) => r[c] ?? ""))));
    } else if (format === "pdf") {
      // A 90-column table is unreadable on A4 — the PDF is a registry listing
      // with the key clinical columns. Use CSV or Excel for the full dataset.
      const cols = ["registryNo", "centre", "age", "sex", "ethnic", "state",
        ...(includeIdentifiers ? ["fullName", "mykad"] : []),
        "dateDiagnosis", "surgery", "lnDissection", "cd30", "ajccStage", "cciScore"];
      const labels: Record<string, string> = {
        registryNo: "Registry No", centre: "Centre", age: "Age", sex: "Sex",
        ethnic: "Ethnic", state: "State", fullName: "Name", mykad: "MyKad",
        dateDiagnosis: "Diagnosis", surgery: "Surgery", lnDissection: "LN",
        cd30: "CD-30d", ajccStage: "AJCC", cciScore: "CCI",
      };
      printPdf({
        title: "Upper GI Cancer Registry — Export",
        subtitle: `${data.length} records · ${includeIdentifiers ? "identifiable" : "de-identified"} · generated ${stamp} by ${sess.email}`,
        headers: cols.map((c) => labels[c] ?? c),
        rows: data.map((r) => cols.map((c) => r[c] ?? "")),
        landscape: true,
        footnote: "Key columns only — the complete field set is available via the CSV and Excel exports. AJCC 8th edition staging is system-derived and pending clinical sign-off.",
      });
    } else {
      download(`mugis-export-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
    }
    const label = `${data.length} records, ${format === "pdf" ? "key columns" : columns.length + " columns"}, ${format.toUpperCase()}`;
    if (approval && (includeIdentifiers || needsApproval)) {
      // Single use: the approval is spent the moment the file exists, so the
      // same sign-off cannot quietly produce a second, wider extract.
      consumeExport(sess, approval.id,
        `${includeIdentifiers ? "Identifiable" : "De-identified"} export — ${label}`);
    } else {
      logAudit({
        userEmail: sess.email, userRole: sess.role, centreId: sess.centreId,
        action: "export", entity: "system", entityId: "-",
        entityLabel: `De-identified export — ${label}`,
      });
    }
    setLast({ n: data.length, format, ids: includeIdentifiers, at: Date.now() });
  }

  if (!session || !sess) return null;

  if (!canExport()) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Data export" />
        <Card><p className="text-sm text-soot">Your role does not permit data export.</p></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Data export"
        subtitle="De-identified extracts run immediately. Anything carrying names, MyKad numbers or dates of birth needs a second person's approval before it can be produced."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle right={
            <div className="flex gap-2">
              <button onClick={() => setSelected(groups.map((g) => g.id))} className="text-[13px] font-semibold text-forest-500 hover:underline">All</button>
              <button onClick={() => setSelected([])} className="text-[13px] font-semibold text-soot/75 hover:underline">None</button>
            </div>
          }>
            Parameter groups
          </SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups.map((g) => {
              const on = selected.includes(g.id);
              return (
                <div key={g.id}
                  className={"rounded-xl border px-3 py-2.5 transition-all duration-150 " +
                    (on
                      ? "border-forest-500 bg-forest-50 shadow-[0_0_0_1px_rgb(var(--color-forest-500)/0.25)]"
                      : "border-line bg-paper hover:border-forest-500/40 hover:bg-cream")}>
                  <Check
                    checked={on}
                    onChange={(next) => setSelected((s) => next ? [...s, g.id] : s.filter((x) => x !== g.id))}
                    label={
                      <span className="flex items-baseline gap-2">
                        <span className={"min-w-0 flex-1 text-sm " + (on ? "font-semibold text-forest-600" : "text-soot")}>
                          <span className="tabular-nums opacity-60">{g.no}.</span> {g.title}
                        </span>
                        <span className={"shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums " +
                          (on ? "bg-forest-500/12 text-forest-600" : "bg-ink/[0.05] text-soot/70")}>
                          {g.fields.filter((f) => f.type !== "computed").length}
                        </span>
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Scope</SectionTitle>
            <label className="label">Centre</label>
            <Select
              ariaLabel="Centre"
              value={centre}
              onChange={setCentre}
              options={[
                { value: "all", label: "All centres in your scope" },
                ...CENTRES.map((c) => ({ value: c.id, label: c.name, hint: c.code })),
              ]}
            />

            <label className="label mt-4">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {([["xlsx", "Excel"], ["csv", "CSV"], ["pdf", "PDF"], ["json", "JSON"]] as const).map(([f, label]) => (
                <button key={f} onClick={() => setFormat(f)}
                  className={"rounded-xl border px-3 py-2 text-xs font-semibold transition-colors " +
                    (format === f ? "border-forest-500 bg-forest-50 text-forest-600" : "border-line bg-paper text-soot hover:bg-cream")}>
                  {label}
                </button>
              ))}
            </div>
            {format === "pdf" && (
              <p className="mt-2 text-[12px] leading-relaxed text-soot/75">
                PDF prints a registry listing with the key clinical columns — the full
                field set goes to Excel or CSV.
              </p>
            )}

            <div className="mt-4">
              {hidden ? (
                <div className="rounded-xl border border-line bg-cream px-3 py-2.5">
                  <Badge tone="muted">De-identified only</Badge>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-soot/80">
                    Your role never receives names, MyKad numbers or dates of birth.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-gold-300 bg-gold-100/60 px-3 py-2.5">
                  <Check
                    tone="gold"
                    checked={identifiers}
                    onChange={setIdentifiers}
                    label={<span className="text-sm font-semibold text-ink">Include direct identifiers</span>}
                    hint="Adds name, MyKad and date of birth. Released only against a second person's written approval — never on your own authority."
                  />

                  {identifiers && (
                    <div className="mt-2.5 border-t border-gold-300/70 pt-2.5">
                      {approval ? (
                        <>
                          <Badge tone="ok">Approved · {approval.ref}</Badge>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-soot/80">
                            Released by {approval.decidedByName} {relTime(approval.decidedAt ?? "", Date.now())}.
                            Valid until {fmtDateTime(approval.expiresAt ?? "")} and spent on
                            first use — a further extract needs a fresh approval.
                          </p>
                        </>
                      ) : myPending ? (
                        <>
                          <Badge tone="warn">Awaiting approval · {myPending.ref}</Badge>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-soot/80">
                            Submitted {relTime(myPending.requestedAt, Date.now())}. A
                            Head of Department has to release it. You can still
                            export without identifiers in the meantime.
                          </p>
                        </>
                      ) : (
                        <>
                          {myRefused && (
                            <p className="mb-2 rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-2 text-[13px] leading-relaxed text-danger-700">
                              <span className="font-semibold">{myRefused.ref} was refused.</span>{" "}
                              {myRefused.decisionNote}
                            </p>
                          )}
                          <button onClick={() => setAskOpen(true)} className="btn-gold w-full">
                            Request approval
                          </button>
                          <p className="mt-1.5 text-[12px] leading-relaxed text-soot/75">
                            You will be asked to state a purpose and lawful basis.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle>Preview</SectionTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-soot/80">Records</dt><dd className="font-bold tabular-nums text-ink">{rows.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/80">Columns</dt><dd className="font-bold tabular-nums text-ink">{columns.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/80">Groups</dt><dd className="font-bold tabular-nums text-ink">{selected.length}/{groups.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/80">Identifiers</dt>
                <dd><Badge tone={includeIdentifiers ? "warn" : wantIds ? "bad" : "ok"}>
                  {includeIdentifiers ? "Included" : wantIds ? "Not released" : "Excluded"}
                </Badge></dd></div>
              <div className="flex items-center justify-between border-t border-line pt-2">
                <dt className="text-soot/80">Status</dt>
                <dd>
                  {last ? (
                    <span className="mg-lift inline-flex items-center gap-1.5 rounded-md bg-sage-100 px-2 py-1 text-[13px] font-semibold text-sage-700">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path className="mg-draw" d="M5 13l4.5 4.5L19 7" />
                      </svg>
                      Exported
                    </span>
                  ) : myPending ? (
                    <Badge tone="warn">Awaiting approval</Badge>
                  ) : approval ? (
                    <Badge tone="ok">Approved &mdash; ready</Badge>
                  ) : needsApproval ? (
                    <Badge tone="muted">Approval required</Badge>
                  ) : (
                    <Badge tone="ok">Ready</Badge>
                  )}
                </dd>
              </div>
            </dl>

            {last && (
              <p className="mg-lift mt-3 rounded-lg border border-sage-600/25 bg-sage-100/60 px-2.5 py-2 text-[13px] leading-relaxed text-sage-700">
                <span className="font-semibold">{last.n} records &middot; {last.format.toUpperCase()}</span>
                {" "}&middot; {last.ids ? "identifiable" : "de-identified"} &middot; written to the audit trail
              </p>
            )}

            <div className="mt-4">
              {canRunNow ? (
                <RunButton
                  onRun={run}
                  disabled={rows.length === 0 || selected.length === 0}
                  workingLabel="Preparing file…"
                  doneLabel={includeIdentifiers ? "Released and logged" : "Downloaded"}
                  label={includeIdentifiers
                    ? `Export ${rows.length} with identifiers`
                    : wantIds
                      ? `Export ${rows.length} without identifiers`
                      : `Export ${rows.length} records`}
                />
              ) : myPending ? (
                <div className="flex items-center justify-center gap-2 rounded-[10px] border border-gold-300 bg-gold-100/70 px-3.5 py-2.5 text-[15px] font-medium text-goldink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                  Waiting on {myPending.ref}
                </div>
              ) : (
                <button onClick={() => setAskOpen(true)}
                  disabled={rows.length === 0 || selected.length === 0}
                  className="btn-gold w-full !py-2.5 !text-[15px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
                  </svg>
                  Request approval to export {rows.length}
                </button>
              )}
              {needsApproval && !approval && !myPending && (
                <p className="mt-2 text-center text-[13px] leading-relaxed text-soot/75">
                  Your role assembles extracts; a Head of Department releases them.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {mine.length > 0 && (
        <Card className="mt-4">
          <SectionTitle right={<span className="text-[12px] text-soot/75">{mine.length} on record</span>}>
            Your identifier requests
          </SectionTitle>
          <ul className="divide-y divide-line">
            {mine.map((r) => {
              const live = r.status === "approved"
                && (!r.expiresAt || new Date(r.expiresAt).getTime() > Date.now());
              const tone = r.status === "pending" ? "warn"
                : r.status === "rejected" ? "bad"
                : live ? "ok" : "muted";
              const label = r.status === "pending" ? "Awaiting decision"
                : r.status === "rejected" ? "Refused"
                : r.status === "used" ? "Used"
                : live ? "Approved — ready" : "Expired unused";
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink">{r.ref}</span>
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-soot/80">{r.purpose}</p>
                    {r.decisionNote && (
                      <p className="mt-1 text-[12px] leading-relaxed text-soot/75">
                        <span className="font-semibold">{r.decidedByName}:</span> {r.decisionNote}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-right text-[12px] text-soot/75">
                    <span className="block">{r.scopeRecords} records</span>
                    <span className="block">{relTime(r.requestedAt, Date.now())}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal open={askOpen} onClose={() => setAskOpen(false)} title="Request release of direct identifiers">
        <p className="text-sm leading-relaxed text-soot">
          Names, MyKad numbers and dates of birth are personal data under the PDPA.
          State why they are needed — a Head of Department reviews this before
          anything is released, and cannot approve their own request.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Lawful basis" required>
            <Select
              ariaLabel="Lawful basis"
              value={basis}
              onChange={(v) => setBasis(v as LegalBasis)}
              options={opts(LEGAL_BASIS)}
              menuWidth={360}
            />
          </Field>

          {basis === "Ethics-approved research protocol" && (
            <Field label="Ethics / NMRR reference" required hint="As printed on the approval letter.">
              <input className="input font-mono" value={ethicsRef}
                onChange={(e) => setEthicsRef(e.target.value)} placeholder="NMRR-00-00000-ABC" />
            </Field>
          )}

          <Field label="Purpose" required
            hint="Be specific. &ldquo;Research&rdquo; on its own will be refused — say what is being done and why identifiers are unavoidable.">
            <textarea className="input min-h-[92px] resize-y" value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Matching 18 gastrectomy cases against Thursday's theatre list for the MDT meeting." />
          </Field>

          <Field label="Retention" hint="How long the extract is kept before destruction.">
            <Select
              ariaLabel="Retention"
              value={String(retention)}
              onChange={(v) => setRetention(Number(v))}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "365", label: "12 months" },
              ]}
            />
          </Field>

          <div className="rounded-xl border border-line bg-cream px-3 py-2.5">
            <p className="text-xs font-semibold text-ink">What the approver will see</p>
            <dl className="mt-1.5 space-y-1 text-[13px] text-soot/80">
              <div className="flex justify-between"><dt>Records</dt><dd className="font-semibold tabular-nums text-ink">{rows.length}</dd></div>
              <div className="flex justify-between"><dt>Parameter groups</dt><dd className="font-semibold tabular-nums text-ink">{selected.length}/{groups.length}</dd></div>
              <div className="flex justify-between"><dt>Centre</dt><dd className="font-semibold text-ink">{centre === "all" ? "All in your scope" : findCentre(centre).code}</dd></div>
              <div className="flex justify-between"><dt>Format</dt><dd className="font-semibold uppercase text-ink">{format}</dd></div>
            </dl>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setAskOpen(false)} className="btn-secondary">Cancel</button>
          <button
            disabled={purpose.trim().length < 20 ||
              (basis === "Ethics-approved research protocol" && ethicsRef.trim().length < 4)}
            onClick={() => {
              if (!sess) return;
              const r = requestExport(sess, {
                purpose: purpose.trim(), basis, ethicsRef: ethicsRef.trim(),
                includesIdentifiers: wantIds,
                scopeCentreId: centre, scopeRecords: rows.length,
                scopeGroups: selected.length, format, retentionDays: retention,
              });
              setAskOpen(false);
              setPurpose(""); setEthicsRef("");
              setToast({
                tone: "info",
                title: "Request sent for approval",
                body: `A Head of Department will review it. You can still take the de-identified extract while you wait.`,
                ref: r.ref,
                duration: 7000,
              });
            }}
            className="btn-primary"
          >
            Submit request
          </button>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
