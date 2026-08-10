"use client";

import { useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useScoped, usePatientMap } from "@/lib/useScoped";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canExport } from "@/lib/access";
import { CENTRES, findCentre } from "@/lib/centres";
import { schemaFor } from "@/lib/parameters";
import { cciScore, deriveStage } from "@/lib/staging";
import { ageFrom, download, toCsv } from "@/lib/format";
import { makeXlsx, downloadBlob } from "@/lib/xlsx";
import { printPdf } from "@/lib/pdf";
import { Badge, Card, PageHeader, SectionTitle, Toast } from "@/components/ui";

export default function ExportPage() {
  useTitle("Data export");
  const { episodes, hidden, session } = useScoped();
  const pmap = usePatientMap();
  const { logAudit } = useStore();
  const { session: sess } = useSession();

  const groups = useMemo(() => schemaFor("gastric-adeno"), []);
  const [selected, setSelected] = useState<string[]>(groups.map((g) => g.id));
  const [centre, setCentre] = useState("all");
  const [identifiers, setIdentifiers] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf" | "json">("xlsx");
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(
    () => (centre === "all" ? episodes : episodes.filter((e) => e.centreId === centre)),
    [episodes, centre]
  );

  const includeIdentifiers = identifiers && !hidden;

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
    logAudit({
      userEmail: sess.email, userRole: sess.role, centreId: sess.centreId,
      action: "export", entity: "system", entityId: "-",
      entityLabel: `${includeIdentifiers ? "Identifiable" : "De-identified"} export — ${data.length} records, ${format === "pdf" ? "key columns" : columns.length + " columns"}, ${format.toUpperCase()}`,
    });
    setToast(`Exported ${data.length} records — logged to the audit trail`);
  }

  if (!session || !sess) return null;

  if (!canExport(sess)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Data export" />
        <Card><p className="text-sm text-soot">Your role does not permit data export.</p></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1250px]">
      <PageHeader
        title="Data export"
        subtitle="Every export is written to the audit trail with the user, scope and column count."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle right={
            <div className="flex gap-2">
              <button onClick={() => setSelected(groups.map((g) => g.id))} className="text-[11px] font-semibold text-forest-500 hover:underline">All</button>
              <button onClick={() => setSelected([])} className="text-[11px] font-semibold text-soot/60 hover:underline">None</button>
            </div>
          }>
            Parameter groups
          </SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups.map((g) => {
              const on = selected.includes(g.id);
              return (
                <label key={g.id}
                  className={"flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors " +
                    (on ? "border-forest-500 bg-forest-50" : "border-line bg-paper hover:bg-cream")}>
                  <input type="checkbox" checked={on} className="h-3.5 w-3.5 accent-[rgb(0,108,56)]"
                    onChange={(e) => setSelected((s) => e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id))} />
                  <span className={on ? "font-semibold text-forest-600" : "text-soot"}>{g.no}. {g.title}</span>
                  <span className="ml-auto text-[10px] tabular-nums text-soot/50">
                    {g.fields.filter((f) => f.type !== "computed").length}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Scope</SectionTitle>
            <label className="label">Centre</label>
            <select className="input" value={centre} onChange={(e) => setCentre(e.target.value)}>
              <option value="all">All centres in your scope</option>
              {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

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
              <p className="mt-2 text-[10px] leading-relaxed text-soot/60">
                PDF prints a registry listing with the key clinical columns — the full
                field set goes to Excel or CSV.
              </p>
            )}

            <div className="mt-4">
              {hidden ? (
                <div className="rounded-xl border border-line bg-cream px-3 py-2.5">
                  <Badge tone="muted">De-identified only</Badge>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-soot/70">
                    Your role never receives names, MyKad numbers or dates of birth.
                  </p>
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gold-300 bg-gold-100/60 px-3 py-2.5">
                  <input type="checkbox" checked={identifiers} className="mt-0.5 h-3.5 w-3.5 accent-[rgb(200,134,30)]"
                    onChange={(e) => setIdentifiers(e.target.checked)} />
                  <span>
                    <span className="text-xs font-semibold text-ink">Include direct identifiers</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-soot/70">
                      Adds name, MyKad and date of birth. Only for purposes with an approved
                      basis — this choice is recorded in the audit trail.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle>Preview</SectionTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-soot/70">Records</dt><dd className="font-bold tabular-nums text-ink">{rows.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/70">Columns</dt><dd className="font-bold tabular-nums text-ink">{columns.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/70">Groups</dt><dd className="font-bold tabular-nums text-ink">{selected.length}/{groups.length}</dd></div>
              <div className="flex justify-between"><dt className="text-soot/70">Identifiers</dt>
                <dd><Badge tone={includeIdentifiers ? "warn" : "ok"}>{includeIdentifiers ? "Included" : "Excluded"}</Badge></dd></div>
            </dl>
            <button onClick={run} disabled={rows.length === 0 || selected.length === 0}
              className="btn-primary mt-4 w-full">
              Export {rows.length} records
            </button>
          </Card>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
