/**
 * Parameter definitions for the MUGIS Upper GI Cancer Registry.
 *
 * Transcribed from the MUGIS parameter documents. Groups 1 (Demography)
 * live on the Patient record; groups 2-12 live on the Episode record.
 *
 * Adding a further cancer type is a matter of adding another entry to
 * SCHEMAS below — no schema migration, no new form code.
 */

export type FieldType =
  | "text" | "textarea" | "number" | "date" | "select" | "computed";

export type Computed = "cci" | "bmi" | "pN" | "pM" | "ajcc";

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  help?: string;
  computed?: Computed;
  /** Show only when another field holds one of these values. */
  showIf?: { field: string; equals: string[] };
};

export type Group = {
  id: string;
  no: number;
  title: string;
  fields: Field[];
};

const YN = ["No", "Yes"];
const YNU = ["No", "Yes", "Unknown"];
const NEGPOS = ["Negative", "Positive"];

export const ETHNIC = [
  "Bajau", "Bidayuh", "Chinese", "Dayak", "Iban", "Indian", "Kadazan",
  "Kadazandusun", "Malay", "Melanau", "Murut", "Orang Asli", "Orang Sungai",
  "Rungus", "Others/Foreigner",
];

export const STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak",
  "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu",
  "WP Kuala Lumpur", "WP Putrajaya", "WP Labuan",
];

/** Group 1 — Demography. Stored on the Patient record. */
export const DEMOGRAPHY: Field[] = [
  { id: "fullName", label: "Full Name", type: "text" },
  { id: "mykad", label: "MyKad No", type: "text", help: "Format 000000-00-0000" },
  { id: "passport", label: "Passport No", type: "text" },
  { id: "dob", label: "Date of Birth", type: "date" },
  { id: "sex", label: "Sex", type: "select", options: ["Female", "Male"] },
  { id: "ethnic", label: "Ethnic", type: "select", options: ETHNIC },
  { id: "state", label: "State", type: "select", options: STATES },
];

/* ------------------------------------------------------------------ */
/* Gastric Adenocarcinoma                                              */
/* ------------------------------------------------------------------ */

const GASTRIC_GROUPS: Group[] = [
  {
    id: "referrals", no: 2, title: "Referrals",
    fields: [
      { id: "referredCentre", label: "Referred Center", type: "text" },
      { id: "yourCentre", label: "Your Center", type: "text" },
      { id: "firstDateReferred", label: "First date referred center", type: "date" },
      { id: "dateFirstSeen", label: "Date first seen", type: "date" },
    ],
  },
  {
    id: "cci", no: 3, title: "Charlson Comorbidity Index",
    fields: [
      { id: "cciMi", label: "Myocardial Infarction", type: "select", options: YN },
      { id: "cciChf", label: "CHF", type: "select", options: YN },
      { id: "cciPvd", label: "PVD", type: "select", options: YN },
      { id: "cciCva", label: "CVA / TIA", type: "select", options: YN },
      { id: "cciDementia", label: "Dementia", type: "select", options: YN },
      { id: "cciCopd", label: "COPD", type: "select", options: YN },
      { id: "cciCtd", label: "Connective Tissue disease", type: "select", options: YN },
      { id: "cciPud", label: "PUD", type: "select", options: YN },
      { id: "cciLiver", label: "Liver disease", type: "select", options: ["None", "Mild", "Moderate to severe"] },
      { id: "cciDm", label: "DM", type: "select", options: ["None/diet control", "Uncomplicated", "End-organ damage"] },
      { id: "cciHemiplegia", label: "Hemiplegia", type: "select", options: YN },
      { id: "cciCkd", label: "CKD", type: "select", options: ["No", "Moderate, creatinine ≥270umol/L", "Severe, dialysis/transplant/uraemia"] },
      { id: "cciSolidTumour", label: "Solid Tumour", type: "select", options: ["Localised", "Metastatic"] },
      { id: "cciLeukaemia", label: "Leukaemia", type: "select", options: YN },
      { id: "cciLymphoma", label: "Lymphoma", type: "select", options: YN },
      { id: "cciAids", label: "AIDS", type: "select", options: YN },
      { id: "cciScore", label: "Charlson Score", type: "computed", computed: "cci", help: "Derived from the answers above plus patient age" },
    ],
  },
  {
    id: "comorbid", no: 4, title: "Comorbidities",
    fields: [
      { id: "comorbidOthers", label: "Others", type: "text" },
      { id: "smoker", label: "Smoker", type: "select", options: YNU },
      { id: "ecog", label: "ECOG", type: "select", options: ["0", "1", "2", "3", "4"] },
      { id: "asa", label: "ASA", type: "select", options: ["1", "2", "3", "4", "5"] },
    ],
  },
  {
    id: "anthro", no: 5, title: "Anthropometry",
    fields: [
      { id: "sga", label: "SGA", type: "select", options: ["A", "B", "C"] },
      { id: "height", label: "Height", type: "number", unit: "cm" },
      { id: "weight", label: "Weight", type: "number", unit: "kg" },
      { id: "bmi", label: "BMI", type: "computed", computed: "bmi", unit: "kg/m²" },
    ],
  },
  {
    id: "preop", no: 6, title: "Pre-op Tumour Condition",
    fields: [
      { id: "firstPresentation", label: "First presentation", type: "select",
        options: ["Abdominal Mass", "Anaemia", "Dysphagia", "Early Satiety", "Epigastric Pain", "Haematemesis", "Melaena", "Persistent Vomiting", "Constitutional Symptoms", "Incidental"] },
      { id: "dateDiagnosis", label: "Date of Diagnosis", type: "date" },
      { id: "diagnosticModality", label: "Diagnostic Modality Used", type: "select", options: ["OGDS", "EUS"] },
      { id: "ogdsHpeNo", label: "OGDS HPE number", type: "text" },
      { id: "hpe1", label: "HPE1", type: "select",
        options: ["Adenocarcinoma", "Poorly cohesive carcinoma", "Adenosquamous", "Neuroendocrine tumour", "Mixed adenocarcinoma and neuroendocrine tumour", "Adematoid", "Adenocystic carcinoma", "Lymphoma", "Dysplasia", "Inconclusive", "Not done"] },
      { id: "tumourLocation", label: "Tumour Location", type: "select",
        options: ["Cardio-oesophageal Junction", "Proximal third", "Middle Third", "Distal Third", "Diffuse", "Remnant", "Duodenum"] },
      { id: "borrmann", label: "Borrmann", type: "select",
        options: ["I – Polypoidal", "II – Fungating", "III – Ulcerating", "IV - Diffuse"] },
      { id: "cloUrease", label: "CLO / urease", type: "select", options: ["Negative", "Positive", "Not done"] },
      { id: "cT", label: "Initial clinical staging (T)", type: "select",
        options: ["T0", "Tis", "T1a", "T1b", "T2", "T3", "T4a", "T4b"] },
      { id: "cN", label: "Initial clinical staging (N)", type: "select", options: ["N0", "N1", "N2", "N3"] },
      { id: "cM", label: "Initial clinical staging (M)", type: "select", options: ["M0", "M1"] },
      { id: "radiologyModality", label: "Radiology Modalities used", type: "select", options: ["CT", "MRI", "PET"] },
      { id: "lapStaging", label: "Lap staging done", type: "select", options: YN },
    ],
  },
  {
    id: "neoadj", no: 7, title: "Neoadjuvant",
    fields: [
      { id: "neoadjChemo", label: "Neoadjuvant chemo", type: "select", options: YN },
      { id: "neoadjRegime", label: "Neoadjuvant regime", type: "select",
        options: ["FLOT", "FOLFOX/XELOX", "ECF/DCF", "Others (specify)"],
        showIf: { field: "neoadjChemo", equals: ["Yes"] } },
      { id: "neoadjCycles", label: "Total neoadjuvant cycle", type: "number",
        showIf: { field: "neoadjChemo", equals: ["Yes"] } },
      { id: "neoadjDoseReduction", label: "Dose reduction", type: "select", options: YN,
        showIf: { field: "neoadjChemo", equals: ["Yes"] } },
      { id: "neoadjDoseDetails", label: "Dose-reduction / interruption details", type: "textarea",
        showIf: { field: "neoadjDoseReduction", equals: ["Yes"] } },
      { id: "neoadjComplete", label: "Neoadjuvant complete", type: "select", options: YN,
        showIf: { field: "neoadjChemo", equals: ["Yes"] } },
    ],
  },
  {
    id: "operative", no: 8, title: "Operative",
    fields: [
      { id: "dateSurgery", label: "Date of surgery", type: "date" },
      { id: "surgery", label: "Surgery", type: "select",
        options: ["No Surgery", "Subtotal Gastrectomy", "Total Gastrectomy", "Proximal Gastrectomy", "Others (specify)"] },
      { id: "additionalOrgan", label: "Additional organ resection", type: "select", options: YN },
      { id: "method", label: "Method", type: "select", options: ["Open", "Laparoscopic", "Robotic"] },
      { id: "conversionOpen", label: "Conversion to open", type: "select", options: YN },
      { id: "lnDissection", label: "LN dissection", type: "select", options: ["Nil", "D1", "D1-plus", "D2", "D3"] },
      { id: "opIntention", label: "Intention", type: "select", options: ["Curative", "Palliative"] },
      { id: "opTime", label: "Op time", type: "number", unit: "min" },
      { id: "ebl", label: "EBL", type: "number", unit: "mls" },
      { id: "dateDischarge", label: "Date of discharge", type: "date" },
      { id: "cd30", label: "Clavien-Dindo (30 days)", type: "select",
        options: ["Nil", "I", "II", "IIIA", "IIIB", "IVA", "IVB", "V"] },
      { id: "complications30", label: "30 day complications", type: "textarea",
        showIf: { field: "cd30", equals: ["I", "II", "IIIA", "IIIB", "IVA", "IVB", "V"] } },
    ],
  },
  {
    id: "specimen", no: 9, title: "Surgical Specimen",
    fields: [
      { id: "surgHpeNo", label: "Surgical HPE No", type: "text" },
      { id: "dateHpeSurg", label: "Date HPE Surgical", type: "date" },
      { id: "mandard", label: "Mandard Score", type: "select", options: ["Not applicable", "1", "2", "3", "4", "5"] },
      { id: "specLocation", label: "Location", type: "select",
        options: ["Cardio-oesophageal Junction", "Proximal Third", "Middle Third", "Distal Third", "Diffuse"] },
      { id: "maxSize", label: "Maximum size", type: "number", unit: "mm" },
      { id: "specType", label: "Type", type: "select",
        options: ["Adenocarcinoma", "Poorly cohesive carcinoma", "Adenosquamous", "Neuroendocrine tumour", "MANEC", "Adematoid", "Squamous cell carcinoma", "Leiomyosarcoma", "Lymphoma", "Others"] },
      { id: "differentiation", label: "Differentiation", type: "select", options: ["Well", "Moderate", "Poor"] },
      { id: "lauren", label: "Lauren", type: "select", options: ["Intestinal", "Diffuse"] },
      { id: "nodeHarvested", label: "Node harvested", type: "number" },
      { id: "nodePositive", label: "Node positive", type: "number", help: "Drives the pathological N stage" },
      { id: "proximalMargin", label: "Proximal Margin", type: "select", options: NEGPOS },
      { id: "distalMargin", label: "Distal Margin", type: "select", options: NEGPOS },
      { id: "circMargin", label: "Circumferential Margin", type: "select", options: NEGPOS },
      { id: "chronicGastritis", label: "Chronic gastritis", type: "select", options: YNU },
      { id: "intestinalMetaplasia", label: "Intestinal metaplasia", type: "select", options: YNU },
      { id: "gastricAtrophy", label: "Gastric atrophy", type: "select", options: YNU },
      { id: "hPylori", label: "H pylori manifestation", type: "select", options: YNU },
      { id: "lvi", label: "Lymphovascular invasion", type: "select", options: YNU },
      { id: "pni", label: "Perineural invasion", type: "select", options: YNU },
    ],
  },
  {
    id: "staging", no: 10, title: "Final Staging",
    fields: [
      { id: "metastaticSite", label: "Metastatic Site", type: "select",
        options: ["Unable to assess", "Nil", "Adrenal", "Bone", "Brain", "Liver", "Lung", "Non-regional Lymph Nodes", "Peritoneum", "Others", "More than one site"] },
      { id: "metastaticSpecify", label: "Metastatic site specify", type: "text",
        showIf: { field: "metastaticSite", equals: ["Others", "More than one site"] } },
      { id: "pT", label: "T", type: "select", options: ["T0", "Tis", "T1a", "T1b", "T2", "T3", "T4a", "T4b"] },
      { id: "pN", label: "N", type: "computed", computed: "pN", help: "Derived from node positive count" },
      { id: "pM", label: "M", type: "computed", computed: "pM", help: "Derived from metastatic site" },
      { id: "ajcc", label: "AJCC Final Stage", type: "computed", computed: "ajcc", help: "AJCC 8th edition, pathological" },
    ],
  },
  {
    id: "adjuvant", no: 11, title: "Adjuvant / Palliative",
    fields: [
      { id: "adjuvant", label: "Adjuvant / palliative given", type: "select", options: YN },
      { id: "adjRegime", label: "Regime", type: "select",
        options: ["Nil", "FOLFOX", "Paclitaxel", "Capecitabine", "Others (specify)"],
        showIf: { field: "adjuvant", equals: ["Yes"] } },
      { id: "adjCycles", label: "Cycles", type: "number", showIf: { field: "adjuvant", equals: ["Yes"] } },
      { id: "adjIntention", label: "Intention", type: "select", options: ["Curative", "Palliative"],
        showIf: { field: "adjuvant", equals: ["Yes"] } },
      { id: "adjDoseReduction", label: "Dose reduction / interruption", type: "select",
        options: ["No", "Yes", "Not done"], showIf: { field: "adjuvant", equals: ["Yes"] } },
    ],
  },
  {
    id: "followup", no: 12, title: "Follow up",
    fields: [
      { id: "recurrence", label: "Recurrence", type: "select", options: YN },
      { id: "recurrenceDate", label: "Recurrence date", type: "date",
        showIf: { field: "recurrence", equals: ["Yes"] } },
      { id: "death", label: "Death", type: "select", options: YN },
      { id: "deathDate", label: "Date of Death", type: "date", showIf: { field: "death", equals: ["Yes"] } },
      { id: "causeOfDeath", label: "Cause of Death", type: "select",
        options: ["Cancer Related", "Not Cancer Related", "Unknown"],
        showIf: { field: "death", equals: ["Yes"] } },
      { id: "lastSeen", label: "Last seen", type: "date" },
      { id: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
];

export const SCHEMAS: Record<string, Group[]> = {
  "gastric-adeno": GASTRIC_GROUPS,
};

export function schemaFor(cancerType: string): Group[] {
  return SCHEMAS[cancerType] ?? GASTRIC_GROUPS;
}

export function allFields(cancerType: string): Field[] {
  return schemaFor(cancerType).flatMap((g) => g.fields);
}

export function fieldById(cancerType: string, id: string): Field | undefined {
  return allFields(cancerType).find((f) => f.id === id);
}

/** Fields a user must fill for a record to count as complete. */
export function requiredFieldIds(cancerType: string): string[] {
  return allFields(cancerType)
    .filter((f) => f.type !== "computed")
    .map((f) => f.id);
}
