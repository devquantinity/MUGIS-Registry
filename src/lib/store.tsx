"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeed } from "@/lib/seed";
import { allFields } from "@/lib/parameters";
import type { AuditEntry, Episode, EpisodeData, Patient, RegistryUser } from "@/lib/types";
import type { Session } from "@/lib/session";

const KEY = "mugis.registry.v4";

export type State = {
  patients: Patient[];
  episodes: Episode[];
  users: RegistryUser[];
  audit: AuditEntry[];
};

type Ctx = {
  state: State;
  ready: boolean;
  addPatient: (s: Session, p: Omit<Patient, "id" | "registryNo" | "createdAt" | "updatedAt" | "createdBy">) => Patient;
  updatePatient: (s: Session, id: string, patch: Partial<Patient>) => void;
  deletePatient: (s: Session, id: string) => void;
  addEpisode: (s: Session, patientId: string, cancerType: Episode["cancerType"]) => Episode;
  updateEpisode: (s: Session, id: string, data: EpisodeData, changed: string[]) => void;
  setEpisodeStatus: (s: Session, id: string, status: Episode["status"]) => void;
  updateUser: (s: Session, id: string, patch: Partial<RegistryUser>) => void;
  addUser: (s: Session, u: Omit<RegistryUser, "id" | "lastActive">) => void;
  logAudit: (e: Omit<AuditEntry, "id" | "at">) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

function load(): State {
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed?.patients?.length) return parsed;
    }
  } catch { /* fall through to seed */ }
  return buildSeed();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => buildSeed());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state, ready]);

  const logAudit = useCallback((e: Omit<AuditEntry, "id" | "at">) => {
    setState((s) => ({
      ...s,
      audit: [{ ...e, id: `a${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, at: new Date().toISOString() }, ...s.audit],
    }));
  }, []);

  // NOTE: the new record is built here, not inside the setState updater —
  // React runs updaters asynchronously, so anything constructed in there is
  // still undefined by the time this function returns it to the caller.
  const addPatient: Ctx["addPatient"] = useCallback((sess, p) => {
    const now = new Date().toISOString();
    const n = state.patients.filter((x) => x.centreId === p.centreId).length + 1;
    const created: Patient = {
      ...p,
      id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
      registryNo: `MUG-${p.centreId.toUpperCase()}-${String(n).padStart(4, "0")}`,
      createdBy: sess.email,
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({
      ...s,
      patients: [created, ...s.patients],
      audit: [{
        id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
        centreId: sess.centreId, action: "create", entity: "patient",
        entityId: created.id, entityLabel: `${created.registryNo} — ${created.fullName}`,
      }, ...s.audit],
    }));
    return created;
  }, [state.patients]);

  const updatePatient: Ctx["updatePatient"] = useCallback((sess, id, patch) => {
    const now = new Date().toISOString();
    setState((s) => {
      const before = s.patients.find((p) => p.id === id);
      if (!before) return s;
      const changes = Object.entries(patch)
        .filter(([k, v]) => (before as unknown as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => ({ field: k, from: String((before as unknown as Record<string, unknown>)[k] ?? "—"), to: String(v ?? "—") }));
      return {
        ...s,
        patients: s.patients.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
        audit: changes.length ? [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "update", entity: "patient", entityId: id,
          entityLabel: `${before.registryNo} — ${before.fullName}`, changes,
        }, ...s.audit] : s.audit,
      };
    });
  }, []);

  const deletePatient: Ctx["deletePatient"] = useCallback((sess, id) => {
    const now = new Date().toISOString();
    setState((s) => {
      const p = s.patients.find((x) => x.id === id);
      if (!p) return s;
      return {
        ...s,
        patients: s.patients.filter((x) => x.id !== id),
        episodes: s.episodes.filter((e) => e.patientId !== id),
        audit: [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "delete", entity: "patient", entityId: id,
          entityLabel: `${p.registryNo} — ${p.fullName}`,
        }, ...s.audit],
      };
    });
  }, []);

  const addEpisode: Ctx["addEpisode"] = useCallback((sess, patientId, cancerType) => {
    const now = new Date().toISOString();
    const created: Episode = {
      id: `e${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`,
      patientId, cancerType,
      centreId: sess.centreId,
      status: "draft",
      createdBy: sess.email,
      createdAt: now, updatedAt: now,
      data: {},
    };
    // The patient is looked up INSIDE the updater: when a patient and episode
    // are created in the same tick, this render's state.patients does not yet
    // contain the patient, and the audit label would leak a raw internal id.
    setState((s) => {
      const p = s.patients.find((x) => x.id === patientId);
      const ep = { ...created, centreId: p?.centreId ?? sess.centreId };
      return {
        ...s,
        episodes: [ep, ...s.episodes],
        audit: [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "create", entity: "episode", entityId: ep.id,
          entityLabel: `${p ? `${p.registryNo} — ${p.fullName}` : "New patient"} — new episode`,
        }, ...s.audit],
      };
    });
    return created;
  }, []);

  /** `changed` carries field ids; labels for the audit trail are resolved here. */
  const updateEpisode: Ctx["updateEpisode"] = useCallback((sess, id, data, changed) => {
    const now = new Date().toISOString();
    setState((s) => {
      const before = s.episodes.find((e) => e.id === id);
      if (!before) return s;
      const p = s.patients.find((x) => x.id === before.patientId);
      const labels = allFields(before.cancerType);
      const changes = changed.map((fid) => ({
        field: labels.find((f) => f.id === fid)?.label ?? fid,
        from: String(before.data[fid] ?? "—"),
        to: String(data[fid] ?? "—"),
      }));
      return {
        ...s,
        episodes: s.episodes.map((e) => (e.id === id ? { ...e, data, updatedAt: now } : e)),
        audit: changes.length ? [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "update", entity: "episode", entityId: id,
          entityLabel: `${p?.registryNo ?? ""} — ${p?.fullName ?? "episode"}`, changes,
        }, ...s.audit] : s.audit,
      };
    });
  }, []);

  const setEpisodeStatus: Ctx["setEpisodeStatus"] = useCallback((sess, id, status) => {
    const now = new Date().toISOString();
    setState((s) => {
      const before = s.episodes.find((e) => e.id === id);
      if (!before) return s;
      const p = s.patients.find((x) => x.id === before.patientId);
      return {
        ...s,
        episodes: s.episodes.map((e) => (e.id === id ? { ...e, status, updatedAt: now } : e)),
        audit: [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "update", entity: "episode", entityId: id,
          entityLabel: `${p?.registryNo ?? ""} — status`,
          changes: [{ field: "Status", from: before.status, to: status }],
        }, ...s.audit],
      };
    });
  }, []);

  const updateUser: Ctx["updateUser"] = useCallback((sess, id, patch) => {
    const now = new Date().toISOString();
    setState((s) => {
      const before = s.users.find((u) => u.id === id);
      if (!before) return s;
      const changes = Object.entries(patch)
        .filter(([k, v]) => (before as unknown as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => ({ field: k, from: String((before as unknown as Record<string, unknown>)[k]), to: String(v) }));
      return {
        ...s,
        users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        audit: changes.length ? [{
          id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
          centreId: sess.centreId, action: "update", entity: "user", entityId: id,
          entityLabel: before.name, changes,
        }, ...s.audit] : s.audit,
      };
    });
  }, []);

  const addUser: Ctx["addUser"] = useCallback((sess, u) => {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      users: [{ ...u, id: `u${Date.now().toString(36)}`, lastActive: now }, ...s.users],
      audit: [{
        id: `a${Date.now().toString(36)}`, at: now, userEmail: sess.email, userRole: sess.role,
        centreId: sess.centreId, action: "create", entity: "user", entityId: u.email,
        entityLabel: `${u.name} (${u.role})`,
      }, ...s.audit],
    }));
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = buildSeed();
    setState(fresh);
    try { window.localStorage.setItem(KEY, JSON.stringify(fresh)); } catch { /* quota */ }
  }, []);

  const value = useMemo<Ctx>(() => ({
    state, ready, addPatient, updatePatient, deletePatient, addEpisode,
    updateEpisode, setEpisodeStatus, updateUser, addUser, logAudit, resetDemo,
  }), [state, ready, addPatient, updatePatient, deletePatient, addEpisode,
       updateEpisode, setEpisodeStatus, updateUser, addUser, logAudit, resetDemo]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
