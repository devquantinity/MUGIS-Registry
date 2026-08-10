/**
 * Deterministic dummy data. Every value here is invented — no real patient
 * information is present. Replace with a live database before go-live.
 */
import { CENTRES } from "@/lib/centres";
import type { AuditEntry, Episode, EpisodeData, Patient, RegistryUser } from "@/lib/types";
import type { Role } from "@/lib/session";

const REF = new Date("2026-08-08T09:00:00Z").getTime();

/** Small deterministic PRNG so the seed is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = rng(20260808);
const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p: number) => rand() < p;
const daysAgo = (n: number) => new Date(REF - n * 86400000).toISOString();
const dateAgo = (n: number) => daysAgo(n).slice(0, 10);

const MALAY_M = ["Ahmad", "Mohd Faizal", "Zulkifli", "Hafiz", "Amirul", "Rosli", "Shahrul", "Nazri", "Khairul", "Azman", "Ismail", "Ridzuan", "Syed Omar", "Badrul", "Kamarul", "Firdaus", "Hakim", "Zaidi"];
const MALAY_F = ["Siti Aminah", "Nurul Huda", "Fatimah", "Zaleha", "Norhayati", "Aisyah", "Rohana", "Suriani", "Mariam", "Halimah", "Ruzita", "Wan Azizah", "Noraini", "Salmah"];
const CHINESE_M = ["Tan Wei Ming", "Lim Chee Keong", "Ong Kah Hoe", "Lee Boon Siew", "Chong Wai Kit", "Yap Teck Seng", "Goh Beng Huat", "Cheong Kok Leong", "Foo Chee Hong", "Low Ah Kow"];
const CHINESE_F = ["Wong Mei Ling", "Chan Sook Yee", "Teoh Hui Chin", "Ng Li Fang", "Khoo Siew Lan", "Yeoh Poh Choo", "Lau Bee Hoon"];
const INDIAN_M = ["Rajesh Kumar", "Suresh Naidu", "Ganesan Muthu", "Arumugam Selvam", "Krishnan Pillai", "Muniandy Raju", "Balakrishnan Nair"];
const INDIAN_F = ["Kavitha Devi", "Shanti Rajan", "Malathi Krishnan", "Letchumi Amma", "Saraswathy Devi"];
const OTHER_M = ["Jelani Anak Empaling", "Gilbert Majin", "Sylvester Anak Dundang"];
const OTHER_F = ["Dayang Norsiah", "Melissa Anak Nyaring"];

const SURNAMES_BIN = ["bin Abdullah", "bin Hassan", "bin Ismail", "bin Yusof", "bin Rahman"];
const SURNAMES_BINTI = ["binti Osman", "binti Ibrahim", "binti Zainal", "binti Salleh"];

function nameFor(sex: "Male" | "Female", ethnic: string): string {
  if (ethnic === "Malay") {
    return sex === "Male"
      ? `${pick(MALAY_M)} ${pick(SURNAMES_BIN)}`
      : `${pick(MALAY_F)} ${pick(SURNAMES_BINTI)}`;
  }
  if (ethnic === "Chinese") return sex === "Male" ? pick(CHINESE_M) : pick(CHINESE_F);
  if (ethnic === "Indian") return sex === "Male" ? pick(INDIAN_M) : pick(INDIAN_F);
  return sex === "Male" ? pick(OTHER_M) : pick(OTHER_F);
}

const ETHNIC_MIX = [
  "Malay", "Malay", "Malay", "Malay", "Chinese", "Chinese", "Chinese",
  "Indian", "Indian", "Iban", "Kadazandusun", "Bidayuh", "Bajau",
];

const STATE_BY_CENTRE: Record<string, string[]> = {
  hpp: ["Pulau Pinang", "Kedah", "Perlis"],
  ikn: ["WP Putrajaya", "WP Kuala Lumpur", "Selangor"],
  hsa: ["Johor", "Melaka", "Negeri Sembilan"],
  hsnzkt: ["Terengganu", "Kelantan", "Pahang"],
  hus: ["Sarawak"],
  qeh1: ["Sabah", "WP Labuan"],
};

function mykadFor(dob: string, sex: "Male" | "Female", state: string): string {
  const y = dob.slice(2, 4), m = dob.slice(5, 7), d = dob.slice(8, 10);
  const codes: Record<string, string> = {
    "Johor": "01", "Kedah": "02", "Kelantan": "03", "Melaka": "04",
    "Negeri Sembilan": "05", "Pahang": "06", "Pulau Pinang": "07", "Perak": "08",
    "Perlis": "09", "Selangor": "10", "Terengganu": "11", "Sabah": "12",
    "Sarawak": "13", "WP Kuala Lumpur": "14", "WP Labuan": "15", "WP Putrajaya": "16",
  };
  const pb = codes[state] ?? "14";
  const tail = int(100, 999);
  const last = sex === "Male" ? [1, 3, 5, 7, 9][int(0, 4)] : [0, 2, 4, 6, 8][int(0, 4)];
  return `${y}${m}${d}-${pb}-${tail}${last}`;
}

/* ---------------- users ---------------- */

const USER_SEEDS: { name: string; role: Role; centreId: string; twoFactor: boolean; status: RegistryUser["status"] }[] = [
  { name: "Dr Sharifah Nadia", role: "admin", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Prof Dr Lim Boon Hock", role: "head", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Zulhilmi Abdul Karim", role: "hod", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Nurul Izzati", role: "clinician", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Marcus Tan", role: "clinician", centreId: "hpp", twoFactor: false, status: "active" },
  { name: "Dr Farah Diana", role: "trainee", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Hafiz Roslan", role: "clinician", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Susan Ong", role: "trainee", centreId: "hpp", twoFactor: true, status: "active" },
  { name: "Dr Ganesh Raman", role: "hod", centreId: "ikn", twoFactor: true, status: "active" },
  { name: "Dr Aina Sofea", role: "clinician", centreId: "ikn", twoFactor: true, status: "active" },
  { name: "Dr Wong Kar Wai", role: "trainee", centreId: "ikn", twoFactor: false, status: "invited" },
  { name: "Dr Vijay Anand", role: "clinician", centreId: "ikn", twoFactor: true, status: "active" },
  { name: "Dr Mohd Syafiq", role: "hod", centreId: "hsnzkt", twoFactor: true, status: "active" },
  { name: "Dr Nabilah Roslan", role: "clinician", centreId: "hsnzkt", twoFactor: true, status: "active" },
  { name: "Dr Cheah Ming Yang", role: "hod", centreId: "hsa", twoFactor: true, status: "active" },
  { name: "Dr Priya Subramaniam", role: "clinician", centreId: "hsa", twoFactor: true, status: "active" },
  { name: "Dr Jeffrey Anak Lasah", role: "hod", centreId: "qeh1", twoFactor: true, status: "active" },
  { name: "Dr Norliza Awang", role: "clinician", centreId: "qeh1", twoFactor: false, status: "suspended" },
  { name: "Dr Bong Chin Hui", role: "hod", centreId: "hus", twoFactor: true, status: "active" },
  { name: "Dr Amirah Zainuddin", role: "clinician", centreId: "hus", twoFactor: true, status: "active" },
  { name: "Dr Research Fellow", role: "researcher", centreId: "hpp", twoFactor: true, status: "active" },
];

function emailFor(name: string, centreId: string) {
  const slug = name.toLowerCase()
    .replace(/^(dr|prof dr|prof)\s+/, "")
    .replace(/[^a-z\s]/g, "").trim().split(/\s+/).slice(0, 2).join(".");
  return `${slug}@${centreId}.mugis.org.my`;
}

export function seedUsers(): RegistryUser[] {
  return USER_SEEDS.map((u, i) => ({
    id: `u${String(i + 1).padStart(3, "0")}`,
    name: u.name,
    email: emailFor(u.name, u.centreId),
    role: u.role,
    centreId: u.centreId,
    status: u.status,
    twoFactor: u.twoFactor,
    lastActive: daysAgo(int(0, 21)),
  }));
}

/* ---------------- episode data ---------------- */

function episodeData(dobDaysAgo: number, users: RegistryUser[], centreId: string): EpisodeData {
  const centre = CENTRES.find((c) => c.id === centreId)!;
  const dxDays = int(60, 900);
  const surgDays = dxDays - int(20, 90);
  const hasSurgery = chance(0.82);
  const neoadj = chance(0.45);
  const nodeHarv = hasSurgery ? int(12, 42) : 0;
  const nodePos = hasSurgery ? (chance(0.42) ? 0 : int(1, Math.min(nodeHarv, 22))) : 0;
  const met = chance(0.22);
  const t = pick(["T1a", "T1b", "T2", "T3", "T3", "T4a", "T4a", "T4b"]);
  const died = chance(0.24);
  const recur = !died && chance(0.2);

  const d: EpisodeData = {
    referredCentre: pick(["Klinik Kesihatan " + centre.state, "Hospital Daerah", "Private referral", centre.name]),
    yourCentre: centre.name,
    firstDateReferred: dateAgo(dxDays + int(5, 40)),
    dateFirstSeen: dateAgo(dxDays + int(0, 10)),

    cciMi: chance(0.12) ? "Yes" : "No",
    cciChf: chance(0.08) ? "Yes" : "No",
    cciPvd: chance(0.07) ? "Yes" : "No",
    cciCva: chance(0.09) ? "Yes" : "No",
    cciDementia: chance(0.04) ? "Yes" : "No",
    cciCopd: chance(0.14) ? "Yes" : "No",
    cciCtd: chance(0.05) ? "Yes" : "No",
    cciPud: chance(0.18) ? "Yes" : "No",
    cciLiver: pick(["None", "None", "None", "Mild", "Moderate to severe"]),
    cciDm: pick(["None/diet control", "None/diet control", "Uncomplicated", "Uncomplicated", "End-organ damage"]),
    cciHemiplegia: chance(0.03) ? "Yes" : "No",
    cciCkd: pick(["No", "No", "No", "Moderate, creatinine ≥270umol/L", "Severe, dialysis/transplant/uraemia"]),
    cciSolidTumour: met ? "Metastatic" : "Localised",
    cciLeukaemia: "No",
    cciLymphoma: "No",
    cciAids: "No",

    comorbidOthers: chance(0.3) ? pick(["Hypertension", "Dyslipidaemia", "Gout", "Asthma"]) : "",
    smoker: pick(["No", "No", "Yes", "Yes", "Unknown"]),
    ecog: pick(["0", "0", "1", "1", "1", "2", "3"]),
    asa: pick(["1", "2", "2", "3", "3", "4"]),

    sga: pick(["A", "A", "B", "B", "C"]),
    height: int(148, 180),
    weight: int(38, 88),

    firstPresentation: pick(["Abdominal Mass", "Anaemia", "Dysphagia", "Early Satiety",
      "Epigastric Pain", "Epigastric Pain", "Haematemesis", "Melaena",
      "Persistent Vomiting", "Constitutional Symptoms", "Incidental"]),
    dateDiagnosis: dateAgo(dxDays),
    diagnosticModality: pick(["OGDS", "OGDS", "OGDS", "EUS"]),
    ogdsHpeNo: `HPE/${2024 + int(0, 2)}/${int(1000, 9999)}`,
    hpe1: pick(["Adenocarcinoma", "Adenocarcinoma", "Adenocarcinoma", "Poorly cohesive carcinoma",
      "Neuroendocrine tumour", "Inconclusive"]),
    tumourLocation: pick(["Cardio-oesophageal Junction", "Proximal third", "Middle Third",
      "Distal Third", "Distal Third", "Diffuse"]),
    borrmann: pick(["I – Polypoidal", "II – Fungating", "III – Ulcerating", "III – Ulcerating", "IV - Diffuse"]),
    cloUrease: pick(["Negative", "Positive", "Positive", "Not done"]),
    cT: t,
    cN: pick(["N0", "N1", "N1", "N2", "N3"]),
    cM: met ? "M1" : "M0",
    radiologyModality: pick(["CT", "CT", "CT", "MRI", "PET"]),
    lapStaging: chance(0.35) ? "Yes" : "No",

    neoadjChemo: neoadj ? "Yes" : "No",
    neoadjRegime: neoadj ? pick(["FLOT", "FLOT", "FOLFOX/XELOX", "ECF/DCF"]) : "",
    neoadjCycles: neoadj ? int(2, 8) : null,
    neoadjDoseReduction: neoadj ? (chance(0.3) ? "Yes" : "No") : "",
    neoadjDoseDetails: "",
    neoadjComplete: neoadj ? (chance(0.75) ? "Yes" : "No") : "",

    dateSurgery: hasSurgery ? dateAgo(surgDays) : "",
    surgery: hasSurgery
      ? pick(["Subtotal Gastrectomy", "Subtotal Gastrectomy", "Total Gastrectomy", "Proximal Gastrectomy"])
      : "No Surgery",
    additionalOrgan: hasSurgery ? (chance(0.18) ? "Yes" : "No") : "",
    method: hasSurgery ? pick(["Open", "Open", "Laparoscopic", "Laparoscopic", "Robotic"]) : "",
    conversionOpen: hasSurgery ? (chance(0.12) ? "Yes" : "No") : "",
    lnDissection: hasSurgery ? pick(["D1", "D1-plus", "D2", "D2", "D2"]) : "Nil",
    opIntention: met ? "Palliative" : "Curative",
    opTime: hasSurgery ? int(150, 420) : null,
    ebl: hasSurgery ? int(50, 900) : null,
    dateDischarge: hasSurgery ? dateAgo(surgDays - int(5, 21)) : "",
    cd30: hasSurgery ? pick(["Nil", "Nil", "Nil", "I", "II", "II", "IIIA", "IIIB", "V"]) : "",
    complications30: "",

    surgHpeNo: hasSurgery ? `SHPE/${2024 + int(0, 2)}/${int(1000, 9999)}` : "",
    dateHpeSurg: hasSurgery ? dateAgo(surgDays - int(3, 14)) : "",
    mandard: neoadj && hasSurgery ? pick(["1", "2", "3", "3", "4", "5"]) : "Not applicable",
    specLocation: pick(["Cardio-oesophageal Junction", "Proximal Third", "Middle Third", "Distal Third", "Diffuse"]),
    maxSize: hasSurgery ? int(8, 110) : null,
    specType: pick(["Adenocarcinoma", "Adenocarcinoma", "Adenocarcinoma", "Poorly cohesive carcinoma", "MANEC"]),
    differentiation: pick(["Well", "Moderate", "Moderate", "Poor", "Poor"]),
    lauren: pick(["Intestinal", "Intestinal", "Diffuse"]),
    nodeHarvested: hasSurgery ? nodeHarv : null,
    nodePositive: hasSurgery ? nodePos : null,
    proximalMargin: hasSurgery ? (chance(0.9) ? "Negative" : "Positive") : "",
    distalMargin: hasSurgery ? (chance(0.92) ? "Negative" : "Positive") : "",
    circMargin: hasSurgery ? (chance(0.85) ? "Negative" : "Positive") : "",
    chronicGastritis: pick(["Yes", "Yes", "No", "Unknown"]),
    intestinalMetaplasia: pick(["Yes", "No", "No", "Unknown"]),
    gastricAtrophy: pick(["Yes", "No", "Unknown"]),
    hPylori: pick(["Yes", "No", "No", "Unknown"]),
    lvi: pick(["Yes", "Yes", "No", "Unknown"]),
    pni: pick(["Yes", "No", "No", "Unknown"]),

    metastaticSite: met
      ? pick(["Liver", "Peritoneum", "Peritoneum", "Lung", "Non-regional Lymph Nodes", "More than one site"])
      : "Nil",
    metastaticSpecify: "",
    pT: t,

    adjuvant: chance(0.6) ? "Yes" : "No",
    adjRegime: pick(["FOLFOX", "Capecitabine", "Paclitaxel", "Nil"]),
    adjCycles: int(2, 12),
    adjIntention: met ? "Palliative" : "Curative",
    adjDoseReduction: pick(["No", "No", "Yes", "Not done"]),

    recurrence: recur ? "Yes" : "No",
    recurrenceDate: recur ? dateAgo(int(30, 200)) : "",
    death: died ? "Yes" : "No",
    deathDate: died ? dateAgo(int(10, 300)) : "",
    causeOfDeath: died ? pick(["Cancer Related", "Cancer Related", "Not Cancer Related", "Unknown"]) : "",
    lastSeen: dateAgo(int(5, 120)),
    remarks: chance(0.25) ? pick([
      "Discussed at MDT; proceeded with curative intent.",
      "Poor nutritional status at presentation, referred to dietitian.",
      "Family declined further chemotherapy.",
      "Referred for palliative care input.",
    ]) : "",
  };

  // Leave some records genuinely incomplete — this is what the completeness
  // indicator is for, and it mirrors real registry behaviour.
  if (chance(0.3)) {
    for (const k of ["surgHpeNo", "dateHpeSurg", "lvi", "pni", "adjCycles"]) d[k] = "";
  }
  if (chance(0.15)) {
    for (const k of ["nodeHarvested", "nodePositive", "maxSize", "differentiation"]) d[k] = null;
  }
  void dobDaysAgo; void users;
  return d;
}

/* ---------------- build the world ---------------- */

export function buildSeed() {
  const users = seedUsers();
  const patients: Patient[] = [];
  const episodes: Episode[] = [];
  const audit: AuditEntry[] = [];

  const enterers = users.filter((u) => ["clinician", "trainee", "hod"].includes(u.role));
  let seq = 1;

  for (const centre of CENTRES) {
    const centreUsers = enterers.filter((u) => u.centreId === centre.id);
    if (centreUsers.length === 0) continue;
    const count = centre.id === "hpp" ? 90 : centre.id === "ikn" ? 60 : int(30, 40);

    for (let i = 0; i < count; i++) {
      const sex: "Male" | "Female" = chance(0.63) ? "Male" : "Female";
      const ethnic = pick(ETHNIC_MIX);
      const state = pick(STATE_BY_CENTRE[centre.id] ?? ["Selangor"]);
      const ageDays = int(38, 84) * 365 + int(0, 364);
      const dob = dateAgo(ageDays);
      // Round-robin, not random — every clinician and trainee gets a full caseload.
      const owner = centreUsers[i % centreUsers.length];
      const created = daysAgo(int(1, 700));

      const p: Patient = {
        id: `p${String(seq).padStart(4, "0")}`,
        registryNo: `MUG-${centre.code}-${String(seq).padStart(4, "0")}`,
        fullName: nameFor(sex, ethnic),
        mykad: mykadFor(dob, sex, state),
        passport: "",
        dob,
        sex,
        ethnic,
        state,
        centreId: centre.id,
        createdBy: owner.email,
        createdAt: created,
        updatedAt: created,
      };
      patients.push(p);

      const data = episodeData(ageDays, users, centre.id);
      const ep: Episode = {
        id: `e${String(seq).padStart(4, "0")}`,
        patientId: p.id,
        cancerType: "gastric-adeno",
        centreId: centre.id,
        status: data.death === "Yes" ? "closed" : chance(0.12) ? "draft" : "active",
        createdBy: owner.email,
        createdAt: created,
        updatedAt: daysAgo(int(0, 90)),
        data,
      };
      episodes.push(ep);

      audit.push({
        id: `a${String(audit.length + 1).padStart(5, "0")}`,
        at: created,
        userEmail: owner.email,
        userRole: owner.role,
        centreId: centre.id,
        action: "create",
        entity: "patient",
        entityId: p.id,
        entityLabel: `${p.registryNo} — ${p.fullName}`,
      });
      audit.push({
        id: `a${String(audit.length + 1).padStart(5, "0")}`,
        at: ep.updatedAt,
        userEmail: owner.email,
        userRole: owner.role,
        centreId: centre.id,
        action: "update",
        entity: "episode",
        entityId: ep.id,
        entityLabel: `${p.registryNo} — Gastric Adenocarcinoma`,
        changes: [{ field: "Follow up · Last seen", from: "—", to: String(data.lastSeen ?? "") }],
      });
      seq++;
    }
  }

  // a few system-level audit entries so the log doesn't look synthetic
  const admin = users.find((u) => u.role === "admin")!;
  const head = users.find((u) => u.role === "head")!;
  const researcher = users.find((u) => u.role === "researcher")!;
  audit.push(
    { id: "a90001", at: daysAgo(2), userEmail: researcher.email, userRole: "researcher",
      centreId: researcher.centreId, action: "export", entity: "system", entityId: "-",
      entityLabel: "De-identified dataset export (CSV, 87 records)" },
    { id: "a90002", at: daysAgo(5), userEmail: admin.email, userRole: "admin",
      centreId: admin.centreId, action: "update", entity: "user", entityId: "u015",
      entityLabel: "Dr Norliza Awang", changes: [{ field: "Status", from: "active", to: "suspended" }] },
    { id: "a90003", at: daysAgo(9), userEmail: head.email, userRole: "head",
      centreId: head.centreId, action: "view", entity: "system", entityId: "-",
      entityLabel: "Nationwide report — operative volume by centre" },
  );

  audit.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { users, patients, episodes, audit };
}
