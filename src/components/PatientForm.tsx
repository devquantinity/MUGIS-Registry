"use client";

import { ETHNIC_VALUES, SEX_VALUES, STATE_VALUES } from "@/lib/api";
import { ageFrom, formatMykad, mykadIdentity } from "@/lib/format";
import { DatePicker } from "@/components/DatePicker";
import { Select } from "@/components/Select";

export type PatientFormValue = {
  full_name: string;
  id_type: "mykad" | "passport";
  id_number: string;
  date_of_birth: string;
  sex: string;
  ethnic: string;
  state: string;
};

export const emptyPatient: PatientFormValue = {
  full_name: "", id_type: "mykad", id_number: "", date_of_birth: "", sex: "", ethnic: "", state: "",
};

/** True once the identity number is complete enough to look up. */
export function identityComplete(v: PatientFormValue): boolean {
  const digits = v.id_number.replace(/[\s-]/g, "");
  return v.id_type === "mykad" ? /^\d{12}$/.test(digits) : /^[A-Za-z0-9]{5,20}$/.test(digits);
}

/**
 * The Demography group. Only full name and identity number are required;
 * the rest may be filled in later. A MyKad fills in date of birth and sex
 * (both stay editable).
 */
export default function PatientForm({ value, onChange, lockIdentity }: {
  value: PatientFormValue;
  onChange: (v: PatientFormValue) => void;
  /** Hide the identity fields' auto-fill on edit until the user changes them. */
  lockIdentity?: boolean;
}) {
  const set = <K extends keyof PatientFormValue>(k: K, v: PatientFormValue[K]) => onChange({ ...value, [k]: v });

  function onIdNumber(raw: string) {
    if (value.id_type !== "mykad") return set("id_number", raw.toUpperCase());
    const id_number = formatMykad(raw);
    const { dob, sex } = mykadIdentity(id_number);
    onChange({
      ...value, id_number,
      date_of_birth: lockIdentity ? value.date_of_birth : dob ?? value.date_of_birth,
      sex: lockIdentity ? value.sex : sex ?? value.sex,
    });
  }

  const age = value.date_of_birth ? ageFrom(value.date_of_birth) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Full name <span className="text-danger-600">*</span></label>
        <input className="input" value={value.full_name} onChange={(e) => set("full_name", e.target.value)}
          placeholder="As per identity document" maxLength={200} />
      </div>
      <div>
        <label className="label">Identity document <span className="text-danger-600">*</span></label>
        <Select ariaLabel="Identity document" value={value.id_type}
          onChange={(v) => onChange({ ...value, id_type: v as "mykad" | "passport", id_number: "" })}
          options={[{ value: "mykad", label: "MyKad" }, { value: "passport", label: "Passport" }]} />
      </div>
      <div>
        <label className="label">{value.id_type === "mykad" ? "MyKad number" : "Passport number"} <span className="text-danger-600">*</span></label>
        <input className="input font-mono" value={value.id_number} onChange={(e) => onIdNumber(e.target.value)}
          inputMode={value.id_type === "mykad" ? "numeric" : "text"}
          placeholder={value.id_type === "mykad" ? "000000-00-0000" : "A12345678"} spellCheck={false} />
        {value.id_type === "mykad" && <p className="mt-1 text-[13px] text-soot/72">Date of birth and sex fill in from the number.</p>}
      </div>
      <div>
        <label className="label">Date of birth</label>
        <DatePicker value={value.date_of_birth} max={today} onChange={(iso) => set("date_of_birth", iso)} placeholder="Date of birth" />
        {age !== null && <p className="mt-1 text-[13px] text-soot/75">Age {age}</p>}
      </div>
      <div>
        <label className="label">Sex</label>
        <Select ariaLabel="Sex" value={value.sex} onChange={(v) => set("sex", v)} placeholder="— select —"
          options={SEX_VALUES.map((v) => ({ value: v, label: v }))} />
      </div>
      <div>
        <label className="label">Ethnic</label>
        <Select ariaLabel="Ethnic" value={value.ethnic} onChange={(v) => set("ethnic", v)} placeholder="— select —"
          options={ETHNIC_VALUES.map((v) => ({ value: v, label: v }))} menuWidth={260} />
      </div>
      <div>
        <label className="label">State</label>
        <Select ariaLabel="State" value={value.state} onChange={(v) => set("state", v)} placeholder="— select —"
          options={STATE_VALUES.map((v) => ({ value: v, label: v }))} menuWidth={260} />
      </div>
    </div>
  );
}
