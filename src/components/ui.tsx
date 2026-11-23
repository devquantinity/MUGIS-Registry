"use client";

import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { crumbsFor } from "@/lib/crumbs";

/* ---------------- primitives ---------------- */

export function Card({ children, className = "", padded = true, id }: {
  children: React.ReactNode; className?: string; padded?: boolean; id?: string;
}) {
  return <div id={id} className={`card ${padded ? "p-4" : ""} ${className}`}>{children}</div>;
}

/**
 * Ancestor trail, above the page title.
 *
 * The final crumb is deliberately dropped — it always repeated the <h1>
 * word for word, and that duplication is what made the strip read as
 * clutter rather than orientation. What is left is the path TO here, which
 * is the only part carrying information the title does not.
 */
export function Breadcrumbs() {
  const trail = crumbsFor(usePathname()).slice(0, -1);
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb"
      className="mb-1 flex min-w-0 flex-wrap items-center gap-1 text-[13px] font-medium text-soot/70">
      {trail.map((c, i) => (
        <React.Fragment key={c.label + i}>
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-soot/40">
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
          {c.href ? (
            <Link href={c.href} className="transition-colors hover:text-forest-600 touch:-my-3 touch:py-3">{c.label}</Link>
          ) : (
            <span>{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs = true }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
  /** Off for the few screens that sit inside another header. */
  crumbs?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div className="min-w-0 max-w-full">
        {crumbs && <Breadcrumbs />}
        <h1 className="break-words font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[24px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[80ch] text-[15px] leading-relaxed text-soot/78">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

type Tone = "ok" | "warn" | "bad" | "muted" | "info" | "gold";

const TONE: Record<Tone, string> = {
  ok: "bg-sage-100/70 text-sage-700",
  warn: "bg-gold-100/70 text-gold-600",
  bad: "bg-danger-50 text-danger-700",
  muted: "bg-ink/[0.05] text-soot",
  info: "bg-forest-50 text-forest-600",
  gold: "bg-gold-100 text-gold-600",
};

export function Badge({ children, tone = "muted", className = "" }: {
  children: React.ReactNode; tone?: Tone; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[13px] font-medium leading-none ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone = "muted", icon, delta, deltaSub, chip: chipProp }: {
  label: string; value: React.ReactNode; sub?: string; tone?: Tone; icon?: React.ReactNode;
  /** Percent change vs a previous period; renders green/red text. */
  delta?: number | null;
  deltaSub?: string;
  /** Count-based alternative to delta — better for small numbers. */
  chip?: { text: string; tone: "up" | "down" | "flat" };
}) {
  const chip = chipProp ? (
    <span className={
      "text-[13px] font-semibold tabular-nums " +
      (chipProp.tone === "up" ? "text-sage-600" : chipProp.tone === "down" ? "text-danger-600" : "text-soot/70")
    }>
      {chipProp.text}
    </span>
  ) : delta === undefined || delta === null ? null : (
      <span className={
        "text-[13px] font-semibold tabular-nums " +
        (delta > 0 ? "text-sage-600" : delta < 0 ? "text-danger-600" : "text-soot/70")
      }>
        {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
      </span>
    );
  // h-full: tiles in one row end at the same line, whether or not they have a sub line
  return (
    <div className="card h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-soot/75">{label}</p>
        {icon && <span className={`shrink-0 rounded-lg p-1 ${TONE[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-1.5 text-2xl font-semibold leading-none tabular-nums tracking-[-0.01em] text-ink">{value}</p>
      {(chip || sub || deltaSub) && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-soot/72">
          {chip}
          {deltaSub ?? sub}
        </p>
      )}
    </div>
  );
}

export type StatItem = {
  href: string; label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode; tone?: Tone;
};

/**
 * The same numbers as a row of Stat tiles, for a phone: one card, a full-width
 * row per number — label left, number right, the whole row a link. Tiles two
 * to a row on a phone wrap their labels and end at different heights.
 */
export function StatList({ items, className = "" }: { items: StatItem[]; className?: string }) {
  return (
    <ul className={`card divide-y divide-ink/[0.06] overflow-hidden ${className}`}>
      {items.map((s) => (
        <li key={s.href + s.label}>
          <Link href={s.href} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-cream/50 active:bg-cream/80">
            {s.icon && (
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE[s.tone ?? "muted"]}`}>{s.icon}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-snug text-ink">{s.label}</span>
              {s.sub && <span className="block text-[13px] leading-snug text-soot/72">{s.sub}</span>}
            </span>
            <span className="shrink-0 text-xl font-semibold tabular-nums text-ink">{s.value}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="-mr-1 shrink-0 text-soot/40" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A button that reports its own outcome instead of handing off to a toast.
 *
 * idle -> working (sweep) -> done (fills green, tick draws on) -> idle.
 * The working state is held for a moment even when the work is instant:
 * a file that appears with no acknowledgement reads as a failure.
 */
export function RunButton({
  label, workingLabel, doneLabel, onRun, disabled, icon, className = "",
  holdMs = 2400,
}: {
  label: React.ReactNode;
  workingLabel: string;
  doneLabel: string;
  onRun: () => void | Promise<void>;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  holdMs?: number;
}) {
  const [state, setState] = React.useState<"idle" | "working" | "done">("idle");
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  async function go() {
    if (state !== "idle" || disabled) return;
    setState("working");
    const started = Date.now();
    try {
      await onRun();
    } finally {
      // Never flash: give the working state at least 600ms on screen.
      const wait = Math.max(0, 600 - (Date.now() - started));
      timers.current.push(window.setTimeout(() => {
        setState("done");
        timers.current.push(window.setTimeout(() => setState("idle"), holdMs));
      }, wait));
    }
  }

  const done = state === "done";
  const working = state === "working";

  return (
    <button
      onClick={go}
      disabled={disabled || working}
      aria-live="polite"
      className={
        "relative w-full overflow-hidden rounded-[10px] px-3.5 py-2.5 text-[15px] font-medium transition-all duration-300 " +
        "disabled:cursor-not-allowed " +
        (done
          ? "mg-settle bg-sage-600 text-white shadow-[0_4px_16px_-4px_rgb(var(--color-sage-600)/0.55)]"
          : "bg-forest-500 text-white hover:bg-forest-600 active:bg-forest-700 disabled:opacity-40") +
        " " + className
      }
    >
      {working && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="mg-sweep absolute inset-y-0 w-1/3 bg-white/20 blur-[6px]" />
        </span>
      )}

      <span className="relative flex items-center justify-center gap-2">
        <span className="flex h-[18px] w-[18px] items-center justify-center">
          {working ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : done ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path className="mg-draw" d="M5 13l4.5 4.5L19 7" />
            </svg>
          ) : (
            icon ?? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
              </svg>
            )
          )}
        </span>
        <span key={state} className="mg-lift">
          {working ? workingLabel : done ? doneLabel : label}
        </span>
      </span>
    </button>
  );
}

export function EmptyState({ title, hint, action }: {
  title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-soot/60">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-soot/75">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Progress({ value, tone = "info" }: { value: number; tone?: Tone }) {
  const bar = tone === "bad" ? "bg-danger-600" : tone === "warn" ? "bg-gold-500" : "bg-forest-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * Checkbox. The native control cannot be styled consistently across
 * browsers and its tick is invisible at this size, so the real input stays
 * for accessibility (label, focus, keyboard, screen readers) and the square
 * beside it is drawn.
 */
export function Check({ checked, onChange, label, hint, disabled, tone = "forest" }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
  tone?: "forest" | "gold";
}) {
  const on = tone === "gold"
    ? "border-gold-500 bg-gold-500 text-goldink"
    : "border-forest-500 bg-forest-500 text-white";
  return (
    <label className={"group flex cursor-pointer items-start gap-3 touch:min-h-[44px] touch:items-center " + (disabled ? "cursor-not-allowed opacity-50" : "")}>
      <span className="relative mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className={
            "flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-all duration-150 " +
            "peer-focus-visible:ring-2 peer-focus-visible:ring-forest-500/35 peer-focus-visible:ring-offset-1 " +
            (checked
              ? `${on} scale-100`
              : "border-ink/20 bg-paper group-hover:border-forest-500/60 group-hover:bg-forest-50/50")
          }
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
            className={"transition-all duration-150 " + (checked ? "scale-100 opacity-100" : "scale-50 opacity-0")}>
            <path d="M5 13l4.5 4.5L19 7" />
          </svg>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        {label}
        {hint && <span className="mt-0.5 block text-[13px] leading-relaxed text-soot/80">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="label flex items-baseline gap-1">
        {label}
        {required && <span className="text-danger-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[13px] text-soot/72">{hint}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  // Portalled to <body>: an ancestor with backdrop-filter (the frosted header,
  // cards) becomes the containing block for position:fixed, which pins the
  // dialog inside that element instead of the viewport.
  // On a phone this is a bottom sheet: full width, anchored to the bottom edge
  // where thumbs are, and clear of the home indicator. From `sm` up it is the
  // centred dialog it always was.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4 short:p-2">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`mg-sheet relative z-10 max-h-sheet w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-white/60 dark:border-white/[0.08] bg-white/95 dark:bg-paper/95 shadow-raised backdrop-blur-xl sm:max-h-[85vh] sm:rounded-2xl short:max-h-[calc(100dvh-1rem)] sm:bg-white/85 sm:dark:bg-paper/90 ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/[0.06] bg-white/95 dark:bg-paper/95 px-5 py-3.5 backdrop-blur-xl sm:bg-white/85 sm:dark:bg-paper/90">
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-soot hover:bg-cream touch:h-11 touch:w-11">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-[max(1rem,var(--safe-bottom))] pt-4 sm:pb-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export type ToastTone = "success" | "info" | "warn" | "error";

export type ToastData = {
  title: string;
  /** One line of detail — what happened, or what happens next. */
  body?: string;
  /** A reference the user may need to quote, shown in monospace. */
  ref?: string;
  tone?: ToastTone;
  /** Optional follow-through, e.g. "View request". */
  href?: string;
  hrefLabel?: string;
  /** Milliseconds on screen. Longer for anything with a reference to read. */
  duration?: number;
};

const TOAST_TONE: Record<ToastTone, { ring: string; icon: string; rail: string; mark: React.ReactNode }> = {
  success: {
    ring: "border-sage-600/25", icon: "bg-sage-100 text-sage-700", rail: "bg-sage-600",
    mark: <path className="mg-draw" d="M5 13l4.5 4.5L19 7" />,
  },
  info: {
    ring: "border-forest-500/25", icon: "bg-forest-50 text-forest-600", rail: "bg-forest-500",
    mark: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  },
  warn: {
    ring: "border-gold-300", icon: "bg-gold-100 text-gold-600", rail: "bg-gold-500",
    mark: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16h.01" /></>,
  },
  error: {
    ring: "border-danger-200", icon: "bg-danger-50 text-danger-700", rail: "bg-danger-600",
    mark: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>,
  },
};

/**
 * Confirmation surface. Enters from the right under the header, holds long
 * enough to read a reference number, and counts itself down on a rail the
 * user can pause by hovering. Portalled to <body> — an ancestor with
 * backdrop-filter would otherwise capture the fixed positioning.
 */
export function Toast({ message, onDone }: {
  message: string | ToastData | null;
  onDone: () => void;
}) {
  const data: ToastData | null =
    message === null ? null : typeof message === "string" ? { title: message } : message;

  const [leaving, setLeaving] = React.useState(false);
  const key = data ? `${data.title}|${data.ref ?? ""}` : "";
  const duration = data?.duration ?? (data?.ref ? 6000 : 4200);

  React.useEffect(() => {
    if (!data) return;
    setLeaving(false);
    const hide = window.setTimeout(() => setLeaving(true), duration);
    const done = window.setTimeout(onDone, duration + 200);
    return () => { window.clearTimeout(hide); window.clearTimeout(done); };
    // keyed on the message itself so a second toast restarts the clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  if (!data || typeof document === "undefined") return null;
  const tone = TOAST_TONE[data.tone ?? "success"];

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 top-[calc(var(--safe-top)+0.75rem)] z-[80] flex justify-center sm:inset-x-auto sm:right-5 sm:top-[76px] sm:justify-end">
      <div
        role="status"
        aria-live="polite"
        className={`mg-toast pointer-events-auto w-full overflow-hidden rounded-[14px] border bg-paper/95 shadow-[0_12px_40px_-8px_rgba(10,30,20,0.28)] backdrop-blur-xl sm:w-[380px] ${tone.ring} ${leaving ? "mg-toast-out" : "mg-toast-in"}`}
      >
        <div className="flex items-start gap-3 p-3.5">
          <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
            <span className={`mg-ring absolute inset-0 rounded-full ${tone.icon}`} />
            <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${tone.icon}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                {tone.mark}
              </svg>
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-ink">{data.title}</p>
            {data.body && (
              <p className="mt-0.5 text-[13px] leading-relaxed text-soot/80">{data.body}</p>
            )}
            {(data.ref || data.href) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {data.ref && (
                  <span className="rounded-md border border-ink/10 bg-cream px-1.5 py-0.5 font-mono text-[12px] font-semibold text-ink">
                    {data.ref}
                  </span>
                )}
                {data.href && (
                  <Link href={data.href} onClick={onDone}
                    className="text-[13px] font-semibold text-forest-600 hover:underline">
                    {data.hrefLabel ?? "View"} &rarr;
                  </Link>
                )}
              </div>
            )}
          </div>

          <button onClick={() => { setLeaving(true); window.setTimeout(onDone, 200); }}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-soot/50 transition-colors hover:bg-ink/[0.05] hover:text-ink">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="h-[3px] w-full bg-ink/[0.06]">
          <div className={`mg-countdown h-full ${tone.rail}`} style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------- table ---------------- */

export function Table({ head, children, minWidth = 720, className = "" }: {
  head: React.ReactNode; children: React.ReactNode; minWidth?: number;
  /** e.g. `hidden md:block` when the page draws cards on a phone instead. */
  className?: string;
}) {
  return (
    <div className={`card overflow-x-auto ${className}`}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead className="border-b border-ink/[0.06]">{head}</thead>
        <tbody className="divide-y divide-ink/[0.05]">{children}</tbody>
      </table>
    </div>
  );
}

/** Explicit map — Tailwind cannot see class names built by interpolation. */
const ALIGN: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function Th({ children, align = "left", w }: {
  children?: React.ReactNode; align?: "left" | "right" | "center"; w?: string;
}) {
  return <th className={`th ${ALIGN[align]}`} style={{ width: w }}>{children}</th>;
}

export function Td({ children, align = "left", className = "" }: {
  children?: React.ReactNode; align?: "left" | "right" | "center"; className?: string;
}) {
  return <td className={`td ${ALIGN[align]} ${className}`}>{children}</td>;
}

export type TimeRange = "3m" | "6m" | "12m" | "all";

export const RANGE_MS: Record<TimeRange, number | null> = {
  "3m": 91 * 86400000, "6m": 182 * 86400000, "12m": 365 * 86400000, all: null,
};

export function RangeFilter({ value, onChange }: {
  value: TimeRange; onChange: (r: TimeRange) => void;
}) {
  const opts: [TimeRange, string][] = [["3m", "3M"], ["6m", "6M"], ["12m", "12M"], ["all", "All"]];
  return (
    <div className="inline-flex items-center rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] p-0.5 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm">
      {opts.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={"rounded-[8px] px-2.5 py-1 text-[14px] font-medium transition-colors " +
            (value === v ? "bg-forest-500 text-white" : "text-soot/72 hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* ---------------- charts (inline SVG, no dependencies) ---------------- */

/**
 * Chart palette — validated (lightness band, chroma floor, CVD separation,
 * normal-vision floor, 3:1 contrast on white). Categorical hues are assigned
 * in this fixed order and never cycled; a 5th category folds into `other`.
 */
export const CHART = {
  cat: ["#1B7A4A", "#3B6EA5", "#B87817", "#A04E75"],
  other: "#8B948D",
  status: { ok: "#1B7A4A", warn: "#B87817", bad: "#B3362B" },
};

export function BarChart({ data, height = 150, format, color, emphasize = "max" }: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
  /** Per-bar colour; defaults to the categorical green. */
  color?: (d: { label: string; value: number }, i: number) => string;
  emphasize?: "max" | "none";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const maxIdx = data.findIndex((d) => d.value === max);
  const fmt = (n: number) => (format ? format(n) : String(n));
  const plotH = height - 8;

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* recessive grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line/60"
            style={{ bottom: 8 + plotH * f }} />
        ))}
        <div className="absolute inset-x-0 bottom-[8px] border-t border-line" />

        <div className="absolute inset-x-0 bottom-[8px] flex items-end gap-[6px]" style={{ height: plotH }}>
          {data.map((d, i) => {
            const barH = Math.max(3, (d.value / max) * (plotH - 22));
            const isMax = emphasize === "max" && i === maxIdx && d.value > 0;
            const fill = color ? color(d, i) : isMax ? "var(--chart-accent)" : "rgb(var(--color-ink) / 0.08)";
            return (
              <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 items-end justify-center">
                {/* dark chip on the peak — everything else on hover */}
                {isMax ? (
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[12px] font-bold tabular-nums text-paper shadow-card"
                    style={{ bottom: barH + 6 }}>
                    {fmt(d.value)}
                  </span>
                ) : (
                  <span className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[12px] font-semibold text-paper opacity-0 shadow-raised transition-opacity duration-100 group-hover:opacity-100"
                    style={{ bottom: barH + 6 }}>
                    {d.label} · {fmt(d.value)}
                  </span>
                )}
                <div
                  className="w-full max-w-[34px] rounded-[6px] rounded-b-[2px] transition-[filter] duration-100 group-hover:brightness-[0.92]"
                  style={{ height: barH, background: fill }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[6px]">
        {data.map((d, i) => (
          <p key={`${d.label}-${i}`} className="flex-1 truncate text-center text-[12px] text-soot/72" title={d.label}>
            {d.label}
          </p>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 148, unit = "", palette, stacked }: {
  data: { label: string; value: number }[];
  size?: number;
  unit?: string;
  /** Override hues (e.g. status colours for severity bands). */
  palette?: string[];
  /** Legend below the ring instead of beside it — for narrow cards. */
  stacked?: boolean;
}) {
  const colours = palette ?? CHART.cat;
  const colourOf = (i: number) => colours[i] ?? CHART.other;
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2.5 : 0;
  let start = 0;

  return (
    <div className={stacked ? "flex flex-col items-center gap-3" : "flex flex-wrap items-center gap-5"}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="rgb(var(--color-line) / 0.55)" strokeWidth="16" />
          {data.map((d, i) => {
            const frac = total === 0 ? 0 : d.value / total;
            const len = Math.max(frac * c - gap, 0);
            const el = frac > 0 ? (
              <circle key={`${d.label}-${i}`} r={r} fill="none" stroke={colourOf(i)}
                strokeWidth="16" strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-(start + gap / 2)}
                className="transition-opacity duration-100 hover:opacity-80">
                <title>{`${d.label} · ${d.value} (${total ? Math.round(frac * 100) : 0}%)`}</title>
              </circle>
            ) : null;
            start += frac * c;
            return el;
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="fill-ink" style={{ fontSize: 22, fontWeight: 700 }}>
          {total}
        </text>
        <text x="50%" y="60%" textAnchor="middle" style={{ fontSize: 10, fill: "rgb(var(--color-soot) / 0.6)" }}>
          {unit}
        </text>
      </svg>
      <ul className={stacked ? "w-full space-y-1" : "min-w-[150px] flex-1 space-y-1.5"}>
        {data.map((d, i) => (
          <li key={`${d.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colourOf(i) }} />
            <span className="flex-1 truncate text-soot">{d.label}</span>
            <span className="font-bold tabular-nums text-ink">{d.value}</span>
            <span className="w-9 text-right tabular-nums text-soot/65">
              {total === 0 ? "0%" : `${Math.round((d.value / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBar({ data, format, color, max: fixedMax }: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
  /** Fixed scale end (e.g. 100 for percentages); defaults to the largest value. */
  max?: number;
}) {
  const max = fixedMax ?? Math.max(1, ...data.map((d) => d.value));
  const fill = color ?? "var(--chart-accent)";
  return (
    <ul className="space-y-0.5">
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} className="group rounded-lg px-1.5 py-1 transition-colors hover:bg-ink/[0.03]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-soot">{d.label}</span>
            <span className="text-xs font-bold tabular-nums text-ink">
              {format ? format(d.value) : d.value}
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-ink/[0.05]">
            <div className="h-full rounded-full transition-[filter] duration-100 group-hover:brightness-[0.88]"
              style={{ width: `${(d.value / max) * 100}%`, background: fill }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AreaChart({ data, height = 150, format }: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const gid = React.useId().replace(/[:]/g, "");
  const W = 600;
  const H = height;
  const padT = 16, padB = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const pts = data.map((d, i) => ({ px: x(i), py: y(d.value) }));

  // Catmull-Rom → cubic Bézier for a smooth line
  let line = "";
  pts.forEach((p, i) => {
    if (i === 0) { line = `M${p.px},${p.py}`; return; }
    const p0 = pts[i - 2] ?? pts[i - 1];
    const p1 = pts[i - 1];
    const p2 = p;
    const p3 = pts[i + 1] ?? p;
    const c1x = p1.px + (p2.px - p0.px) / 6, c1y = p1.py + (p2.py - p0.py) / 6;
    const c2x = p2.px - (p3.px - p1.px) / 6, c2y = p2.py - (p3.py - p1.py) / 6;
    line += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.px},${p2.py}`;
  });
  const area = `${line} L${W},${H - padB} L0,${H - padB} Z`;
  const fmt = (v: number) => (format ? format(v) : String(v));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  }

  const h = hover !== null ? pts[hover] : null;

  return (
    <div>
      <div className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0">
          <defs>
            <linearGradient id={`ag${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--chart-accent)" }} stopOpacity="0.22" />
              <stop offset="100%" style={{ stopColor: "var(--chart-accent)" }} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={padT + (H - padT - padB) * f} y2={padT + (H - padT - padB) * f}
              stroke="rgb(var(--color-line) / 0.7)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke="rgb(var(--color-line))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={`url(#ag${gid})`} />
          <path d={line} fill="none" style={{ stroke: "var(--chart-accent)" }} strokeWidth="2" vectorEffect="non-scaling-stroke"
            strokeLinecap="round" strokeLinejoin="round" />
          {h && (
            <line x1={h.px} x2={h.px} y1={padT - 4} y2={H - padB} stroke="rgb(var(--color-ink) / 0.25)"
              strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {h && hover !== null && (
          <>
            <span
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
              style={{ left: `${(h.px / W) * 100}%`, top: h.py, background: "var(--chart-accent)" }}
            />
            <span
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper shadow-raised"
              style={{
                left: `${Math.min(92, Math.max(8, (h.px / W) * 100))}%`,
                top: Math.max(0, h.py - 30),
              }}
            >
              {data[hover].label} · {fmt(data[hover].value)}
            </span>
          </>
        )}
      </div>
      <div className="mt-1 flex">
        {data.map((d, i) => (
          <p key={`${d.label}-${i}`}
            className={"flex-1 truncate text-center text-[12px] " + (hover === i ? "font-bold text-ink" : "text-soot/70")}>
            {n > 9 && i % 2 === 1 ? "" : d.label}
          </p>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ points, width = 120, height = 32 }: {
  points: number[]; width?: number; height?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${height - ((p - min) / span) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" style={{ stroke: "var(--chart-accent)" }} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
