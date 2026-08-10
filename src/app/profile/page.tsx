"use client";

import { useMemo } from "react";
import { useTitle } from "@/lib/useTitle";
import { useStore } from "@/lib/store";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { scopeLabel } from "@/lib/access";
import { findCentre } from "@/lib/centres";
import { initials } from "@/components/Shell";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle, Stat } from "@/components/ui";

export default function ProfilePage() {
  useTitle("Profile");
  const { session, signOut } = useSession();
  const { state } = useStore();

  const me = useMemo(
    () => state.users.find((u) => u.email === session?.email),
    [state.users, session]
  );

  const mine = useMemo(() => {
    if (!session) return { patients: 0, episodes: 0, activity: [] as typeof state.audit };
    return {
      patients: state.patients.filter((p) => p.createdBy === session.email).length,
      episodes: state.episodes.filter((e) => e.createdBy === session.email).length,
      activity: state.audit.filter((a) => a.userEmail === session.email).slice(0, 10),
    };
  }, [state, session]);

  if (!session) return null;
  const centre = findCentre(session.centreId);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <PageHeader title="Profile" subtitle="Your account, access scope and recent activity." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-forest-500 text-xl font-bold text-white">
              {initials(session.name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold text-ink">{session.name}</h2>
              <p className="truncate text-sm text-soot/70">{session.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="info">{ROLE_LABELS[session.role]}</Badge>
                <Badge tone="muted">{centre.code}</Badge>
                {me?.twoFactor && <Badge tone="ok">2FA enabled</Badge>}
              </div>
            </div>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold text-soot/55">Centre</dt>
              <dd className="mt-0.5 text-sm text-ink">{centre.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-soot/55">Access scope</dt>
              <dd className="mt-0.5 text-sm text-ink">{scopeLabel(session.role)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-soot/55">Account status</dt>
              <dd className="mt-0.5 text-sm text-ink">{me ? me.status : "Demo session"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-soot/55">Last active</dt>
              <dd className="mt-0.5 text-sm text-ink">{me ? fmtDateTime(me.lastActive) : "Now"}</dd>
            </div>
          </dl>
        </Card>

        <div className="grid content-start gap-3">
          <Stat label="Patients you entered" value={mine.patients} tone="info" />
          <Stat label="Episodes you entered" value={mine.episodes} tone="info" />
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>Your recent activity</SectionTitle>
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {mine.activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Badge tone={a.action === "create" ? "ok" : a.action === "delete" ? "bad" : a.action === "export" ? "gold" : "info"}>
                  {a.action}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.entityLabel}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-soot/50">{fmtDateTime(a.at)}</span>
              </li>
            ))}
            {mine.activity.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-soot/60">
                Nothing yet — activity appears here as you enter and update records.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-8 border-t border-line pt-4 text-center">
        <button
          onClick={signOut}
          className="text-xs text-soot/50 underline-offset-2 transition-colors hover:text-soot hover:underline"
        >
          Sign out of the registry
        </button>
      </div>
    </div>
  );
}
