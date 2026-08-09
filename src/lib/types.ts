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
  | "create" | "update" | "delete" | "view" | "export" | "signin" | "signout";

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
