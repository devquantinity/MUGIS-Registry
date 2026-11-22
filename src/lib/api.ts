/**
 * Client for the MUGIS backend (mugis-backend). Every call goes through
 * `request`, which:
 *
 *  - unwraps the standard envelope — success is `{ data }`, failure is
 *    `{ error_code, message, reason }` and becomes an ApiError;
 *  - sends the access token, and on a 401 `unauthorized` refreshes once
 *    (single-flight) and retries — never on a timer, so the backend's idle
 *    timeout can fire;
 *  - tells the session layer when the session is over, via `onSessionEnded`.
 *
 * The base URL comes from NEXT_PUBLIC_API_BASE_URL (.env / .env.staging).
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

// ─── Types — mirror the backend DTOs (openapi.json) ──────────────────────────

export type ApiRole = "SYSTEM_ADMIN" | "HEAD_OF_SERVICE" | "HOD" | "CONSULTANT" | "FELLOW";
export const CLINICAL_ROLES: ApiRole[] = ["HEAD_OF_SERVICE", "HOD", "CONSULTANT", "FELLOW"];

export const API_ROLE_LABELS: Record<ApiRole, string> = {
  SYSTEM_ADMIN: "System Admin",
  HEAD_OF_SERVICE: "Head of Service",
  HOD: "Head of Department",
  CONSULTANT: "Consultant",
  FELLOW: "Fellow / Medical Officer",
};

export type UserStatus = "invited" | "pending_approval" | "approved" | "active" | "rejected" | "suspended";

export type CentreRef = { id: string; code: string; name: string; is_primary: boolean };

export type Centre = {
  id: string; code: string; name: string; state?: string;
  is_active: boolean; created_at: string; updated_at: string;
};

export type RoleInfo = { name: ApiRole; description: string; rank: number; self_register: boolean };

export type Me = {
  id: string; email: string; display_name?: string; full_name?: string; phone?: string;
  id_type?: "mykad" | "passport"; id_number_masked?: string;
  role: ApiRole; status: UserStatus; two_factor_enabled: boolean;
  supervisor_id?: string; centres: CentreRef[]; active_centre_id: string | null;
  last_sign_in_at?: string; last_active_at?: string; created_at: string; updated_at: string;
};

export type TokenResponse = {
  access_token: string; refresh_token: string; token_type: "Bearer"; expires_in: number;
  user: Me; two_factor_setup_required: boolean;
};

export type LoginResponse = Partial<TokenResponse> & {
  two_factor_required: boolean; challenge_token?: string; challenge_expires_in?: number;
};

export type TwoFactorSetup = { secret: string; otpauth_uri: string; issuer: string; account: string };

export type Page = { page: number; page_size: number; total: number };

export type AdminUser = {
  id: string; email: string; full_name?: string; display_name?: string; phone?: string;
  role: ApiRole; status: UserStatus; two_factor_enabled: boolean;
  primary_centre?: CentreRef; centres?: CentreRef[]; supervisor_id?: string;
  last_active_at?: string; created_at: string;
};

export type Registration = {
  id: string; email: string; full_name?: string; phone?: string;
  id_type?: "mykad" | "passport"; id_number?: string; role: ApiRole;
  status: "pending_approval" | "approved" | "rejected"; centre?: CentreRef;
  supervisor_id?: string; reviewed_at?: string; rejection_reason?: string; created_at: string;
};

export type StaffSummary = { id: string; full_name?: string; email: string };

export type Preview = { email: string; full_name?: string; role: ApiRole; centre?: CentreRef };

// ─── Patients ────────────────────────────────────────────────────────────────

export const SEX_VALUES = ["Female", "Male"] as const;
export const ETHNIC_VALUES = ["Bajau", "Bidayuh", "Chinese", "Dayak", "Iban", "Indian", "Kadazan", "Kadazandusun",
  "Malay", "Melanau", "Murut", "Orang Asli", "Orang Sungai", "Rungus", "Others/Foreigner"] as const;
export const STATE_VALUES = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis",
  "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "WP Kuala Lumpur", "WP Putrajaya", "WP Labuan"] as const;

export type PatientAccess = "owner" | "granted_edit" | "granted_view" | "scope";

/**
 * Personal data (name, identity number, date of birth, ethnicity, state) is
 * null unless `full_access`: the caller added the patient or was given access.
 * Everyone else who sees the patient gets age, sex and the cancer records.
 */
export type Patient = {
  id: string; registry_no: string; centre: { id: string; code: string; name: string }; owner_id: string;
  full_access: boolean; age_years: number | null;
  full_name: string | null; id_type: "mykad" | "passport" | null; id_number?: string | null; id_number_masked?: string | null;
  date_of_birth?: string | null; sex?: string; ethnic?: string | null; state?: string | null;
  access: PatientAccess; can_edit: boolean; created_at: string; updated_at: string;
  /** Cancer episodes with progress (no answers). */
  episodes: EpisodeSummary[];
  /** The most cancer records a patient may hold (registry setting); no new one at this count. */
  cancer_record_limit: number;
};

export type RegistrySettings = { max_cancer_records_per_patient: number; updated_at: string };

export type PatientInput = {
  full_name?: string; id_type?: "mykad" | "passport"; id_number?: string; date_of_birth?: string;
  sex?: string; ethnic?: string; state?: string; centre_id?: string;
};

/** `exists`: someone else's patient — nothing else is revealed; request access by identity number. */
export type PatientLookup = { status: "none" | "visible" | "exists"; patient_id?: string; registry_no?: string };

export type AccessRequest = {
  /** Absent for your own request until you have full access (a request by identity number never names the record). */
  id: string; patient_id?: string; registry_no?: string; patient_name?: string;
  requester: { id: string; full_name?: string; email: string; role: ApiRole };
  permission: "view" | "edit"; status: "pending" | "approved" | "denied" | "revoked";
  reason?: string; decided_at?: string; decision_note?: string; created_at: string;
};

// ─── Cancer episodes ─────────────────────────────────────────────────────────
//
// A form is a JSON document per cancer type, versioned by the backend. Field
// keys and option values never change; fields and options are retired, not
// removed. See src/lib/episodeForm.ts for the rules the screens apply.

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "multiselect";
export type FormOption = { value: string; label: string; retired?: boolean };
export type ShowIf = { field: string; in?: string[]; not_in?: string[] };
export type FormField = {
  key: string; label: string; type: FieldType; help?: string; unit?: string;
  options?: FormOption[]; min?: number; max?: number; integer?: boolean; max_length?: number;
  show_if?: ShowIf; retired?: boolean;
};
export type FormSection = { key: string; label: string; help?: string; retired?: boolean; fields: FormField[] };
export type FormDefinition = { sections: FormSection[] };

export type CancerType = { code: string; name: string; form_version: number };

// dashboard — counts over the patients the caller can see (row-level security)
export type DashboardGroupBy = "centre" | "individual";
export type SurgicalApproach = { open: number; laparoscopic: number; robotic: number; no_surgery: number; not_recorded: number };
export type DashboardFigures = {
  patients: number;
  cancer_records: number;
  /** Mean form completion, 0–100; null with no records. */
  average_completeness: number | null;
  surgical_approach: SurgicalApproach;
};
/** A centre (sub = its code) or the doctor who added the patients (sub = role). */
export type DashboardGroup = DashboardFigures & { id: string; label: string; sub: string };
export type DashboardOverview = { group_by: DashboardGroupBy; totals: DashboardFigures; groups: DashboardGroup[]; generated_at: string };
export type NewDiagnoses = {
  group_by: DashboardGroupBy;
  cancer_type: string | null;
  /** "YYYY-MM", oldest first. */
  months: string[];
  counts: number[];
  total: number;
  /** Records with no date of diagnosis yet. */
  undated: number;
  groups: { id: string; label: string; sub: string; counts: number[]; total: number }[];
};
export type CancerForm = { code: string; name: string; version: number; created_at: string; form: FormDefinition };

export type Answer = string | number | string[];
export type Answers = Record<string, Answer>;

export type SectionProgress = { key: string; filled: number; total: number };
export type EpisodeProgress = { filled: number; total: number; percent: number; sections: SectionProgress[] };

export type EpisodeSummary = {
  id: string; patient_id: string; cancer_type: string; cancer_type_name: string;
  /** The live form the progress was measured against. */
  form_version: number; progress: EpisodeProgress; created_at: string; updated_at: string;
  /** You added this patient, so you may remove the record. */
  can_remove: boolean;
};

export type Episode = EpisodeSummary & {
  data: Answers; can_edit: boolean; created_by: string; updated_by: string;
  /** Answers the last save removed (hidden by a condition, or not on a new type's form). */
  dropped?: string[];
};

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, public reason: string, message: string) {
    super(message);
  }
}

let dictionary: Record<string, string> | null = null;
let dictionaryLoad: Promise<void> | null = null;

/** Loads reason → display message once (GET /error-dictionary). */
export function loadErrorDictionary(): Promise<void> {
  if (dictionary) return Promise.resolve();
  dictionaryLoad ??= fetch(`${API_BASE}/api/v1/error-dictionary`)
    .then((r) => r.json())
    .then((env: { data?: { dictionary: { reason: string; display_message: string }[] } }) => {
      dictionary = Object.fromEntries((env.data?.dictionary ?? []).map((e) => [e.reason, e.display_message]));
    })
    .catch(() => { dictionaryLoad = null; });
  return dictionaryLoad;
}

/** The text to show for an error: the dictionary's message, else the server's. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) return dictionary?.[err.reason] ?? err.message;
  if (err instanceof TypeError) return "Cannot reach the registry server. Check your connection and try again.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

// ─── Tokens ──────────────────────────────────────────────────────────────────
//
// Kept in sessionStorage: survives a reload, gone when the tab closes, and
// never sent anywhere but the API. The access token lasts 15 minutes.

type Tokens = { access: string; refresh: string };
const TOKEN_KEY = "mugis.tokens.v1";

let tokens: Tokens | null = null;

function readTokens(): Tokens | null {
  if (tokens) return tokens;
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    tokens = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

export function hasTokens(): boolean {
  return readTokens() !== null;
}

export function setTokens(t: Tokens | null) {
  tokens = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — tokens stay in memory for this page */
  }
}

/** Replace only the access token (after switch-centre). */
export function setAccessToken(access: string) {
  const cur = readTokens();
  if (cur) setTokens({ ...cur, access });
}

/** Claims of the current access token, unverified — for display only. */
export function accessClaims(): Record<string, unknown> | null {
  const t = readTokens();
  if (!t) return null;
  try {
    const part = t.access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

let sessionEnded: (reason: string) => void = () => {};
/** The session layer registers here to hear when sign-in is needed again. */
export function onSessionEnded(fn: (reason: string) => void) {
  sessionEnded = fn;
}

let refreshing: Promise<boolean> | null = null;

/** Refresh once for any number of concurrent 401s. */
function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const cur = readTokens();
    if (!cur) return false;
    try {
      const res = await rawRequest<TokenResponse>("POST", "/auth/refresh", { refresh_token: cur.refresh }, null);
      setTokens({ access: res.access_token, refresh: res.refresh_token });
      return true;
    } catch (e) {
      setTokens(null);
      sessionEnded(e instanceof ApiError ? e.reason : "unauthorized");
      return false;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// ─── Requests ────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function rawRequest<T>(method: Method, path: string, body: unknown, access: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });

  let env: { data?: T; error_code?: number; message?: string; reason?: string } = {};
  try {
    env = await res.json();
  } catch {
    /* non-JSON (proxy error page) — handled below */
  }
  if (!res.ok) {
    throw new ApiError(res.status, env.reason ?? "internal_error", env.message ?? `HTTP ${res.status}`);
  }
  return env.data as T;
}

/** An authenticated request, with one refresh-and-retry on an expired token. */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const t = readTokens();
  try {
    return await rawRequest<T>(method, path, body, t?.access ?? null);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && e.reason === "unauthorized" && t) {
      if (await refreshTokens()) return rawRequest<T>(method, path, body, readTokens()?.access ?? null);
    }
    throw e;
  }
}

/** A public request — no token, no refresh. */
export function publicRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  return rawRequest<T>(method, path, body, null);
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const api = {
  // public catalogues
  centres: () => publicRequest<Centre[]>("GET", "/centres"),
  roles: () => publicRequest<RoleInfo[]>("GET", "/roles"),

  // sign-in
  login: (email: string, password: string) =>
    publicRequest<LoginResponse>("POST", "/auth/login", { email, password }),
  verify2fa: (challenge_token: string, code: string) =>
    publicRequest<TokenResponse>("POST", "/auth/login/verify-2fa", { challenge_token, code }),
  refresh: () => refreshTokens(),

  // registration & links
  register: (body: {
    email: string; password: string; full_name: string; phone: string;
    id_type: "mykad" | "passport"; id_number: string; centre_id: string; role: ApiRole;
  }) => publicRequest<{ message: string }>("POST", "/auth/register", body),
  previewActivation: (token: string) => publicRequest<Preview>("GET", `/auth/activate${qs({ token })}`),
  activate: (token: string) => publicRequest<{ message: string }>("POST", "/auth/activate", { token }),
  resendActivation: (email: string) => publicRequest<{ message: string }>("POST", "/auth/resend-activation", { email }),
  previewInvitation: (token: string) => publicRequest<Preview>("GET", `/auth/invitation${qs({ token })}`),
  acceptInvitation: (token: string, password: string, full_name?: string) =>
    publicRequest<TokenResponse>("POST", "/auth/accept-invitation", { token, password, full_name }),
  forgotPassword: (email: string) => publicRequest<{ message: string }>("POST", "/auth/forgot-password", { email }),
  checkResetToken: (token: string) => publicRequest<{ message: string }>("GET", `/auth/reset-password${qs({ token })}`),
  resetPassword: (token: string, new_password: string) =>
    publicRequest<{ message: string }>("POST", "/auth/reset-password", { token, new_password }),

  // session
  me: () => request<Me>("GET", "/auth/me"),
  updateMe: (body: { display_name?: string; full_name?: string; phone?: string }) => request<Me>("PATCH", "/auth/me", body),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>("POST", "/auth/change-password", { current_password, new_password }),
  logout: () => {
    const t = readTokens();
    return t ? request<{ message: string }>("POST", "/auth/logout", { refresh_token: t.refresh }) : Promise.resolve(null);
  },
  switchCentre: (centre_id: string) =>
    request<{ access_token: string; active_centre_id: string }>("POST", "/auth/switch-centre", { centre_id }),
  setup2fa: () => request<TwoFactorSetup>("POST", "/auth/2fa/setup"),
  enable2fa: (code: string) => request<{ message: string }>("POST", "/auth/2fa/enable", { code }),

  // reviewers
  registrations: (q: { status?: string; centre_id?: string; q?: string; page?: number; page_size?: number }) =>
    request<{ items: Registration[]; page: Page }>("GET", `/registrations${qs(q)}`),
  approveRegistration: (id: string, supervisor_id?: string) =>
    request<Registration>("POST", `/registrations/${id}/approve`, supervisor_id ? { supervisor_id } : {}),
  rejectRegistration: (id: string, reason?: string) =>
    request<Registration>("POST", `/registrations/${id}/reject`, reason ? { reason } : {}),
  consultants: (centreId: string) => request<StaffSummary[]>("GET", `/centres/${centreId}/consultants`),

  // patients — clinical roles; the database decides what each caller sees
  patients: (q: { q?: string; centre_id?: string; page?: number; page_size?: number }) =>
    request<{ items: Patient[]; page: Page }>("GET", `/patients${qs(q)}`),
  patient: (id: string) => request<Patient>("GET", `/patients/${id}`),
  createPatient: (body: PatientInput) => request<Patient>("POST", "/patients", body),
  updatePatient: (id: string, body: PatientInput) => request<Patient>("PATCH", `/patients/${id}`, body),
  lookupPatient: (id_type: "mykad" | "passport", id_number: string) =>
    request<PatientLookup>("POST", "/patients/lookup", { id_type, id_number }),
  requestPatientAccess: (id: string, permission: "view" | "edit", reason?: string) =>
    request<AccessRequest>("POST", `/patients/${id}/access-requests`, { permission, reason: reason || undefined }),
  requestAccessByIdentity: (body: { id_type: "mykad" | "passport"; id_number: string; permission: "view" | "edit"; reason?: string }) =>
    request<AccessRequest>("POST", "/patient-access-requests", { ...body, reason: body.reason || undefined }),
  /** Owner (or a departed owner's HOD): who holds or has asked for access. 403 for anyone else. */
  patientAccess: (id: string) => request<{ items: AccessRequest[] }>("GET", `/patients/${id}/access`),
  sharePatientAccess: (id: string, email: string, permission: "view" | "edit") =>
    request<AccessRequest>("POST", `/patients/${id}/access`, { email, permission }),
  revokePatientAccess: (id: string, grantId: string) =>
    request<AccessRequest>("DELETE", `/patients/${id}/access/${grantId}`),
  accessRequests: (q: { box: "incoming" | "outgoing"; status?: string; page?: number; page_size?: number }) =>
    request<{ items: AccessRequest[]; page: Page }>("GET", `/patient-access-requests${qs(q)}`),
  decideAccess: (id: string, approve: boolean, note?: string) =>
    request<AccessRequest>("POST", `/patient-access-requests/${id}/${approve ? "approve" : "deny"}`, note ? { note } : {}),

  // dashboard — clinical roles
  dashboardOverview: (group_by: DashboardGroupBy) =>
    request<DashboardOverview>("GET", `/dashboard/overview${qs({ group_by })}`),
  newDiagnoses: (q: { group_by: DashboardGroupBy; cancer_type?: string; months?: number }) =>
    request<NewDiagnoses>("GET", `/dashboard/new-diagnoses${qs(q)}`),

  // cancer episodes — forms are read by every signed-in role
  cancerTypes: () => request<CancerType[]>("GET", "/cancer-types"),
  cancerForm: (code: string) => request<CancerForm>("GET", `/cancer-types/${encodeURIComponent(code)}/form`),
  patientEpisodes: (patientId: string) => request<EpisodeSummary[]>("GET", `/patients/${patientId}/episodes`),
  createEpisode: (patientId: string, cancer_type: string, data?: Answers) =>
    request<Episode>("POST", `/patients/${patientId}/episodes`, { cancer_type, data }),
  episode: (id: string) => request<Episode>("GET", `/cancer-episodes/${id}`),
  /** Owner of the patient only. */
  removeEpisode: (id: string) => request<{ id: string }>("DELETE", `/cancer-episodes/${id}`),
  /** `data` is merged; a null value clears that answer. */
  updateEpisode: (id: string, body: { cancer_type?: string; data?: Record<string, Answer | null> }) =>
    request<Episode>("PATCH", `/cancer-episodes/${id}`, body),
  /** Registry-wide settings — SYSTEM_ADMIN only. */
  registrySettings: () => request<RegistrySettings>("GET", "/admin/settings"),
  updateRegistrySettings: (body: { max_cancer_records_per_patient?: number }) =>
    request<RegistrySettings>("PATCH", "/admin/settings", body),
  updateCancerForm: (code: string, base_version: number, form: FormDefinition) =>
    request<CancerForm>("PUT", `/admin/cancer-types/${encodeURIComponent(code)}/form`, { base_version, form }),

  // admin — users
  users: (q: { q?: string; status?: string; role?: string; centre_id?: string; page?: number; page_size?: number }) =>
    request<{ items: AdminUser[]; page: Page }>("GET", `/admin/users${qs(q)}`),
  user: (id: string) => request<AdminUser>("GET", `/admin/users/${id}`),
  inviteUser: (body: { email: string; full_name?: string; role: ApiRole; centre_id: string; supervisor_id?: string }) =>
    request<AdminUser>("POST", "/admin/users", body),
  updateUser: (id: string, body: {
    role?: ApiRole; status?: "active" | "suspended"; centre_ids?: string[];
    primary_centre_id?: string; supervisor_id?: string; reset_two_factor?: boolean;
  }) => request<AdminUser>("PATCH", `/admin/users/${id}`, body),
  resendInvitation: (id: string) => request<{ message: string }>("POST", `/admin/users/${id}/resend-invitation`),

  // admin — centres
  adminCentres: () => request<Centre[]>("GET", "/admin/centres"),
  createCentre: (body: { code: string; name: string; state?: string }) => request<Centre>("POST", "/admin/centres", body),
  updateCentre: (id: string, body: { code?: string; name?: string; state?: string; is_active?: boolean }) =>
    request<Centre>("PATCH", `/admin/centres/${id}`, body),
};
