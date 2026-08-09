"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { canSeeEpisode, canSeePatient, deIdentify, identifiersHidden } from "@/lib/access";
import type { Episode, Patient } from "@/lib/types";

/** Everything a page should read — already filtered to what this user may see. */
export function useScoped() {
  const { state } = useStore();
  const { session } = useSession();

  return useMemo(() => {
    if (!session) {
      return { patients: [] as Patient[], episodes: [] as Episode[], hidden: false, session: null };
    }
    const hidden = identifiersHidden(session);
    const patients = state.patients
      .filter((p) => canSeePatient(session, p))
      .map((p) => deIdentify(p, hidden));
    const episodes = state.episodes.filter((e) => canSeeEpisode(session, e));
    return { patients, episodes, hidden, session };
  }, [state.patients, state.episodes, session]);
}

export function usePatientMap() {
  const { patients } = useScoped();
  return useMemo(() => {
    const m = new Map<string, Patient>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);
}
