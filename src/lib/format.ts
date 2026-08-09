export function fmtDate(v?: string | number | null): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** "3 days ago" style, relative to a fixed reference passed in. */
export function relTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function ageFrom(dob: string, at?: string): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const ref = at ? new Date(at) : new Date("2026-08-08");
  let a = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) a--;
  return a < 0 ? null : a;
}

export function maskMykad(mykad: string, reveal: boolean): string {
  if (!mykad) return "—";
  if (reveal) return mykad;
  const parts = mykad.split("-");
  if (parts.length !== 3) return "•••••• – •• – ••••";
  return `${parts[0]}-${parts[1]}-••••`;
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

/** Deterministic hash — stands in for the hashed-identifier duplicate check. */
export function hashId(v: string): string {
  let h = 5381;
  for (let i = 0; i < v.length; i++) h = ((h << 5) + h + v.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 8).toUpperCase();
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initials(name: string): string {
  return name
    .replace(/^(Dr|Prof Dr|Prof|Mr|Ms|Mrs)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** "79y · Male", "79y", "Male", or "" — never "nully" when demography is blank. */
export function ageSex(dob: string, sex: string): string {
  const a = ageFrom(dob);
  const parts: string[] = [];
  if (a !== null) parts.push(`${a}y`);
  if (sex) parts.push(sex);
  return parts.join(" · ");
}
