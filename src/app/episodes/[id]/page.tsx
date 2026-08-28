"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useScoped } from "@/lib/useScoped";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { canEdit } from "@/lib/access";
import { findCentre } from "@/lib/centres";
import { requiredFieldIds, schemaFor } from "@/lib/parameters";
import { cancerLabel } from "@/lib/types";
import type { EpisodeData } from "@/lib/types";
import { cciScore, completeness, deriveStage, stageTone } from "@/lib/staging";
import { ageSex, fmtDate, fmtDateTime, toCsv, download } from "@/lib/format";
import { EpisodeForm } from "@/components/EpisodeForm";
import { Badge, Card, EmptyState, PageHeader, Progress, Toast } from "@/components/ui";
import { Select } from "@/components/Select";

export default function EpisodePage() {
  useTitle("Episode record");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { patients, episodes, session } = useScoped();
  const { updateEpisode, setEpisodeStatus } = useStore();
  const { session: sess } = useSession();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);

  const episode = episodes.find((e) => e.id === id);
  const patient = patients.find((p) => p.id === episode?.patientId);

  const [draft, setDraft] = useState<EpisodeData>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const saveRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    if (episode) { setDraft({ ...episode.data }); setDirty(new Set()); }
  }, [episode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard against closing the tab with unsaved work
  useEffect(() => {
    if (dirty.size === 0) return;
    const onBefore = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty.size]);

  // ⌘S / Ctrl+S saves instead of opening the browser dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!session || !sess) return null;

  if (!episode || !patient) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Episode not found" />
        <EmptyState
          title="No such episode, or not visible to you"
          hint={`Signed in as ${ROLE_LABELS[sess.role]}.`}
          action={<Link href="/episodes" className="btn-secondary">Back to episodes</Link>}
        />
      </div>
    );
  }

  const mine = canEdit(sess, episode.createdBy);
  const stage = deriveStage(draft);
  const cci = cciScore(draft, patient.dob);
  const comp = completeness(draft, req);
  const centre = findCentre(episode.centreId);
  saveRef.current = save;

  function change(fieldId: string, v: string | number | null) {
    setDraft((d) => ({ ...d, [fieldId]: v }));
    setDirty((s) => new Set(s).add(fieldId));
  }

  function save() {
    if (!sess || dirty.size === 0) return;
    if (!mine) return;
    // Field ids go to the store; it resolves them to labels for the audit trail.
    updateEpisode(sess, episode!.id, draft, [...dirty]);
    setDirty(new Set());
    setToast(`Saved ${dirty.size} change${dirty.size === 1 ? "" : "s"} — written to the audit trail`);
  }

  function exportRecord() {
    const groups = schemaFor(episode!.cancerType);
    const rows: (string | number | null)[][] = [];
    rows.push(["Demography", "Registry No", patient!.registryNo]);
    rows.push(["Demography", "Name", patient!.fullName]);
    rows.push(["Demography", "Date of birth", patient!.dob]);
    rows.push(["Demography", "Sex", patient!.sex]);
    for (const g of groups) {
      for (const f of g.fields) {
        if (f.type === "computed") continue;
        rows.push([g.title, f.label, draft[f.id] ?? ""]);
      }
    }
    rows.push(["Final Staging", "AJCC (derived)", stage.stage ?? ""]);
    rows.push(["Charlson", "Score (derived)", cci.score]);
    download(`${patient!.registryNo}-episode.csv`, toCsv(["Group", "Field", "Value"], rows));
    setToast("Episode exported as CSV");
  }

  return (
    <div>
      <Link href={`/patients/${patient.id}`} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-soot/75 hover:text-ink">
        ← {patient.registryNo}
      </Link>

      <PageHeader
        title={cancerLabel(episode.cancerType)}
        subtitle={[patient.fullName, ageSex(patient.dob, patient.sex), centre.name].filter(Boolean).join(" · ")}
        actions={
          <>
            <button onClick={exportRecord} className="btn-secondary">Export record</button>
            {mine && (
              <Select
                className="!w-auto"
                size="sm"
                ariaLabel="Episode status"
                value={episode.status}
                onChange={(v) => { setEpisodeStatus(sess, episode.id, v as "draft" | "active" | "closed"); setToast("Status updated"); }}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "closed", label: "Closed" },
                ]}
              />
            )}
            {mine && (
              <button onClick={save} disabled={dirty.size === 0} className="btn-primary">
                {dirty.size === 0 ? "Saved" : `Save ${dirty.size} change${dirty.size === 1 ? "" : "s"}`}
              </button>
            )}
          </>
        }
      />

      {!mine && (
        <div className="mb-4 rounded-xl border border-line bg-cream px-3.5 py-2.5 text-xs text-soot">
          Read-only. As <span className="font-semibold text-ink">{ROLE_LABELS[sess.role]}</span> you can
          view this record but only the clinician who entered it may change it.
        </div>
      )}

      {/* compact summary strip — one row, live-updating as fields change */}
      <Card padded={false} className="mb-4">
        <div className="grid grid-cols-2 divide-y divide-line sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="px-4 py-2.5" title={stage.reason}>
            <p className="text-[12px] font-semibold text-soot/72">AJCC stage</p>
            <div className="mt-1"><Badge tone={stageTone(stage.stage)}>{stage.stage ? `Stage ${stage.stage}` : "Not derived"}</Badge></div>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[12px] font-semibold text-soot/72">Charlson</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-ink">{cci.score}
              <span className="ml-1.5 text-[12px] font-normal text-soot/72">{cci.breakdown.length} factors</span></p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[12px] font-semibold text-soot/72">Nodes +/total → N</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-ink">
              {draft.nodePositive ?? "—"}<span className="text-sm font-normal text-soot/65">/{draft.nodeHarvested ?? "—"}</span>
              <span className="ml-1.5 text-[13px] font-semibold text-forest-600">{stage.n ?? ""}</span>
            </p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[12px] font-semibold text-soot/72">Complete</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums leading-tight text-ink">{comp.pct}%</span>
              <div className="w-16"><Progress value={comp.pct} tone={comp.pct >= 80 ? "info" : comp.pct >= 50 ? "warn" : "bad"} /></div>
            </div>
          </div>
        </div>
      </Card>

      <EpisodeForm
        cancerType={episode.cancerType}
        data={draft}
        patient={patient}
        onChange={change}
        readOnly={!mine}
        onExit={() => router.push(`/patients/${patient.id}`)}
      />

      <p className="mt-5 border-t border-line pt-3 text-center text-[13px] text-soot/70">
        Entered by {episode.createdBy} · created {fmtDateTime(episode.createdAt)} · last
        updated {fmtDateTime(episode.updatedAt)} · diagnosis {fmtDate(String(draft.dateDiagnosis ?? ""))}
      </p>

      {mine && dirty.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex justify-center">
          <button onClick={save} className="btn-primary shadow-raised">
            Save {dirty.size} change{dirty.size === 1 ? "" : "s"}
          </button>
        </div>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
