import type { PatientAccess } from "@/lib/api";

/** How the caller came to see a patient, as a badge. */
export const ACCESS_LABEL: Record<PatientAccess, { text: string; tone: "info" | "ok" | "muted" | "gold" }> = {
  owner: { text: "Yours", tone: "info" },
  granted_edit: { text: "Granted · edit", tone: "ok" },
  granted_view: { text: "Granted · view", tone: "gold" },
  scope: { text: "In your scope", tone: "muted" },
};
