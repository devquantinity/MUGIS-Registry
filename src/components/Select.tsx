"use client";

/**
 * The dropdown used everywhere a choice is made.
 *
 * Every list of options in the registry — the centre on the login screen, a
 * filter bar, a cell in the users table, a staging field halfway down an
 * episode form — opens the same panel as the role switcher in the header.
 *
 * A native <select> could not do that. Its option list is drawn by the
 * operating system: it ignores the registry's colours entirely and renders
 * as a grey system menu in the middle of a green interface, differently on
 * Windows, macOS and Android. Everything the native control gives you for
 * free is reproduced here — keyboard, type-to-jump, the listbox roles a
 * screen reader announces — with the panel under our own control.
 *
 * The panel is portalled to <body> and positioned from the trigger's own
 * rectangle. Several of these sit inside cards and inside the horizontally
 * scrolling users table, where an absolutely-positioned panel would be
 * clipped by the overflow; and any ancestor carrying a backdrop-filter (the
 * frosted header, every card) would otherwise capture position: fixed and
 * pin the panel inside itself.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Measuring has to happen before paint, but useLayoutEffect warns when the
 *  page is rendered on the server. Every screen here is pre-rendered. */
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** Quiet note on the right of the row — e.g. what a role can see. */
  hint?: string;
  disabled?: boolean;
};

/** Convenience for the many lists that are just strings. */
export function opts(values: readonly string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={"shrink-0 transition-transform duration-150 " + (open ? "-rotate-180" : "")}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4.5 4.5L19 7" />
  </svg>
);

type Box = { top: number; left: number; minWidth: number; maxHeight: number; flip: boolean };

const GAP = 6;      // trigger → panel
const EDGE = 12;    // panel → viewport edge
const MIN_MENU = 200;

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "— select —",
  heading,
  disabled,
  size = "md",
  className = "",
  id,
  ariaLabel,
  menuWidth,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Shown when the current value matches no option. */
  placeholder?: string;
  /** Small heading above the list, as on the role switcher. */
  heading?: string;
  disabled?: boolean;
  /** `sm` for table cells and header controls. */
  size?: "sm" | "md";
  /** Extra classes on the trigger, e.g. `!w-auto`. */
  className?: string;
  id?: string;
  ariaLabel?: string;
  /** Minimum panel width; defaults to the wider of the trigger and 200px. */
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState<Box | null>(null);
  const [mounted, setMounted] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typed = useRef<{ s: string; at: number }>({ s: "", at: 0 });

  useEffect(() => setMounted(true), []);

  const selectedIdx = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value]
  );
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  /* ---- positioning ---- */

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const minW = Math.max(b.width, menuWidth ?? MIN_MENU);
    const below = vh - b.bottom - GAP - EDGE;
    const above = b.top - GAP - EDGE;
    // Only flip when there is genuinely more room above; a panel that jumps
    // over its own trigger for the sake of 20px reads as a glitch.
    const flip = below < 180 && above > below;

    setBox({
      top: flip ? b.top - GAP : b.bottom + GAP,
      left: Math.max(EDGE, Math.min(b.left, vw - EDGE - minW)),
      minWidth: minW,
      maxHeight: Math.max(140, Math.min(320, flip ? above : below)),
      flip,
    });
  }, [menuWidth]);

  useMeasure(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    // capture: the scroll may happen in any ancestor, not just the window
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  /* ---- open / close ---- */

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setActive(-1);
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Focus the panel so the keyboard lands somewhere sensible and the list
  // opens at whatever is already chosen.
  useEffect(() => {
    if (!open) return;
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, selectedIdx]);

  useEffect(() => {
    if (!open || active < 0) return;
    rowRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  }

  function step(from: number, dir: 1 | -1) {
    const n = options.length;
    if (n === 0) return -1;
    let i = from;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  /** Type a few letters to jump, as the native control does. */
  function typeahead(key: string) {
    const now = Date.now();
    typed.current = {
      s: now - typed.current.at > 900 ? key : typed.current.s + key,
      at: now,
    };
    const q = typed.current.s.toLowerCase();
    const from = active < 0 ? 0 : active;
    const n = options.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + (typed.current.s.length === 1 ? k : k - 1)) % n;
      const o = options[i];
      if (!o.disabled && o.label.toLowerCase().startsWith(q)) { setActive(i); return; }
    }
  }

  function onPanelKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive((i) => step(i, 1)); break;
      case "ArrowUp": e.preventDefault(); setActive((i) => step(i, -1)); break;
      case "Home": e.preventDefault(); setActive(step(-1, 1)); break;
      case "End": e.preventDefault(); setActive(step(options.length, -1)); break;
      case "Enter":
      case " ": e.preventDefault(); choose(active); break;
      case "Escape": e.preventDefault(); close(); break;
      case "Tab": close(false); break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeahead(e.key);
    }
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  const sm = size === "sm";

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (disabled ? null : setOpen((o) => !o))}
        onKeyDown={onTriggerKey}
        className={
          "input flex items-center gap-2 text-left " +
          (sm ? "!py-1 !text-xs " : "") +
          (disabled ? "cursor-not-allowed opacity-60 " : "cursor-pointer ") +
          (open ? "border-forest-500 ring-2 ring-forest-500/15 " : "") +
          className
        }
      >
        <span className={"min-w-0 flex-1 truncate " + (selected ? "text-ink" : "text-soot/60")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-soot/65"><Chevron open={open} /></span>
      </button>

      {open && mounted && createPortal(
        <div
          ref={panelRef}
          tabIndex={-1}
          role="listbox"
          aria-label={ariaLabel ?? heading}
          onKeyDown={onPanelKey}
          style={{
            position: "fixed",
            top: box?.top ?? -9999,
            left: box?.left ?? -9999,
            minWidth: box?.minWidth,
            maxWidth: `calc(100vw - ${EDGE * 2}px)`,
            maxHeight: box?.maxHeight,
            transform: box?.flip ? "translateY(-100%)" : undefined,
            visibility: box ? "visible" : "hidden",
          }}
          className="mg-menu z-[75] overflow-y-auto overflow-x-hidden rounded-xl border border-ink/10 bg-white p-1.5 shadow-raised outline-none dark:border-white/[0.08] dark:bg-paper"
        >
          {heading && (
            <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-wide text-soot/70">
              {heading}
            </p>
          )}
          {options.length === 0 && (
            <p className="px-3 py-2.5 text-[14px] text-soot/70">Nothing to choose from.</p>
          )}
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <button
                key={o.value + i}
                ref={(el) => { rowRefs.current[i] = el; }}
                type="button"
                role="option"
                aria-selected={isSel}
                disabled={o.disabled}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                className={
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors touch:min-h-[44px] " +
                  (sm ? "py-2 text-[14px] " : "py-2.5 text-[14.5px] ") +
                  (o.disabled
                    ? "cursor-not-allowed text-soot/40 "
                    : isSel
                      ? "bg-forest-50 font-semibold text-forest-600 "
                      : "text-ink ") +
                  (!o.disabled && !isSel && i === active ? "bg-ink/[0.04] " : "")
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-3.5 shrink-0">{isSel && <Tick />}</span>
                  <span className="truncate">{o.label}</span>
                </span>
                {o.hint && (
                  <span className="shrink-0 whitespace-nowrap text-[12.5px] font-normal text-soot/70">
                    {o.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
