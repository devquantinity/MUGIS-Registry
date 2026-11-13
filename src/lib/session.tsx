"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  api, accessClaims, hasTokens, loadErrorDictionary, onSessionEnded, setAccessToken, setTokens,
  type ApiRole, type Me, type TokenResponse,
} from "@/lib/api";
import { CENTRES } from "@/lib/centres";

/**
 * Roles used by the registry screens (patients, episodes, reports), which
 * still run on demo data until their APIs exist. Each real backend role maps
 * onto one of these keys — see ROLE_FROM_API. "researcher" exists only in
 * the seeded demo data; no real account has it.
 */
export type Role = "admin" | "clinician" | "hod" | "head" | "researcher" | "trainee";

export const ROLE_LABELS: Record<Role, string> = {
  hod: "Head of Department",
  head: "Head of Service",
  clinician: "Consultant",
  researcher: "Researcher",
  trainee: "Fellow / Medical Officer",
  admin: "System Admin",
};

const ROLE_FROM_API: Record<ApiRole, Role> = {
  SYSTEM_ADMIN: "admin",
  HEAD_OF_SERVICE: "head",
  HOD: "hod",
  CONSULTANT: "clinician",
  FELLOW: "trainee",
};

/**
 * What the screens read. `role` and `centreId` are the registry-screen keys
 * (the demo centre id when the real centre's code matches one, so demo
 * records scope correctly); `user` is the real account from the API.
 */
export type Session = {
  email: string;
  name: string;
  role: Role;
  centreId: string;
  apiRole: ApiRole;
  centreCode: string;
  centreName: string;
  user: Me;
};

/**
 *  loading  — checking a stored session
 *  out      — show the sign-in screen
 *  enrol    — signed in, but TOTP is not set up: only enrolment is allowed
 *  in       — signed in and enrolled
 */
export type Phase = "loading" | "out" | "enrol" | "in";

type Ctx = {
  /** Set only when fully signed in (phase "in"). */
  session: Session | null;
  /** The account, also during TOTP enrolment. */
  user: Me | null;
  phase: Phase;
  ready: boolean;
  /** Why the last session ended (a reason code), for the sign-in screen. */
  endedBecause: string | null;
  completeSignIn: (t: TokenResponse) => void;
  finishEnrolment: () => Promise<void>;
  reloadMe: () => Promise<void>;
  switchCentre: (centreId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

function toSession(me: Me): Session {
  const active = me.centres.find((c) => c.id === me.active_centre_id) ?? me.centres.find((c) => c.is_primary);
  const demo = active && CENTRES.find(
    (c) => c.code.toLowerCase() === active.code.toLowerCase() || c.id === active.code.toLowerCase()
  );
  return {
    email: me.email,
    name: me.display_name || me.full_name || me.email,
    role: ROLE_FROM_API[me.role],
    centreId: demo?.id ?? active?.id ?? "",
    apiRole: me.role,
    centreCode: active?.code ?? (me.role === "SYSTEM_ADMIN" ? "All" : "—"),
    centreName: active?.name ?? (me.role === "SYSTEM_ADMIN" ? "All centres" : "No centre"),
    user: me,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [endedBecause, setEndedBecause] = useState<string | null>(null);

  const end = useCallback((reason: string | null) => {
    setTokens(null);
    setMe(null);
    setEndedBecause(reason);
    setPhase("out");
  }, []);

  // A stored session survives a reload; a refresh failure anywhere ends it.
  useEffect(() => {
    onSessionEnded((reason) => end(reason));
    loadErrorDictionary();
    if (!hasTokens()) {
      setPhase("out");
      return;
    }
    api.me()
      .then((u) => {
        setMe(u);
        setPhase(accessClaims()?.mfa_setup_required ? "enrol" : "in");
      })
      .catch(() => end(null));
  }, [end]);

  const completeSignIn = useCallback((t: TokenResponse) => {
    setTokens({ access: t.access_token, refresh: t.refresh_token });
    setMe(t.user);
    setEndedBecause(null);
    setPhase(t.two_factor_setup_required ? "enrol" : "in");
  }, []);

  // After /2fa/enable the old access token still says "setup required"; a
  // refresh issues one that does not.
  const finishEnrolment = useCallback(async () => {
    if (!(await api.refresh())) return;
    setMe(await api.me());
    setPhase("in");
  }, []);

  const reloadMe = useCallback(async () => {
    setMe(await api.me());
  }, []);

  const switchCentre = useCallback(async (centreId: string) => {
    const res = await api.switchCentre(centreId);
    setAccessToken(res.access_token);
    setMe((cur) => (cur ? { ...cur, active_centre_id: res.active_centre_id } : cur));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* already signed out server-side — clear locally regardless */
    }
    end(null);
  }, [end]);

  const session = useMemo(() => (me ? toSession(me) : null), [me]);

  return (
    <SessionContext.Provider value={{
      session: phase === "in" ? session : null,
      user: me,
      phase, ready: phase !== "loading", endedBecause,
      completeSignIn, finishEnrolment, reloadMe, switchCentre, signOut,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
