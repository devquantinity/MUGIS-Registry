"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canApproveExport } from "@/lib/access";
import type { ExportRequest } from "@/lib/types";

export type ExportAlerts = {
  /** Requests this person can action — never their own. */
  toApprove: ExportRequest[];
  /** Their own request still waiting on somebody else. */
  myPending: ExportRequest | null;
  /** Their own request that has been decided and not yet acted on. */
  myDecided: ExportRequest | null;
  /** True once an approval is live and unused. */
  myApproval: ExportRequest | null;
};

/**
 * One source of truth for the export-approval notifications, so the topbar,
 * the dashboard, the sidebar badge and the export page never disagree about
 * what is outstanding.
 */
export function useExportAlerts(): ExportAlerts {
  const { state } = useStore();
  const { session } = useSession();

  return useMemo(() => {
    const empty: ExportAlerts = { toApprove: [], myPending: null, myDecided: null, myApproval: null };
    if (!session) return empty;
    const now = Date.now();
    const live = (r: ExportRequest) =>
      r.status === "approved" && (!r.expiresAt || new Date(r.expiresAt).getTime() > now);

    return {
      toApprove: canApproveExport(session)
        ? state.exportRequests.filter((r) => r.status === "pending" && r.requestedBy !== session.email)
        : [],
      myPending: state.exportRequests.find(
        (r) => r.requestedBy === session.email && r.status === "pending") ?? null,
      myDecided: state.exportRequests.find(
        (r) => r.requestedBy === session.email && (live(r) || r.status === "rejected")) ?? null,
      myApproval: state.exportRequests.find((r) => r.requestedBy === session.email && live(r)) ?? null,
    };
  }, [state.exportRequests, session]);
}
