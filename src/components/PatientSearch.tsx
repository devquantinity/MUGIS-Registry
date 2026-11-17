"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText, type Patient } from "@/lib/api";
import { CLINICAL, useSession } from "@/lib/session";

/**
 * ⌘K search over the patients the caller can see (GET /patients?q=), by
 * name or registry number. ↑/↓ to move, ↵ to open.
 */
export default function PatientSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { session } = useSession();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Patient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const clinical = !!session && CLINICAL.includes(session.role);

  useEffect(() => {
    if (!open) return;
    setQ(""); setItems([]); setSel(0); setError(null);
    window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || !clinical || !q.trim()) { setItems([]); return; }
    let alive = true;
    setBusy(true);
    const t = window.setTimeout(() => {
      api.patients({ q: q.trim(), page_size: 8 })
        .then((r) => { if (alive) { setItems(r.items); setSel(0); setError(null); } })
        .catch((e) => { if (alive) setError(errorText(e)); })
        .finally(() => { if (alive) setBusy(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q, open, clinical]);

  if (!open || typeof document === "undefined") return null;

  function go(p: Patient) {
    onClose();
    router.push(`/patients/${p.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && items[sel]) { e.preventDefault(); go(items[sel]); }
    else if (e.key === "Escape") onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-raised dark:border-white/[0.08] dark:bg-paper">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          disabled={!clinical}
          placeholder={clinical ? "Search by registry number, or name/IC for your own or shared patients…" : "Patient search is for clinical roles"}
          className="w-full border-b border-ink/[0.06] bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-soot/60"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((p, i) => (
            <li key={p.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(p)}
                className={"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left " +
                  (i === sel ? "bg-forest-50 text-forest-700" : "text-ink hover:bg-ink/[0.04]")}
              >
                <span className="min-w-0 truncate text-[14.5px] font-medium">{p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}</span>
                <span className="shrink-0 font-mono text-[12.5px] text-soot/75">{p.registry_no}</span>
              </button>
            </li>
          ))}
          {clinical && q.trim() && !busy && items.length === 0 && !error && (
            <li className="px-3 py-6 text-center text-sm text-soot/70">No patients you can see match “{q.trim()}”.</li>
          )}
          {error && <li className="px-3 py-3 text-sm text-danger-700">{error}</li>}
          {clinical && !q.trim() && <li className="px-3 py-4 text-center text-[13px] text-soot/65">Type a name or registry number.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
