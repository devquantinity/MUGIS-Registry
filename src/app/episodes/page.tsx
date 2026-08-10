"use client";

import Link from "next/link";
import { useTitle } from "@/lib/useTitle";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useScoped, usePatientMap } from "@/lib/useScoped";
import { CENTRES, findCentre } from "@/lib/centres";
import { requiredFieldIds } from "@/lib/parameters";
import { CANCER_TYPES, cancerShort } from "@/lib/types";
import { completeness, deriveStage, stageTone } from "@/lib/staging";
import { fmtDate } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Progress, Table, Td, Th } from "@/components/ui";

export default function EpisodesPage() {
  useTitle("Cancer episodes");
  const router = useRouter();
  const { episodes, session } = useScoped();
  const pmap = usePatientMap();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [centre, setCentre] = useState("all");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const rows = useMemo(() => {
    let out = episodes.map((e) => {
      const p = pmap.get(e.patientId);
      return { e, p, st: deriveStage(e.data), c: completeness(e.data, req) };
    });
    const s = q.trim().toLowerCase();
    if (s) out = out.filter((r) =>
      (r.p?.fullName.toLowerCase().includes(s) ?? false) ||
      (r.p?.registryNo.toLowerCase().includes(s) ?? false) ||
      String(r.e.data.surgery ?? "").toLowerCase().includes(s));
    if (status !== "all") out = out.filter((r) => r.e.status === status);
    if (centre !== "all") out = out.filter((r) => r.e.centreId === centre);
    if (onlyIncomplete) out = out.filter((r) => r.c.pct < 80);
    return out.sort((a, b) => (a.e.updatedAt < b.e.updatedAt ? 1 : -1));
  }, [episodes, pmap, req, q, status, centre, onlyIncomplete]);

  if (!session) return null;

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <PageHeader
        title="Cancer episodes"
        subtitle={`${rows.length} episodes visible to you`}
        actions={<Link href="/patients/new" className="btn-primary">New patient</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {CANCER_TYPES.map((c) => (
          <Badge key={c.id} tone={c.live ? "info" : "muted"}>
            {c.short}{!c.live && " · Phase 2"}
          </Badge>
        ))}
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">Search</label>
            <input className="input" placeholder="Patient, registry number, procedure…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option><option value="draft">Draft</option>
              <option value="active">Active</option><option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="label">Centre</label>
            <select className="input" value={centre} onChange={(e) => setCentre(e.target.value)}>
              <option value="all">All centres</option>
              {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-soot">
          <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)}
            className="h-3.5 w-3.5 accent-[rgb(0,108,56)]" />
          Show only records below 80% complete
        </label>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No episodes match" hint="Adjust the filters, or add a patient." />
      ) : (
        <Table head={
          <tr>
            <Th>Registry no.</Th><Th>Patient</Th><Th>Type</Th><Th>Centre</Th>
            <Th>Stage</Th><Th>Surgery</Th><Th align="center">Status</Th>
            <Th align="center">Complete</Th><Th align="right">Updated</Th>
          </tr>
        } minWidth={980}>
          {rows.map(({ e, p, st, c }) => (
            <tr key={e.id} onClick={() => router.push(`/episodes/${e.id}`)}
              className="cursor-pointer transition-colors hover:bg-forest-50/40">
              <Td><Link href={`/episodes/${e.id}`} className="font-semibold text-forest-500 hover:underline">{p?.registryNo ?? "—"}</Link></Td>
              <Td><span className="font-medium text-ink">{p?.fullName ?? "—"}</span></Td>
              <Td><span className="text-xs text-soot">{cancerShort(e.cancerType)}</span></Td>
              <Td><span className="text-xs text-soot/70">{findCentre(e.centreId).code}</span></Td>
              <Td><Badge tone={stageTone(st.stage)}>{st.stage ? `Stage ${st.stage}` : "—"}</Badge></Td>
              <Td><span className="text-xs text-soot">{String(e.data.surgery || "—")}</span></Td>
              <Td align="center">
                <Badge tone={e.status === "active" ? "ok" : e.status === "draft" ? "warn" : "muted"}>{e.status}</Badge>
              </Td>
              <Td align="center">
                <div className="mx-auto w-20">
                  <Progress value={c.pct} tone={c.pct >= 80 ? "info" : c.pct >= 50 ? "warn" : "bad"} />
                  <span className="mt-1 block text-[10px] tabular-nums text-soot/60">{c.pct}%</span>
                </div>
              </Td>
              <Td align="right"><span className="text-xs text-soot/70">{fmtDate(e.updatedAt)}</span></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
