"use client";

/**
 * shadcn-style date picker — button trigger + popover calendar, no external
 * dependency (react-day-picker cannot be installed through the device
 * bridge; this reproduces its look and behaviour).
 *
 * The calendar is portalled to <body> and placed from the trigger's
 * rectangle, like Select's panel: inside a card (whose backdrop-filter makes
 * its own stacking context) it would otherwise sit under anything layered
 * above the card — such as the sticky save bar on an episode form.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;
// Desktop, and touch (40px days and buttons). The panel never gets wider than
// the screen allows; on a phone held sideways it scrolls inside itself.
const PANEL_W = 300;
const PANEL_H = 392; // header, six weeks, footer
const PANEL_W_TOUCH = 316;
const PANEL_H_TOUCH = 424;
const FIRST_YEAR = 1900;
const GAP = 6;
const EDGE = 12;

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
  // "days" is the calendar; the title opens "years", then "months" — so a
  // date of birth decades back is three taps, not hundreds of month steps.
  const [mode, setMode] = useState<"days" | "years" | "months">("days");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const yearRef = useRef<HTMLButtonElement | null>(null);
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight?: number } | null>(null);

  /** Below the trigger, else above it; if neither fits, centred and scrolling. */
  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const width = Math.min(coarse ? PANEL_W_TOUCH : PANEL_W, vw - EDGE * 2);
    const height = coarse ? PANEL_H_TOUCH : PANEL_H;
    const below = vh - b.bottom - GAP - EDGE;
    const above = b.top - GAP - EDGE;
    const left = Math.max(EDGE, Math.min(b.left, vw - EDGE - width));
    if (below >= height) setBox({ left, width, top: b.bottom + GAP });
    else if (above >= height) setBox({ left, width, bottom: vh - b.top + GAP });
    else {
      const room = vh - EDGE * 2;
      setBox({ left, width, top: Math.max(EDGE, (vh - Math.min(height, room)) / 2), maxHeight: room });
    }
  }, []);

  useMeasure(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // capture: the scroll may happen in any ancestor, not just the window
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const p = parseIso(value);
    if (p) setView({ y: p.y, m: p.m });
    setMode("days");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bring the year in view to the middle of the year list.
  useEffect(() => {
    if (open && mode === "years") yearRef.current?.scrollIntoView({ block: "center" });
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
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

  const maxP = parseIso(max);
  const lastYear = maxP ? maxP.y : now.getFullYear() + 10;
  const years = useMemo(
    () => Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => lastYear - i),
    [lastYear]);
  const monthOff = (m: number) => !!maxP && (view.y > maxP.y || (view.y === maxP.y && m > maxP.m));

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={"input flex items-center gap-2 text-left " +
          (disabled ? "cursor-not-allowed opacity-60" : "")}
      >
        <span className="text-soot/65"><CalIcon /></span>
        <span className={"flex-1 truncate " + (value ? "text-ink" : "text-soot/60")}>
          {value ? fmtLabel(value) : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="rounded-full p-0.5 text-soot/60 hover:bg-cream hover:text-soot touch:-mr-2.5 touch:p-3.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </span>
        )}
      </button>

      {open && !disabled && box && createPortal(
        <div ref={panelRef} role="dialog" aria-label="Choose a date"
          style={{ position: "fixed", left: box.left, top: box.top, bottom: box.bottom, width: box.width, maxHeight: box.maxHeight }}
          className="z-[75] overflow-y-auto overscroll-contain rounded-xl border border-ink/10 bg-white dark:border-white/[0.08] dark:bg-paper p-3 shadow-raised">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
              className={"flex h-9 w-9 items-center justify-center rounded-lg text-soot/75 hover:bg-cream hover:text-ink touch:h-11 touch:w-10 " + (mode === "days" ? "" : "invisible")} aria-label="Previous month">
              <Chevron left />
            </button>
            <button type="button" onClick={() => setMode(mode === "days" ? "years" : "days")}
              aria-label={mode === "days" ? "Choose year and month" : "Back to the calendar"}
              className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[15px] font-semibold text-ink hover:bg-cream touch:h-11">
              {mode === "months" ? view.y : `${MONTHS[view.m]} ${view.y}`}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round" className={"text-soot/60 transition-transform " + (mode === "days" ? "" : "rotate-180")}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button type="button" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
              className={"flex h-9 w-9 items-center justify-center rounded-lg text-soot/75 hover:bg-cream hover:text-ink touch:h-11 touch:w-10 " + (mode === "days" ? "" : "invisible")} aria-label="Next month">
              <Chevron />
            </button>
          </div>

          {mode === "years" && (
            <div className="grid h-[264px] grid-cols-4 content-start gap-1 overflow-y-auto overscroll-contain pr-0.5 touch:h-[284px]" role="listbox" aria-label="Year">
              {years.map((y) => (
                <button key={y} type="button" ref={y === view.y ? yearRef : undefined}
                  role="option" aria-selected={y === view.y}
                  onClick={() => { setView((v) => ({ y, m: v.m })); setMode("months"); }}
                  className={"flex h-10 items-center justify-center rounded-lg text-[14.5px] tabular-nums transition-colors " +
                    (y === view.y ? "bg-forest-500 font-semibold text-white" : "text-ink hover:bg-ink/[0.05]")}>
                  {y}
                </button>
              ))}
            </div>
          )}

          {mode === "months" && (
            <div className="grid h-[264px] grid-cols-3 content-center gap-1.5 touch:h-[284px]" role="listbox" aria-label="Month">
              {MONTHS.map((name, m) => (
                <button key={name} type="button" disabled={monthOff(m)}
                  role="option" aria-selected={m === view.m}
                  onClick={() => { setView((v) => ({ y: v.y, m })); setMode("days"); }}
                  className={"flex h-12 items-center justify-center rounded-lg text-[14.5px] transition-colors disabled:cursor-not-allowed disabled:text-soot/40 " +
                    (m === view.m ? "bg-forest-500 font-semibold text-white" : "text-ink hover:bg-ink/[0.05]")}>
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {mode === "days" && <div className="grid h-[264px] grid-cols-7 content-start gap-y-0.5 touch:h-[284px]">
            {DOW.map((d) => (
              <span key={d} className="flex h-7 items-center justify-center text-[12.5px] font-medium text-soot/65">{d}</span>
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
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[14.5px] tabular-nums transition-colors touch:h-10 touch:w-full touch:max-w-10 " +
                    (isSel
                      ? "bg-forest-500 font-semibold text-white"
                      : off
                        ? "cursor-not-allowed text-soot/40"
                        : (inMonth ? "text-ink" : "text-soot/50") +
                          " hover:bg-ink/[0.05]" +
                          (isToday ? " font-bold text-forest-600 ring-1 ring-inset ring-forest-500/35" : ""))
                  }
                >
                  {c.d}
                </button>
              );
            })}
          </div>}

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-soot/75 hover:bg-cream hover:text-ink touch:py-2.5">
              Clear
            </button>
            <button type="button"
              disabled={isDisabledDay(todayIso)}
              onClick={() => pick(todayIso)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-forest-500 hover:bg-forest-50 disabled:opacity-40 touch:py-2.5">
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
