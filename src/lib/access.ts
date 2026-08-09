import type { Episode, Patient } from "@/lib/types";
import type { Role, Session } from "@/lib/session";

/**
 * Record scoping, as agreed with MUGIS.
 *
 *  clinician / trainee : only records they personally entered
 *  hod                 : every record in their own centre
 *  head / researcher   : every record, every centre
 *  admin               : everything, plus configuration
 *
 * In production this is enforced by PostgreSQL row-level security as well as
 * here — the interface is never the only line of defence.
 */

export function scopeLabel(role: Role): string {
  switch (role) {
    case "clinician":
    case "trainee": return "Your own records only";
    case "hod": return "All records in your centre";
    case "head": return "All records, all centres";
    case "researcher": return "De-identified, all centres";
    case "admin": return "Full access";
  }
}

export function canSeePatient(s: Session, p: Patient): boolean {
  switch (s.role) {
    case "admin":
    case "head":
    case "researcher": return true;
    case "hod": return p.centreId === s.centreId;
    case "clinician":
    case "trainee": return p.createdBy === s.email;
  }
}

export function canSeeEpisode(s: Session, e: Episode): boolean {
  switch (s.role) {
    case "admin":
    case "head":
    case "researcher": return true;
    case "hod": return e.centreId === s.centreId;
    case "clinician":
    case "trainee": return e.createdBy === s.email;
  }
}

/** Only the owner (or an admin) may change a record. */
export function canEdit(s: Session, ownerEmail: string): boolean {
  if (s.role === "admin") return true;
  if (s.role === "clinician" || s.role === "trainee") return ownerEmail === s.email;
  return false;
}

export function canCreate(s: Session): boolean {
  return s.role === "admin" || s.role === "clinician" || s.role === "trainee";
}

export function canExport(s: Session): boolean {
  return s.role !== "trainee";
}

export function canAdmin(s: Session): boolean {
  return s.role === "admin";
}

export function canSeeAudit(s: Session): boolean {
  return s.role === "admin" || s.role === "head";
}

/** Researchers never see direct identifiers. */
export function identifiersHidden(s: Session): boolean {
  return s.role === "researcher";
}

export function deIdentify(p: Patient, hidden: boolean): Patient {
  if (!hidden) return p;
  return { ...p, fullName: `Patient ${p.registryNo}`, mykad: "—", passport: "" };
}
