"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useScoped } from "@/lib/useScoped";
import { CENTRES, findCentre } from "@/lib/centres";
import { requiredFieldIds } from "@/lib/parameters";
import { Select } from "@/components/Select";
import { completeness, deriveStage, stageTone } from "@/lib/staging";
import { canCreate, exportNeedsApproval } from "@/lib/access";
import { ageFrom, fmtDate, maskMykad, toCsv, download } from "@/lib/format";
import { makeXlsx, downloadBlob } from "@/lib/xlsx";
import { Badge, Card, EmptyState, PageHeader, Progress, Table, Td, Th, Toast } from "@/components/ui";

type SortKey = "registryNo" | "fullName" | "age" | "stage" | "completeness" | "updated";

export default function PatientsPage() {
  useTitle("Patients");
  const router = useRouter();
  const { patients, episodes, hidden, session } = useScoped();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);
  const [q, setQ] = useState("");
  const [centre, setCentre] = useState("all");
  const [stageF, setStageF] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [reveal, setReveal] = useState(false);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  // Query handed over from the ⌘K palette — via URL (?q=) on navigation,
  // and via event when this page is already mounted.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("q");
      if (fromUrl) { setQ(fromUrl); setPage(1); }
    } catch { /* ignore */ }
    const onApply = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") { setQ(detail); setPage(1); }
    };
    window.addEventListener("mugis:apply-search", onApply);
    return () => window.removeEventListener("mugis:apply-search", onApply);
  }, []);
  const perPage = 15;

  const rows = useMemo(() => {
    const epByPatient = new Map(episodes.map((e) => [e.patientId, e]));
    return patients.map((p) => {
      const e = epByPatient.get(p.id);
      const st = e ? deriveStage(e.data) : null;
      const c = e ? completeness(e.data, req) : { pct: 0, filled: 0, total: req.length };
      return {
        p, e,
        age: ageFrom(p.dob),
        stage: st?.stage ?? null,
        pct: c.pct,
        updated: e?.updatedAt ?? p.updatedAt,
      };
    });
  }, [patients, episodes, req]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows;
    if (s) {
      out = out.filter((r) =>
        r.p.fullName.toLowerCase().includes(s) ||
        r.p.registryNo.toLowerCase().includes(s) ||
        r.p.mykad.toLowerCase().includes(s) ||
        r.p.state.toLowerCase().includes(s) ||
        r.p.ethnic.toLowerCase().includes(s));
    }
    if (centre !== "all") out = out.filter((r) => r.p.centreId === centre);
    if (stageF !== "all") {
      out = stageF === "none"
        ? out.filter((r) => !r.stage)
        : out.filter((r) => r.stage === stageF);
    }
    const mul = dir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      switch (sort) {
        case "registryNo": return mul * a.p.registryNo.localeCompare(b.p.registryNo);
        case "fullName": return mul * a.p.fullName.localeCompare(b.p.fullName);
        case "age": return mul * ((a.age ?? -1) - (b.age ?? -1));
        case "stage": return mul * String(a.stage ?? "ZZ").localeCompare(String(b.stage ?? "ZZ"));
        case "completeness": return mul * (a.pct - b.pct);
        default: return mul * (a.updated < b.updated ? -1 : 1);
      }
    });
  }, [rows, q, centre, stageF, sort, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const view = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);

  function header(key: SortKey, label: string, align: "left" | "right" | "center" = "left") {
    const active = sort === key;
    return (
      <Th align={align}>
        <button
          onClick={() => { if (active) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(key); setDir("asc"); } }}
          className={"inline-flex items-center gap-1 hover:text-ink " + (active ? "text-ink" : "")}
        >
          {label}
          {active && <span className="text-[11px]">{dir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </Th>
    );
  }

  function exportRows() {
    const headers = ["Registry No", "Name", "MyKad", "DOB", "Age", "Sex", "Ethnic", "State", "Centre", "Stage", "Completeness %"];
    const data = filtered.map((r) => [
      r.p.registryNo, r.p.fullName, hidden ? "—" : r.p.mykad, r.p.dob, r.age ?? "", r.p.sex,
      r.p.ethnic, r.p.state, findCentre(r.p.centreId).code, r.stage ?? "", r.pct,
    ]);
    return { headers, data };
  }

  function exportCsv() {
    const { headers, data } = exportRows();
    download(`mugis-patients-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, data));
    setToast(`Exported ${filtered.length} patient records to CSV`);
  }

  function exportXlsx() {
    const { headers, data } = exportRows();
    downloadBlob(`mugis-patients-${new Date().toISOString().slice(0, 10)}.xlsx`,
      makeXlsx("Patients", headers, data));
    setToast(`Exported ${filtered.length} patient records to Excel`);
  }

  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${filtered.length} of ${patients.length} records${hidden ? " · identifiers hidden for your role" : ""}`}
        actions={
          <>
            {!hidden && (
              <button onClick={() => setReveal((v) => !v)} className="btn-secondary">
                {reveal ? "Hide MyKad" : "Reveal MyKad"}
              </button>
            )}
            {!exportNeedsApproval(session) && <button onClick={exportCsv} className="btn-secondary">CSV</button>}
            {!exportNeedsApproval(session) && <button onClick={exportXlsx} className="btn-secondary">Excel</button>}
            {canCreate(session) && <Link href="/patients/new" className="btn-primary">New patient</Link>}
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">Search</label>
            <input className="input" placeholder="Name, registry number, MyKad, state…"
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">Centre</label>
            <Select
              ariaLabel="Filter by centre"
              value={centre}
              onChange={(v) => { setCentre(v); setPage(1); }}
              options={[
                { value: "all", label: "All centres" },
                ...CENTRES.map((c) => ({ value: c.id, label: c.name, hint: c.code })),
              ]}
            />
          </div>
          <div>
            <label className="label">Stage</label>
            <Select
              ariaLabel="Filter by stage"
              value={stageF}
              onChange={(v) => { setStageF(v); setPage(1); }}
              options={[
                { value: "all", label: "All stages" },
                ...["0", "IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IIIC", "IV"].map((s) => ({
                  value: s, label: `Stage ${s}`,
                })),
                { value: "none", label: "Not derived" },
              ]}
            />
          </div>
        </div>
      </Card>

      {view.length === 0 ? (
        <EmptyState
          title="No patients match"
          hint={patients.length === 0
            ? "Your role only shows records you entered yourself. Add a patient to get started."
            : "Try clearing the search or filters."}
          action={canCreate(session) ? <Link href="/patients/new" className="btn-primary">New patient</Link> : undefined}
        />
      ) : (
        <>
          <Table head={
            <tr>
              {header("registryNo", "Registry no.")}
              {header("fullName", "Patient")}
              <Th>MyKad</Th>
              {header("age", "Age", "center")}
              <Th>Centre</Th>
              {header("stage", "Stage")}
              {header("completeness", "Complete", "center")}
              <Th align="right">Updated</Th>
            </tr>
          } minWidth={880}>
            {view.map((r) => (
              <tr key={r.p.id} onClick={() => router.push(`/patients/${r.p.id}`)}
                className="cursor-pointer transition-colors hover:bg-forest-50/40">
                <Td>
                  <Link href={`/patients/${r.p.id}`} className="font-semibold text-forest-500 hover:underline">
                    {r.p.registryNo}
                  </Link>
                </Td>
                <Td>
                  <span className="font-medium text-ink">{r.p.fullName}</span>
                  <span className="ml-2 text-[13px] text-soot/72">{r.p.ethnic} · {r.p.state}</span>
                </Td>
                <Td><span className="font-mono text-[13px] text-soot/80">{hidden ? "—" : maskMykad(r.p.mykad, reveal)}</span></Td>
                <Td align="center"><span className="tabular-nums">{r.age ?? "—"}</span></Td>
                <Td><span className="text-xs text-soot/80">{findCentre(r.p.centreId).code}</span></Td>
                <Td><Badge tone={stageTone(r.stage)}>{r.stage ? `Stage ${r.stage}` : "—"}</Badge></Td>
                <Td align="center">
                  <div className="mx-auto w-20">
                    <Progress value={r.pct} tone={r.pct >= 80 ? "info" : r.pct >= 50 ? "warn" : "bad"} />
                    <span className="mt-1 block text-[12px] tabular-nums text-soot/75">{r.pct}%</span>
                  </div>
                </Td>
                <Td align="right"><span className="text-xs text-soot/80">{fmtDate(r.updated)}</span></Td>
              </tr>
            ))}
          </Table>

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-soot/75">
                Showing {(Math.min(page, pages) - 1) * perPage + 1}–{Math.min(Math.min(page, pages) * perPage, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
