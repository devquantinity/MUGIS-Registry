/**
 * Derived clinical values.
 *
 * IMPORTANT: the AJCC tables below are implemented from the AJCC 8th edition
 * pathological staging for gastric cancer. They must be reviewed and signed
 * off by a MUGIS consultant before go-live. Gotka implements the tables;
 * clinical correctness remains a MUGIS responsibility.
 */
import type { EpisodeData } from "@/lib/types";
import { num, ageFrom } from "@/lib/format";

/* ---------------- Charlson Comorbidity Index ---------------- */

export type CciBreakdown = { label: string; points: number }[];

export function cciScore(d: EpisodeData, dob?: string): { score: number; breakdown: CciBreakdown } {
  const b: CciBreakdown = [];
  const one: [string, string][] = [
    ["cciMi", "Myocardial infarction"], ["cciChf", "CHF"], ["cciPvd", "PVD"],
    ["cciCva", "CVA / TIA"], ["cciDementia", "Dementia"], ["cciCopd", "COPD"],
    ["cciCtd", "Connective tissue disease"], ["cciPud", "PUD"],
  ];
  for (const [id, label] of one) if (d[id] === "Yes") b.push({ label, points: 1 });

  if (d.cciLiver === "Mild") b.push({ label: "Mild liver disease", points: 1 });
  if (d.cciLiver === "Moderate to severe") b.push({ label: "Moderate/severe liver disease", points: 3 });

  if (d.cciDm === "Uncomplicated") b.push({ label: "Diabetes, uncomplicated", points: 1 });
  if (d.cciDm === "End-organ damage") b.push({ label: "Diabetes with end-organ damage", points: 2 });

  if (d.cciHemiplegia === "Yes") b.push({ label: "Hemiplegia", points: 2 });

  if (d.cciCkd === "Moderate, creatinine ≥270umol/L") b.push({ label: "Moderate CKD", points: 2 });
  if (d.cciCkd === "Severe, dialysis/transplant/uraemia") b.push({ label: "Severe CKD", points: 2 });

  if (d.cciSolidTumour === "Localised") b.push({ label: "Localised solid tumour", points: 2 });
  if (d.cciSolidTumour === "Metastatic") b.push({ label: "Metastatic solid tumour", points: 6 });

  if (d.cciLeukaemia === "Yes") b.push({ label: "Leukaemia", points: 2 });
  if (d.cciLymphoma === "Yes") b.push({ label: "Lymphoma", points: 2 });
  if (d.cciAids === "Yes") b.push({ label: "AIDS", points: 6 });

  if (dob) {
    const age = ageFrom(dob);
    if (age !== null) {
      const pts = age < 50 ? 0 : age < 60 ? 1 : age < 70 ? 2 : age < 80 ? 3 : 4;
      if (pts > 0) b.push({ label: `Age ${age}`, points: pts });
    }
  }

  return { score: b.reduce((s, x) => s + x.points, 0), breakdown: b };
}

/* ---------------- BMI ---------------- */

export function bmi(d: EpisodeData): number | null {
  const h = num(d.height);
  const w = num(d.weight);
  if (!h || !w || h <= 0) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 10) / 10;
}

export function bmiBand(v: number | null): { label: string; tone: "ok" | "warn" | "bad" } {
  if (v === null) return { label: "—", tone: "ok" };
  if (v < 18.5) return { label: "Underweight", tone: "bad" };
  if (v < 23) return { label: "Normal", tone: "ok" };
  if (v < 27.5) return { label: "Overweight", tone: "warn" };
  return { label: "Obese", tone: "warn" };
}

/* ---------------- AJCC 8th edition — gastric, pathological ---------------- */

export type NStage = "N0" | "N1" | "N2" | "N3a" | "N3b";
export type MStage = "M0" | "M1";

/** N stage from the number of positive regional nodes. */
export function derivePN(d: EpisodeData): NStage | null {
  const n = num(d.nodePositive);
  if (n === null || n < 0) return null;
  if (n === 0) return "N0";
  if (n <= 2) return "N1";
  if (n <= 6) return "N2";
  if (n <= 15) return "N3a";
  return "N3b";
}

export function pnRule(n: NStage): string {
  return { N0: "0 nodes", N1: "1–2 nodes", N2: "3–6 nodes", N3a: "7–15 nodes", N3b: "≥16 nodes" }[n];
}

/** M stage from the recorded metastatic site. */
export function derivePM(d: EpisodeData): MStage | null {
  const s = d.metastaticSite;
  if (!s) return null;
  if (s === "Unable to assess") return null;
  return s === "Nil" ? "M0" : "M1";
}

/** T values collapse: T1a and T1b both behave as T1 for staging. */
function normT(t: unknown): string | null {
  const v = String(t ?? "");
  if (!v) return null;
  if (v === "T1a" || v === "T1b") return "T1";
  return v;
}

const STAGE_TABLE: Record<string, Record<NStage, string>> = {
  Tis: { N0: "0", N1: "0", N2: "0", N3a: "0", N3b: "0" },
  T1: { N0: "IA", N1: "IB", N2: "IIA", N3a: "IIB", N3b: "IIIB" },
  T2: { N0: "IB", N1: "IIA", N2: "IIB", N3a: "IIIA", N3b: "IIIB" },
  T3: { N0: "IIA", N1: "IIB", N2: "IIIA", N3a: "IIIB", N3b: "IIIC" },
  T4a: { N0: "IIB", N1: "IIIA", N2: "IIIA", N3a: "IIIB", N3b: "IIIC" },
  T4b: { N0: "IIIA", N1: "IIIB", N2: "IIIB", N3a: "IIIC", N3b: "IIIC" },
};

export type StageResult = {
  stage: string | null;
  n: NStage | null;
  m: MStage | null;
  t: string | null;
  reason: string;
};

export function deriveStage(d: EpisodeData): StageResult {
  const t = normT(d.pT);
  const n = derivePN(d);
  const m = derivePM(d);

  if (m === "M1") {
    return { stage: "IV", n, m, t, reason: "Distant metastasis present — Stage IV regardless of T and N." };
  }
  if (t === "T0") {
    return { stage: null, n, m, t, reason: "T0 — no evidence of primary tumour. Stage not assigned." };
  }
  if (!t || !n || !m) {
    const missing = [!t && "T", !n && "node positive count", !m && "metastatic site"]
      .filter(Boolean).join(", ");
    return { stage: null, n, m, t, reason: `Cannot derive — missing ${missing}.` };
  }
  const row = STAGE_TABLE[t];
  if (!row) return { stage: null, n, m, t, reason: `Unrecognised T value "${t}".` };
  return {
    stage: row[n], n, m, t,
    reason: `${t} ${n} ${m} → Stage ${row[n]} (AJCC 8th edition, pathological).`,
  };
}

export const STAGE_ORDER = ["0", "IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IIIC", "IV"];

export function stageTone(stage: string | null): "ok" | "warn" | "bad" | "muted" {
  if (!stage) return "muted";
  if (stage === "0" || stage.startsWith("I") && !stage.startsWith("II") && !stage.startsWith("III")) return "ok";
  if (stage.startsWith("II")) return "warn";
  return "bad";
}

/* ---------------- computed dispatcher ---------------- */

export function computedValue(key: string, d: EpisodeData, dob?: string): string {
  switch (key) {
    case "cci": return String(cciScore(d, dob).score);
    case "bmi": { const v = bmi(d); return v === null ? "—" : String(v); }
    case "pN": return derivePN(d) ?? "—";
    case "pM": return derivePM(d) ?? "—";
    case "ajcc": return deriveStage(d).stage ?? "—";
    default: return "—";
  }
}

/* ---------------- completeness ---------------- */

export function completeness(d: EpisodeData, fieldIds: string[]): { filled: number; total: number; pct: number } {
  const total = fieldIds.length;
  const filled = fieldIds.filter((id) => {
    const v = d[id];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return { filled, total, pct: total === 0 ? 0 : Math.round((filled / total) * 100) };
}
