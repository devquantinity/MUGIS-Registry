import type { Role } from "@/lib/session";

export type CancerType = "gastric-adeno" | "oeso-adeno" | "oeso-scc" | "gist";

export const CANCER_TYPES: { id: CancerType; label: string; short: string; live: boolean }[] = [
  { id: "gastric-adeno", label: "Gastric Adenocarcinoma", short: "Gastric Adeno", live: true },
  { id: "oeso-adeno", label: "Oesophageal Adenocarcinoma", short: "Oeso Adeno", live: false },
  { id: "oeso-scc", label: "Oesophageal SCC", short: "Oeso SCC", live: false },
  { id: "gist", label: "GIST", short: "GIST", live: false },
];

export function cancerLabel(id: CancerType) {
  return CANCER_TYPES.find((c) => c.id === id)?.label ?? id;
}
export function cancerShort(id: CancerType) {
  return CANCER_TYPES.find((c) => c.id === id)?.short ?? id;
}

export type Patient = {
  id: string;
  registryNo: string;
  fullName: string;
  mykad: string;
  passport: string;
  dob: string;
  sex: "Female" | "Male" | "";
  ethnic: string;
  state: string;
  centreId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EpisodeStatus = "draft" | "active" | "closed";

export type EpisodeData = Record<string, string | number | null>;

export type Episode = {
  id: string;
  patientId: string;
  cancerType: CancerType;
  centreId: string;
  status: EpisodeStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  data: EpisodeData;
};

export type AuditAction =
  | "create" | "update" | "delete" | "view" | "export" | "signin" | "signout"
  | "request" | "approve" | "reject";

/**
 * PDPA control on direct identifiers.
 *
 * De-identified extracts run on the spot. An extract carrying names, MyKad
 * numbers or dates of birth cannot be produced until a second, more senior
 * person approves a stated purpose — the check happens BEFORE the data
 * leaves, not in the audit trail afterwards.
 *
 * An approval is single-use and time-limited: it names the requester, the
 * purpose, the scope it was granted for, and expires if unused.
 */
export type ExportRequestStatus = "pending" | "approved" | "rejected" | "used" | "expired";

export const LEGAL_BASIS = [
  "Patient care / clinical follow-up",
  "Ethics-approved research protocol",
  "Ministry of Health statutory reporting",
  "Internal audit or quality assurance",
  "Data migration or system transfer",
] as const;

export type LegalBasis = (typeof LEGAL_BASIS)[number];

export type ExportRequest = {
  id: string;
  ref: string;
  requestedBy: string;
  requestedByName: string;
  requestedRole: Role;
  requestedAt: string;
  /** Free-text justification — PDPA purpose limitation. */
  purpose: string;
  basis: LegalBasis;
  /** Ethics/IRB reference, when the basis is a research protocol. */
  ethicsRef: string;
  /** Snapshot of what was asked for, so an approval cannot be reused wider. */
  /** Whether the release covers direct identifiers, or bulk volume only. */
  includesIdentifiers: boolean;
  scopeCentreId: string;
  scopeRecords: number;
  scopeGroups: number;
  format: string;
  retentionDays: number;
  status: ExportRequestStatus;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** Approval window — unused approvals lapse rather than sitting open. */
  expiresAt?: string;
  usedAt?: string;
};

export type AuditEntry = {
  id: string;
  at: string;
  userEmail: string;
  userRole: Role;
  centreId: string;
  action: AuditAction;
  entity: "patient" | "episode" | "user" | "system";
  entityId: string;
  entityLabel: string;
  changes?: { field: string; from: string; to: string }[];
};

export type RegistryUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  centreId: string;
  status: "active" | "invited" | "suspended";
  twoFactor: boolean;
  lastActive: string;
};
