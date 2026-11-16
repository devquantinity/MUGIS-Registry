"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTitle } from "@/lib/useTitle";
import { CLINICAL, useSession } from "@/lib/session";
import { api, errorText, type Page, type Patient } from "@/lib/api";
import { ACCESS_LABEL } from "@/lib/patientAccess";
import { ageSex, fmtDate } from "@/lib/format";
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-sm" placeholder="Search name, registry number or identity number"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
        {centreOptions.length > 2 && (
          <div className="w-64">
            <Select ariaLabel="Centre" value={centreId} onChange={(v) => { setCentreId(v); setPage(1); }} options={centreOptions} />
          </div>
        )}
        {meta && <span className="ml-auto text-[13px] text-soot/72">{meta.total} patient{meta.total === 1 ? "" : "s"}</span>}
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
          <Table head={
            <tr>
              <Th>Registry no.</Th><Th>Name</Th><Th>Identity</Th><Th>Centre</Th><Th>Age · sex</Th><Th>Cancer record</Th><Th>Access</Th><Th align="right">Updated</Th>
            </tr>
          }>
            {items.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-cream/60" onClick={() => router.push(`/patients/${p.id}`)}>
                <Td className="font-mono text-[13px]">
                  <Link href={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{p.registry_no}</Link>
                </Td>
                <Td className="font-medium text-ink">{p.full_name}</Td>
                <Td className="font-mono text-[13px] text-soot">{p.id_number_masked ?? p.id_number ?? "—"}</Td>
                <Td>{p.centre.code}</Td>
                <Td>{ageSex(p.date_of_birth ?? "", p.sex ?? "") || "—"}</Td>
                <Td>
                  {p.episodes.length === 0 ? <span className="text-soot/60">—</span> : (
                    <div className="grid w-40 gap-1.5">
                      {p.episodes.map((e) => (
                        <Link key={e.id} href={`/episodes/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="group block" title={`${e.cancer_type_name}: ${e.progress.filled}/${e.progress.total} fields`}>
                          <div className="flex items-baseline justify-between text-[12.5px]">
                            <span className="font-medium text-ink group-hover:underline">{shortCancerType(e.cancer_type, e.cancer_type_name)}</span>
                            <span className="tabular-nums text-soot/80">{e.progress.percent}%</span>
                          </div>
                          <Progress value={e.progress.percent} tone={e.progress.percent >= 80 ? "info" : e.progress.percent >= 40 ? "warn" : "bad"} />
                        </Link>
                      ))}
                    </div>
                  )}
                </Td>
                <Td><Badge tone={ACCESS_LABEL[p.access].tone}>{ACCESS_LABEL[p.access].text}</Badge></Td>
                <Td align="right" className="text-[13px] text-soot/80">{fmtDate(p.updated_at)}</Td>
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
    </div>
  );
}
