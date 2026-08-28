"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * Roles as agreed with MUGIS.
 *  - hod        : reads every record in their own centre
 *  - head       : reads every record, every centre (Head of Service)
 *  - clinician  : creates and edits ONLY their own patient records
 *  - researcher : de-identified read + export, nationwide
 *  - trainee    : limited entry + own logbook (logbook ships in Phase 2)
 *  - admin      : full configuration + user management
 *
 * Key order below is the display order of every role dropdown — clinical
 * roles first, the technical admin role last.
 */
export type Role = "admin" | "clinician" | "hod" | "head" | "researcher" | "trainee";

export const ROLE_LABELS: Record<Role, string> = {
  hod: "Head of Department",
  head: "Head of Service",
  clinician: "Clinician",
  researcher: "Researcher",
  trainee: "Trainee",
  admin: "System Admin",
};

export type Session = {
  email: string;
  name: string;
  role: Role;
  centreId: string;
};

type Ctx = {
  session: Session | null;
  ready: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
};

const SessionContext = createContext<Ctx | null>(null);
const KEY = "mugis.session.v3";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // NOTE: sessionStorage is a front-end placeholder so the UI can be reviewed.
  // Real auth is server-side: httpOnly cookie + TOTP second factor.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function signIn(s: Session) {
    setSession(s);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  function signOut() {
    setSession(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <SessionContext.Provider value={{ session, ready, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
