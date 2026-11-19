/**
 * Checks for the public registration form. They follow the server's rules
 * (mugis-backend internal/service/identity.go and the RegisterRequest
 * binding) so most mistakes are caught before sending; the server still
 * checks everything, and its refusals are mapped back onto the fields here.
 */
import { isValidMykad, mykadProblem } from "@/lib/format";
import { ApiError, errorText } from "@/lib/api";
import { passwordProblems } from "@/components/AuthFrame";

export type RegisterField =
  | "full_name" | "email" | "phone" | "id_type" | "id_number"
  | "centre_id" | "role" | "password" | "confirm";

export type RegisterForm = Record<RegisterField, string>;
export type FieldErrors = Partial<Record<RegisterField, string>>;

// A domain with a dot: "name@gmail" is refused by the server, so refuse it here.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function digitsOnly(s: string) { return s.replace(/[\s\-()+]/g, ""); }

/** What is wrong with each field; empty fields count only when `required`. */
export function validateRegister(f: RegisterForm, required: boolean): FieldErrors {
  const e: FieldErrors = {};
  const need = (k: RegisterField, msg: string) => { if (required && !f[k].trim()) e[k] = msg; };

  need("full_name", "Enter your full name.");
  if (f.full_name.length > 200) e.full_name = "Keep the name to 200 characters or fewer.";

  need("email", "Enter your email address.");
  const email = f.email.trim();
  if (email && (!EMAIL.test(email) || email.length > 254)) e.email = "Enter a full email address, like name@hospital.gov.my.";

  need("phone", "Enter your phone number.");
  const phone = f.phone.trim();
  if (phone) {
    const d = digitsOnly(phone);
    if (!/^\d+$/.test(d)) e.phone = "Use digits only (spaces, dashes and a leading + are fine).";
    else if (d.length < 7 || d.length > 15) e.phone = "A phone number has 7 to 15 digits.";
  }

  need("id_number", f.id_type === "passport" ? "Enter your passport number." : "Enter your MyKad number.");
  const id = f.id_number.trim().replace(/[\s-]/g, "").toUpperCase();
  if (id) {
    if (f.id_type === "mykad" && !isValidMykad(id)) e.id_number = mykadProblem(id) ?? "A MyKad number has 12 digits, e.g. 900101-14-5678.";
    if (f.id_type === "passport" && !/^[A-Z0-9]{5,20}$/.test(id)) e.id_number = "A passport number has 5 to 20 letters and digits.";
  }

  if (required && !f.centre_id) e.centre_id = "Choose your centre.";
  if (required && !f.role) e.role = "Choose your role.";

  if (required && !f.password) e.password = "Choose a password.";
  const weak = f.password ? passwordProblems(f.password) : [];
  if (weak.length) e.password = `Needs ${weak.join(", ")}.`;

  if (required && !f.confirm) e.confirm = "Type the password again.";
  if (f.confirm && f.confirm !== f.password) e.confirm = "The passwords do not match.";
  return e;
}

// The server's binding error names a Go field: "Key: 'RegisterRequest.Email' Error:…'email' tag".
const GO_FIELD: Record<string, RegisterField> = {
  FullName: "full_name", Email: "email", Phone: "phone", IDType: "id_type", IDNumber: "id_number",
  CentreID: "centre_id", Role: "role", Password: "password",
};
const FIELD_HINT: Record<RegisterField, string> = {
  full_name: "Check your full name.",
  email: "Enter a full email address, like name@hospital.gov.my.",
  phone: "Check your phone number.",
  id_type: "Choose MyKad or passport.",
  id_number: "Check your identity number.",
  centre_id: "Choose your centre.",
  role: "Choose one of the roles in the list.",
  password: "Check your password.",
  confirm: "Check your password.",
};

/**
 * Where a refused registration belongs: on a field (with text for it), or as
 * a message for the whole form. Never the server's raw developer text.
 */
export function registerServerError(err: unknown): { field?: RegisterField; text: string } {
  if (!(err instanceof ApiError)) return { text: errorText(err) };
  switch (err.reason) {
    case "email_taken": return { field: "email", text: errorText(err) };
    case "id_number_taken":
    case "invalid_id_number": return { field: "id_number", text: errorText(err) };
    case "invalid_phone": return { field: "phone", text: errorText(err) };
    case "weak_password": return { field: "password", text: errorText(err) };
    case "invalid_centre": return { field: "centre_id", text: errorText(err) };
    case "role_not_found": return { field: "role", text: FIELD_HINT.role };
    case "invalid_request": {
      const m = /'RegisterRequest\.(\w+)'/.exec(err.message);
      const field = m ? GO_FIELD[m[1]] : undefined;
      if (field) return { field, text: FIELD_HINT[field] };
      return { text: "Some details are missing or not in the right format. Please check the form and try again." };
    }
    default: return { text: errorText(err) };
  }
}
