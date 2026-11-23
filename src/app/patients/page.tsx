"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, errorText, type Page, type Patient } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { fmtDate } from "@/lib/format";
import { shortCancerType } from "@/lib/cancerTypes";
import { Badge, Card, EmptyState, PageHeader, Progress, Table, Td, Th } from "@/components/ui";
import { Select } from "@/components/Select";

const PAGE_SIZE = 20;

/** Patients this caller may see (GET /patients) — the database decides which. */
export default function PatientsPage() {
  useTitle("Patients");
  const router = useRouter();
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [centreId, setCentreId] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Patient[] | null>(null);
  const [meta, setMeta] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clinical = !!session && CLINICAL.includes(session.role);

  const centreOptions = useMemo(() => {
    const list = session?.user.centres ?? [];
    return [{ value: "", label: "All centres" }, ...list.map((c) => ({ value: c.id, label: c.name, hint: c.code }))];
  }, [session]);

  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(q.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!clinical) return;
    let alive = true;
    setError(null);
    api.patients({ q: query || undefined, centre_id: centreId || undefined, page, page_size: PAGE_SIZE })
      .then((r) => { if (alive) { setItems(r.items); setMeta(r.page); } })
      .catch((e) => { if (alive) { setError(errorText(e)); setItems([]); } });
    return () => { alive = false; };
  }, [clinical, query, centreId, page]);

  if (!session) return null;
  if (!clinical) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Patients" />
        <Card><p className="text-sm text-soot">System administrators do not work with patient records.</p></Card>
      </div>
    );
  }

  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.page_size)) : 1;

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Every patient you may see: your own, those in your scope, and any you were granted access to."
        actions={<Link href="/patients/new" className="btn-primary">New patient</Link>}
      />

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input sm:max-w-sm" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
            placeholder="Registry no., name or IC"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
          {centreOptions.length > 2 && (
            <div className="w-full sm:w-64">
              <Select ariaLabel="Centre" value={centreId} onChange={(v) => { setCentreId(v); setPage(1); }} options={centreOptions} />
            </div>
          )}
          {meta && <span className="ml-auto hidden text-[13px] text-soot/72 sm:inline">{meta.total} patient{meta.total === 1 ? "" : "s"}</span>}
        </div>
        <p className="mt-1.5 text-[13px] text-soot/72">
          A registry number finds any patient you can see; a name or IC finds your own or shared patients.
          {meta && <span className="sm:hidden"> {meta.total} patient{meta.total === 1 ? "" : "s"}.</span>}
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">{error}</p>}

      {items === null ? (
        <Card><p className="text-sm text-soot/72">Loading…</p></Card>
      ) : items.length === 0 ? (
        <EmptyState
          title={query ? "No patients match" : "No patients to show"}
          hint={query ? "Try another name or number. Patients outside your scope do not appear here." : "Patients you register, those in your scope, and any you are granted access to appear here."}
          action={!query ? <Link href="/patients/new" className="btn-primary">New patient</Link> : undefined}
        />
      ) : (
        <>
          {/* Phones and tablets: one card per patient (two across on a tablet) —
              eight columns only fit from lg. grid-cols-1 = minmax(0, 1fr), so a
              long name or number can never widen the page. */}
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
            {items.map((p) => {
              const facts = [
                p.centre.code,
                [p.age_years !== null ? `${p.age_years}y` : "", p.sex ?? ""].filter(Boolean).join(" · "),
              ].filter(Boolean).join(" · ");
              const identity = p.id_number_masked ?? p.id_number;
              return (
                <li key={p.id} className="card relative min-w-0 p-3.5 transition-colors active:bg-cream/70">
                  {/* The badge drops under the name when the name would get less than 10rem beside it. */}
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    {/* The name's ::after covers the card, so the whole card opens the patient. */}
                    <Link href={`/patients/${p.id}`} className="min-w-0 grow basis-40 text-base font-semibold leading-snug text-ink after:absolute after:inset-0 after:rounded-[14px]">
                      {p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}
                    </Link>
                    <Badge tone={ACCESS_LABEL[p.access].tone} className="mt-0.5 shrink-0">{ACCESS_LABEL[p.access].text}</Badge>
                  </div>
                  <p className="mt-1 break-words font-mono text-[13px] text-soot">{p.registry_no}{identity ? ` · ${identity}` : ""}</p>
                  <p className="mt-0.5 text-[13.5px] text-soot/85">{facts} · updated {fmtDate(p.updated_at)}</p>
                  {p.episodes.length > 0 && (
                    <div className="relative z-10 mt-2.5 grid grid-cols-1 gap-2 border-t border-ink/[0.06] pt-2.5">
                      {p.episodes.map((e) => (
                        <Link key={e.id} href={`/episodes/${e.id}`} className="block rounded-lg py-1.5 touch:py-2.5">
                          <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                            <span className="min-w-0 truncate font-medium text-ink">{e.cancer_type_name}</span>
                            <span className="shrink-0 tabular-nums text-soot/80">{e.progress.percent}%</span>
                          </div>
                          <div className="mt-1"><Progress value={e.progress.percent} tone={e.progress.percent >= 80 ? "info" : e.progress.percent >= 40 ? "warn" : "bad"} /></div>
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Five columns: name with age and sex, number with centre and IC — fits
              an iPad in landscape and a laptop beside the sidebar. */}
          <Table className="hidden lg:block" head={
            <tr>
              <Th>Patient</Th><Th>Registry no.</Th><Th>Cancer record</Th><Th>Access</Th><Th align="right">Updated</Th>
            </tr>
          }>
            {items.map((p) => {
              const facts = [p.age_years !== null ? `${p.age_years}y` : "", p.sex ?? ""].filter(Boolean).join(" · ");
              const identity = p.id_number_masked ?? p.id_number;
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-cream/60" onClick={() => router.push(`/patients/${p.id}`)}>
                  <Td>
                    <span className="block font-medium text-ink">{p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}</span>
                    {facts && <span className="block text-[13px] text-soot/80">{facts}</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Link href={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()} className="block font-mono text-[13px] hover:underline">{p.registry_no}</Link>
                    <span className="block text-[13px] text-soot/80">{p.centre.code}{identity ? <span className="font-mono"> · {identity}</span> : ""}</span>
                  </Td>
                  <Td>
                    {p.episodes.length === 0 ? <span className="text-soot/60">—</span> : (
                      <div className="grid w-52 grid-cols-1 gap-1.5">
                        {p.episodes.map((e) => (
                          <Link key={e.id} href={`/episodes/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="group block touch:py-1.5" title={`${e.cancer_type_name}: ${e.progress.filled}/${e.progress.total} fields`}>
                            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                              <span className="min-w-0 truncate font-medium text-ink group-hover:underline">{shortCancerType(e.cancer_type, e.cancer_type_name)}</span>
                              <span className="shrink-0 tabular-nums text-soot/80">{e.progress.percent}%</span>
                            </div>
                            <Progress value={e.progress.percent} tone={e.progress.percent >= 80 ? "info" : e.progress.percent >= 40 ? "warn" : "bad"} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td><Badge tone={ACCESS_LABEL[p.access].tone} className="whitespace-nowrap">{ACCESS_LABEL[p.access].text}</Badge></Td>
                  <Td align="right" className="whitespace-nowrap text-[13px] text-soot/80">{fmtDate(p.updated_at)}</Td>
                </tr>
              );
            })}
          </Table>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 text-[13px] sm:justify-end">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="text-soot/72">Page {page} of {pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
