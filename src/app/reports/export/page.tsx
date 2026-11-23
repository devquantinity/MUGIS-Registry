"use client";

/**
 * Data export.
 *
 * Clinical roles request an export of the patients they can see and download
 * it here. The rules live in the API (row-level security, identifiers only
 * for patients you own or hold a grant for, free text blanked on the rest);
 * this page only asks, lists and downloads. Every file is encrypted at rest,
 * needs a fresh authenticator code to download, and expires after 3 days.
 *
 * The System Admin has no patient access: they see the export log instead.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { useSession } from "@/lib/session";
import {
  api, ApiError, errorText, loadErrorDictionary,
  type AdminExport, type CancerType, type ExportFormat, type ExportJob, type FormSection,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, Check, EmptyState, Field, Modal, PageHeader, Table, Td, Th, Toast } from "@/components/ui";
import { Select } from "@/components/Select";
import { DatePicker } from "@/components/DatePicker";
import OtpInput from "@/components/OtpInput";

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "xlsx", label: "Excel", hint: "A sheet per cancer type, plus a data dictionary" },
  { value: "csv", label: "CSV", hint: "A zip: one file per cancer type, plus a dictionary" },
  { value: "pdf", label: "PDF", hint: "Printable, one record at a time" },
];
const FORMAT_LABEL: Record<ExportFormat, string> = { xlsx: "Excel", csv: "CSV", pdf: "PDF" };

const STATUS: Record<ExportJob["status"], { text: string; tone: "ok" | "warn" | "bad" | "muted" | "info" }> = {
  queued: { text: "Waiting", tone: "info" },
  running: { text: "Building", tone: "info" },
  ready: { text: "Ready", tone: "ok" },
  failed: { text: "Failed", tone: "bad" },
  expired: { text: "Expired", tone: "muted" },
};

function fmtSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataExportPage() {
  useTitle("Data export");
  const { session } = useSession();
  if (!session) return null;
  return session.role === "admin" ? <ExportLog /> : <ClinicalExports />;
}

// ─── Clinical roles: request and download ───────────────────────────────────

function ClinicalExports() {
  const [jobs, setJobs] = useState<ExportJob[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ExportJob | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    api.exports().then((r) => { setJobs(r.items); setLoadError(null); }).catch((e) => setLoadError(errorText(e)));
  }, []);
  useEffect(() => { loadErrorDictionary(); load(); }, [load]);

  // While anything is being built, look again every 2 seconds.
  const busy = jobs?.some((j) => j.status === "queued" || j.status === "running") ?? false;
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(load, 2000);
    return () => window.clearInterval(t);
  }, [busy, load]);

  return (
    <div>
      <PageHeader
        title="Data export"
        subtitle="Export the cancer records you can see. Files are encrypted, need your authenticator code to download, and are deleted after 3 days."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <NewExport onQueued={(j) => { setJobs((cur) => [j, ...(cur ?? [])]); setToast("Export requested — it will appear below when ready."); }} />
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">Your exports</h2>
          {loadError && <Card className="mb-3"><p className="text-sm text-danger-700">{loadError}</p></Card>}
          {jobs === null && !loadError && <Card><p className="text-sm text-soot/72">Loading…</p></Card>}
          {jobs && jobs.length === 0 && (
            <EmptyState title="No exports yet" hint="Choose what to export and request it. Small exports are ready in seconds; larger ones email you when done." />
          )}
          {jobs && jobs.length > 0 && (
            <ul className="space-y-2.5">
              {jobs.map((j) => <ExportCard key={j.id} job={j} onDownload={() => setDownloading(j)} />)}
            </ul>
          )}
        </section>
      </div>

      <DownloadDialog job={downloading} onClose={() => setDownloading(null)}
        onDone={(name) => { setDownloading(null); setToast(`Downloaded ${name}`); }} onGone={load} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function NewExport({ onQueued }: { onQueued: (j: ExportJob) => void }) {
  const { session } = useSession();
  const centres = session?.user.centres ?? [];
  const [types, setTypes] = useState<CancerType[] | null>(null);
  const [sections, setSections] = useState<Record<string, FormSection[]>>({});
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [chosenTypes, setChosenTypes] = useState<string[]>([]); // empty = all
  const [centre, setCentre] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [allGroups, setAllGroups] = useState(true);
  const [groups, setGroups] = useState<string[]>([]);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    api.cancerTypes().then(async (t) => {
      if (!alive) return;
      setTypes(t);
      const forms = await Promise.all(t.map((x) => api.cancerForm(x.code).catch(() => null)));
      if (!alive) return;
      const out: Record<string, FormSection[]> = {};
      forms.forEach((f) => { if (f) out[f.code] = f.form.sections; });
      setSections(out);
    }).catch((e) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, []);

  // Parameter groups of the chosen types (all types when none is chosen), in
  // form order, each once.
  const groupOptions = useMemo(() => {
    const codes = chosenTypes.length ? chosenTypes : Object.keys(sections);
    const seen = new Map<string, string>();
    for (const c of codes) for (const s of sections[c] ?? []) if (!s.retired && !seen.has(s.key)) seen.set(s.key, s.label);
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [chosenTypes, sections]);
  // A group that no longer applies to the chosen types is dropped.
  useEffect(() => {
    setGroups((g) => g.filter((k) => groupOptions.some((o) => o.key === k)));
  }, [groupOptions]);

  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const dateError = from && to && from > to ? "The start date is after the end date." : null;
  const passwordError = usePassword && password.length > 0 && password.length < 8 ? "At least 8 characters." : null;
  const invalid = !!dateError || (usePassword && password.length < 8) || (!allGroups && groups.length === 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || sending) return;
    setSending(true);
    setError(null);
    try {
      const job = await api.requestExport({
        format,
        cancer_types: chosenTypes.length ? chosenTypes : undefined,
        centre_id: centre || undefined,
        diagnosed_from: from || undefined,
        diagnosed_to: to || undefined,
        groups: allGroups ? undefined : groups,
        password: usePassword ? password : undefined,
      });
      setPassword("");
      onQueued(job);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <h2 className="text-[15px] font-semibold text-ink">New export</h2>

        <div className="rounded-xl border border-forest-500/15 bg-forest-50/60 px-3.5 py-3 text-[13.5px] leading-relaxed text-ink/85 dark:bg-forest-500/10">
          You get every cancer record you can see in the patient list. Names, MyKad/passport numbers and other
          personal details are included <strong>only for patients you added or hold an approved access grant for</strong>.
        </div>

        <fieldset>
          <legend className="label">Format</legend>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => (
              <label key={f.value}
                className={"flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors " +
                  (format === f.value ? "border-forest-500 bg-forest-50/70 ring-1 ring-forest-500/30 dark:bg-forest-500/10" : "border-ink/10 hover:border-forest-500/40")}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="format" value={f.value} checked={format === f.value}
                    onChange={() => setFormat(f.value)} className="accent-forest-500" />
                  <span className="text-[14.5px] font-semibold text-ink">{f.label}</span>
                </span>
                <span className="mt-0.5 pl-6 text-[12.5px] leading-snug text-soot/75">{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Cancer types</legend>
          {types === null ? <p className="text-sm text-soot/72">Loading…</p> : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {types.map((t) => (
                <Check key={t.code} label={t.name} checked={chosenTypes.includes(t.code)}
                  onChange={(on) => setChosenTypes((c) => toggle(c, t.code, on))} />
              ))}
            </div>
          )}
          <p className="mt-1 text-[13px] text-soot/72">{chosenTypes.length ? `${chosenTypes.length} selected` : "None ticked: every type."}</p>
        </fieldset>

        {centres.length > 1 && (
          <Field label="Hospital">
            <Select ariaLabel="Hospital" value={centre} onChange={setCentre}
              options={[{ value: "", label: "All hospitals" }, ...centres.map((c) => ({ value: c.id, label: c.name, hint: c.code }))]} />
          </Field>
        )}

        <div>
          <p className="label">Date of diagnosis</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[13px] text-soot/75">From</span>
              <div className="min-w-0 flex-1"><DatePicker value={from} onChange={setFrom} placeholder="Any" /></div>
              {from && <ClearButton label="Clear start date" onClick={() => setFrom("")} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[13px] text-soot/75">To</span>
              <div className="min-w-0 flex-1"><DatePicker value={to} onChange={setTo} placeholder="Any" /></div>
              {to && <ClearButton label="Clear end date" onClick={() => setTo("")} />}
            </div>
          </div>
          <p className={"mt-1 text-[13px] " + (dateError ? "text-danger-700" : "text-soot/72")}>
            {dateError ?? "Records with no date of diagnosis are left out when either date is set."}
          </p>
        </div>

        <fieldset>
          <legend className="label">Parameter groups</legend>
          <Check label="All parameter groups" checked={allGroups} onChange={setAllGroups} />
          {!allGroups && (
            <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl border border-ink/[0.07] p-3 sm:grid-cols-2">
              {groupOptions.map((g) => (
                <Check key={g.key} label={g.label} checked={groups.includes(g.key)}
                  onChange={(on) => setGroups((c) => toggle(c, g.key, on))} />
              ))}
              {groupOptions.length === 0 && <p className="text-sm text-soot/72">Loading…</p>}
            </div>
          )}
          {!allGroups && groups.length === 0 && <p className="mt-1 text-[13px] text-danger-700">Pick at least one group.</p>}
          <p className="mt-1 text-[13px] text-soot/72">The record details (registry no., hospital, age, sex) are always included.</p>
        </fieldset>

        <fieldset>
          <Check label="Protect the file with a password" checked={usePassword}
            hint="The file stays locked after download. Share the password separately; it is never stored, so a forgotten one means requesting the export again."
            onChange={(on) => { setUsePassword(on); if (!on) setPassword(""); }} />
          {usePassword && (
            <div className="mt-2 sm:pl-[30px]">
              <div className="relative">
                <input className="input w-full pr-16" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={128}
                  aria-label="File password" placeholder="8 characters or more" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2 text-[13px] font-semibold text-forest-600">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordError && <p className="mt-1 text-[13px] text-danger-700">{passwordError}</p>}
              {format === "csv" && (
                <p className="mt-1 text-[13px] text-soot/72">A password-protected zip opens in 7-Zip or WinZip; the built-in Windows and Mac unzip may not open it.</p>
              )}
            </div>
          )}
        </fieldset>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={invalid || sending}>
            {sending ? "Requesting…" : "Request export"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-soot/70 hover:bg-ink/[0.06] hover:text-ink">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  );
}

function filterSummary(j: ExportJob, typeName: (c: string) => string): string {
  const f = j.filters;
  const parts: string[] = [];
  parts.push(f.cancer_types.length ? f.cancer_types.map(typeName).join(", ") : "All cancer types");
  if (f.diagnosed_from || f.diagnosed_to) {
    parts.push(`diagnosed ${f.diagnosed_from ?? "…"} – ${f.diagnosed_to ?? "…"}`);
  }
  if (f.groups.length) parts.push(`${f.groups.length} parameter group${f.groups.length === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function useTypeNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    api.cancerTypes().then((t) => setNames(Object.fromEntries(t.map((x) => [x.code, x.name])))).catch(() => undefined);
  }, []);
  return (code: string) => names[code] ?? code;
}

function ExportCard({ job: j, onDownload }: { job: ExportJob; onDownload: () => void }) {
  const typeName = useTypeNames();
  const st = STATUS[j.status];
  return (
    <li className="card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-semibold text-ink">
            {FORMAT_LABEL[j.format]} export
            {j.password_protected && <Badge tone="gold">Password</Badge>}
          </p>
          <p className="mt-0.5 text-[13px] text-soot/80">{filterSummary(j, typeName)}</p>
        </div>
        <Badge tone={st.tone} className="shrink-0">
          {(j.status === "queued" || j.status === "running") && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />}
          {st.text}
        </Badge>
      </div>

      {j.status === "ready" || j.status === "expired" ? (
        <p className="mt-2 text-[13px] text-soot/80">
          {j.row_count} record{j.row_count === 1 ? "" : "s"}
          {j.identified_rows ? ` · ${j.identified_rows} with identifiers` : " · de-identified"}
          {j.size_bytes != null && ` · ${fmtSize(j.size_bytes)}`}
        </p>
      ) : j.status === "failed" ? (
        <p className="mt-2 text-[13px] text-danger-700">{errorText(new ApiError(0, j.error_reason ?? "export_failed", "The export could not be created."))}</p>
      ) : (
        <p className="mt-2 text-[13px] text-soot/75">Being prepared. Larger exports email you when ready.</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-soot/70">
          Requested {fmtDateTime(j.created_at)}
          {j.status === "ready" && j.expires_at && <> · deleted {fmtDateTime(j.expires_at)}</>}
        </p>
        {j.status === "ready" && (
          <button onClick={onDownload} className="btn-primary !min-h-0 px-3.5 py-1.5 text-[13.5px] touch:!min-h-[44px]">
            Download
          </button>
        )}
      </div>
    </li>
  );
}

/** Asks for a fresh authenticator code, then saves the file. */
function DownloadDialog({ job, onClose, onDone, onGone }: {
  job: ExportJob | null; onClose: () => void; onDone: (name: string) => void; onGone: () => void;
}) {
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  useEffect(() => { if (job) { setCode(Array(6).fill("")); setError(null); sent.current = false; } }, [job]);

  async function go(digits: string[]) {
    if (!job || busy || sent.current) return;
    sent.current = true;
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await api.downloadExport(job.id, digits.join(""));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onDone(filename);
    } catch (e) {
      setError(errorText(e));
      setCode(Array(6).fill(""));
      sent.current = false;
      if (e instanceof ApiError && (e.reason === "export_expired" || e.reason === "export_not_found")) onGone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!job} onClose={onClose} title="Confirm with your authenticator">
      <p className="text-sm leading-relaxed text-soot">
        Enter the 6-digit code from your authenticator app to download{" "}
        <span className="font-medium text-ink">{job?.file_name ?? "this export"}</span>.
        {job?.password_protected && " You will also need the file password to open it."}
      </p>
      <div className="mt-4">
        <OtpInput code={code} onCode={setCode} disabled={busy} onComplete={go} />
      </div>
      {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => go(code)} className="btn-primary" disabled={busy || code.some((d) => d === "")}>
          {busy ? "Downloading…" : "Download"}
        </button>
      </div>
    </Modal>
  );
}

// ─── System Admin: the export log ────────────────────────────────────────────

const PAGE_SIZE = 50;

function ExportLog() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminExport[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const typeName = useTypeNames();

  useEffect(() => {
    let alive = true;
    api.adminExports({ page, page_size: PAGE_SIZE })
      .then((r) => { if (alive) { setData({ items: r.items, total: r.page.total }); setError(null); } })
      .catch((e) => { if (alive) setError(errorText(e)); });
    return () => { alive = false; };
  }, [page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const who = (e: AdminExport) => e.user.full_name || e.user.email;

  return (
    <div>
      <PageHeader title="Export log"
        subtitle="Every data export: who asked, what for, how many records carried personal data, and how often it was downloaded. Files and patient data are never shown here." />
      {error && <Card className="mb-4"><p className="text-sm text-danger-700">{error}</p></Card>}

      <ul className="space-y-2.5 lg:hidden">
        {(data?.items ?? []).map((e) => (
          <li key={e.id} className="card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-ink">{who(e)}</p>
                <p className="text-[13px] text-soot/80">{FORMAT_LABEL[e.format]} · {filterSummary(e, typeName)}</p>
              </div>
              <Badge tone={STATUS[e.status].tone} className="shrink-0">{STATUS[e.status].text}</Badge>
            </div>
            <p className="mt-1.5 text-[13px] text-soot/80">
              {e.row_count ?? 0} records · {e.identified_rows ?? 0} with identifiers · {e.downloads} download{e.downloads === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[12.5px] text-soot/70">{fmtDateTime(e.created_at)}</p>
          </li>
        ))}
      </ul>

      <Table className="hidden lg:block" minWidth={900} head={
        <tr><Th>Requested by</Th><Th>When</Th><Th>Format</Th><Th>Filters</Th><Th align="right">Records</Th>
          <Th align="right">With identifiers</Th><Th align="right">Downloads</Th><Th align="center">Status</Th></tr>
      }>
        {(data?.items ?? []).map((e) => (
          <tr key={e.id} className="hover:bg-cream/50">
            <Td><span className="font-medium text-ink">{who(e)}</span>{e.user.full_name && <span className="block break-all text-xs text-soot/72">{e.user.email}</span>}</Td>
            <Td><span className="whitespace-nowrap text-xs text-soot">{fmtDateTime(e.created_at)}</span></Td>
            <Td>{FORMAT_LABEL[e.format]}{e.password_protected && <Badge tone="gold" className="ml-1.5">Password</Badge>}</Td>
            <Td><span className="text-xs text-soot">{filterSummary(e, typeName)}</span></Td>
            <Td align="right">{e.row_count ?? "—"}</Td>
            <Td align="right">{e.identified_rows ?? "—"}</Td>
            <Td align="right">{e.downloads}</Td>
            <Td align="center"><Badge tone={STATUS[e.status].tone}>{STATUS[e.status].text}</Badge></Td>
          </tr>
        ))}
      </Table>

      {data && data.items.length === 0 && <EmptyState title="No exports yet" hint="Exports appear here as soon as anyone requests one." />}
      {!data && !error && <Card><p className="text-sm text-soot/72">Loading…</p></Card>}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-soot/80">Page {page} of {pages}</span>
          <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
