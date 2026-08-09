"use client";

/**
 * shadcn-style date picker — button trigger + popover calendar, no external
 * dependency (react-day-picker cannot be installed through the device
 * bridge; this reproduces its look and behaviour).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function parseIso(v?: string | null): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const [y, m, d] = String(v).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}
function fmtLabel(v?: string | null): string {
  const p = parseIso(v);
  if (!p) return "";
  return `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);
const Chevron = ({ left }: { left?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {left ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
  </svg>
);

export function DatePicker({ value, onChange, max, disabled, placeholder = "Pick a date" }: {
  value?: string | null;
  onChange: (iso: string) => void;
  /** ISO date; days after this are not selectable. */
  max?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const sel = parseIso(value);
  const now = new Date();
  const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ y: number; m: number }>(() =>
    sel ? { y: sel.y, m: sel.m } : { y: now.getFullYear(), m: now.getMonth() });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseIso(value);
    if (p) setView({ y: p.y, m: p.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 6) % 7; // Monday start
    const start = new Date(view.y, view.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    });
  }, [view]);

  const isDisabledDay = (iso: string) => (max ? iso > max : false);

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={"input flex items-center gap-2 text-left " +
          (disabled ? "cursor-not-allowed opacity-60" : "")}
      >
        <span className="text-soot/45"><CalIcon /></span>
        <span className={"flex-1 truncate " + (value ? "text-ink" : "text-soot/40")}>
          {value ? fmtLabel(value) : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="rounded-full p-0.5 text-soot/40 hover:bg-cream hover:text-soot"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </span>
        )}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[278px] rounded-xl border border-white/60 bg-white/90 dark:border-white/[0.08] dark:bg-paper/95 p-3 shadow-raised backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
              className="rounded-lg p-1.5 text-soot/60 hover:bg-cream hover:text-ink" aria-label="Previous month">
              <Chevron left />
            </button>
            <span className="text-[13px] font-semibold text-ink">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
              className="rounded-lg p-1.5 text-soot/60 hover:bg-cream hover:text-ink" aria-label="Next month">
              <Chevron />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {DOW.map((d) => (
              <span key={d} className="flex h-7 items-center justify-center text-[10.5px] font-medium text-soot/45">{d}</span>
            ))}
            {cells.map((c, i) => {
              const iso = toIso(c.y, c.m, c.d);
              const inMonth = c.m === view.m;
              const isSel = !!value && iso === value;
              const isToday = iso === todayIso;
              const off = isDisabledDay(iso);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={off}
                  onClick={() => pick(iso)}
                  className={
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[12.5px] tabular-nums transition-colors " +
                    (isSel
                      ? "bg-forest-500 font-semibold text-white"
                      : off
                        ? "cursor-not-allowed text-soot/20"
                        : (inMonth ? "text-ink" : "text-soot/30") +
                          " hover:bg-ink/[0.05]" +
                          (isToday ? " font-bold text-forest-600 ring-1 ring-inset ring-forest-500/35" : ""))
                  }
                >
                  {c.d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="rounded-lg px-2 py-1 text-xs text-soot/60 hover:bg-cream hover:text-ink">
              Clear
            </button>
            <button type="button"
              disabled={isDisabledDay(todayIso)}
              onClick={() => pick(todayIso)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-forest-500 hover:bg-forest-50 disabled:opacity-40">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
