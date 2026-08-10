"use client";

import { useMemo } from "react";
import { useTitle } from "@/lib/useTitle";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canAdmin } from "@/lib/access";
import { CENTRES } from "@/lib/centres";
import { requiredFieldIds } from "@/lib/parameters";
import { completeness } from "@/lib/staging";
import { Badge, Card, HBar, PageHeader, Progress, SectionTitle, Stat, Table, Td, Th } from "@/components/ui";

export default function AdminCentresPage() {
  useTitle("Centres");
  const { state } = useStore();
  const { session } = useSession();
  const req = useMemo(() => requiredFieldIds("gastric-adeno"), []);

  const rows = useMemo(() => CENTRES.map((c) => {
    const eps = state.episodes.filter((e) => e.centreId === c.id);
    const pts = state.patients.filter((p) => p.centreId === c.id);
    const users = state.users.filter((u) => u.centreId === c.id);
    const comp = eps.map((e) => completeness(e.data, req).pct);
    return {
      centre: c, patients: pts.length, episodes: eps.length, users: users.length,
      active: users.filter((u) => u.status === "active").length,
      avgComplete: comp.length ? Math.round(comp.reduce((a, b) => a + b, 0) / comp.length) : 0,
    };
  }), [state, req]);

  if (!session) return null;
  if (!canAdmin(session)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Centres" />
        <Card><p className="text-sm text-soot">Only a System Admin can manage centres.</p></Card>
      </div>
    );
  }

  const totalPts = rows.reduce((s, r) => s + r.patients, 0);

  return (
    <div className="mx-auto w-full max-w-[1250px]">
      <PageHeader
        title="Participating centres"
        subtitle="Placeholder list — replace with the confirmed MUGIS centres before go-live."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Centres" value={CENTRES.length} tone="info" />
        <Stat label="Patients nationwide" value={totalPts} tone="info" />
        <Stat label="Registered users" value={state.users.length} tone="info" />
      </div>

      <Table head={
        <tr><Th>Centre</Th><Th>State</Th><Th align="center">Patients</Th><Th align="center">Episodes</Th>
          <Th align="center">Users</Th><Th align="center">Data completeness</Th></tr>
      } minWidth={800}>
        {rows.map((r) => (
          <tr key={r.centre.id} className="hover:bg-cream/50">
            <Td>
              <span className="font-medium text-ink">{r.centre.name}</span>
              <Badge tone="muted" className="ml-2">{r.centre.code}</Badge>
            </Td>
            <Td><span className="text-xs text-soot">{r.centre.state}</span></Td>
            <Td align="center"><span className="tabular-nums">{r.patients}</span></Td>
            <Td align="center"><span className="tabular-nums">{r.episodes}</span></Td>
            <Td align="center">
              <span className="tabular-nums">{r.active}</span>
              <span className="text-[10px] text-soot/50">/{r.users}</span>
            </Td>
            <Td align="center">
              <div className="mx-auto w-24">
                <Progress value={r.avgComplete} tone={r.avgComplete >= 80 ? "info" : r.avgComplete >= 50 ? "warn" : "bad"} />
                <span className="mt-1 block text-[10px] tabular-nums text-soot/60">{r.avgComplete}%</span>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <Card className="mt-4">
        <SectionTitle>Recruitment by centre</SectionTitle>
        <HBar data={rows.filter((r) => r.patients > 0).map((r) => ({ label: r.centre.name, value: r.patients }))} />
      </Card>
    </div>
  );
}
