"use client";

import { useEffect, useRef } from "react";

/* ---- 6-digit code input — shadcn InputOTP look, no dependency -------- */
export default function OtpInput({ code, onCode, disabled, onComplete }: {
  code: string[];
  onCode: (next: string[]) => void;
  disabled?: boolean;
  /** Called with the six digits as soon as the last one is entered. */
  onComplete: (code: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  function commit(next: string[], focusIdx: number | null) {
    onCode(next);
    if (focusIdx !== null) refs.current[Math.max(0, Math.min(5, focusIdx))]?.focus();
    if (next.every((d) => d !== "")) onComplete(next);
  }

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = d;
    commit(next, d && i < 5 ? i + 1 : null);
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      e.preventDefault();
      const next = [...code];
      next[i - 1] = "";
      commit(next, i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, i) => digits[i] ?? "");
    commit(next, Math.min(digits.length, 5));
  }

  const box = (i: number) => (
    <input
      key={i}
      ref={(el) => { refs.current[i] = el; }}
      value={code[i]}
      onChange={(e) => setDigit(i, e.target.value)}
      onKeyDown={(e) => onKey(i, e)}
      onPaste={onPaste}
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      inputMode="numeric"
      autoComplete={i === 0 ? "one-time-code" : "off"}
      aria-label={`Digit ${i + 1}`}
      className="h-12 w-11 rounded-[10px] border border-ink/10 bg-white/80 text-center text-lg font-semibold tabular-nums text-ink transition-colors focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500/15 disabled:opacity-50 dark:bg-white/[0.06] dark:focus:bg-white/[0.09]"
    />
  );

  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map(box)}
      <span aria-hidden className="w-2 text-center text-soot/60">–</span>
      {[3, 4, 5].map(box)}
    </div>
  );
}

