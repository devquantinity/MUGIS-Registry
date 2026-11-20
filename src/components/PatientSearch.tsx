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

  // A phone gets the whole screen (the keyboard takes the bottom half anyway);
  // from `sm` up it is the floating palette. The field is 16px on a phone:
  // anything smaller makes iOS zoom the page when it takes focus.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center sm:p-4 sm:pt-[12vh]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pt-safe relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-raised dark:bg-paper sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border sm:border-white/60 sm:pt-0 sm:dark:border-white/[0.08]">
        <div className="flex items-center border-b border-ink/[0.06]">
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            disabled={!clinical}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search patients"
            placeholder={clinical ? "Registry no., name or IC" : "Patient search is for clinical roles"}
            className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base text-ink outline-none placeholder:text-soot/60 sm:text-[15px] touch:text-base"
          />
          <button type="button" onClick={onClose} className="shrink-0 px-4 py-3.5 text-[15px] font-semibold text-forest-600 sm:hidden">
            Cancel
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto overscroll-contain p-1.5 sm:max-h-[50vh] sm:flex-none">
          {items.map((p, i) => (
            <li key={p.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(p)}
                className={"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left touch:py-3.5 " +
                  (i === sel ? "bg-forest-50 text-forest-700" : "text-ink hover:bg-ink/[0.04]")}
              >
                <span className="min-w-0 break-words text-[14.5px] font-medium line-clamp-2">{p.full_name ?? <span className="font-normal italic text-soot/60">Restricted</span>}</span>
                <span className="shrink-0 font-mono text-[12.5px] text-soot/75">{p.registry_no}</span>
              </button>
            </li>
          ))}
          {clinical && q.trim() && !busy && items.length === 0 && !error && (
            <li className="px-3 py-6 text-center text-sm text-soot/70">No patients you can see match “{q.trim()}”.</li>
          )}
          {error && <li className="px-3 py-3 text-sm text-danger-700">{error}</li>}
          {clinical && !q.trim() && (
            <li className="px-3 py-4 text-center text-[13px] leading-relaxed text-soot/65">
              Type a registry number to find any patient you can see.
              <br />A name or IC finds your own or shared patients.
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
