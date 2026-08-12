"use client";

/**
 * Global search — ⌘K / Ctrl+K. Raycast-grade: borderless input row,
 * dense single-line results with right-aligned meta, real icons.
 * The full search experience is the Patients page; the last row hands
 * the query over to it.
 */
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useScoped } from "@/lib/useScoped";
import { useSession } from "@/lib/session";
import { canAdmin, canCreate, canExport, canSeeAudit } from "@/lib/access";
import { findCentre } from "@/lib/centres";
import { deriveStage } from "@/lib/staging";
import { ageFrom, initials } from "@/lib/format";

type Item = {
  kind: "patient" | "page" | "action";
  id: string;
  title: string;
  meta: string;
  href: string;
  group: string;
};

const pic = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/** Lucide icons for page rows — the destination's own icon, not a chevron. */
const PAGE_ICONS: Record<string, React.ReactNode> = {
  "/": pic(<><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>),
  "/patients": pic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  "/patients/new": pic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>),
  "/episodes": pic(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /></>),
  "/reports": pic(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>),
  "/reports/export": pic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>),
  "/admin/users": pic(<><circle cx="12" cy="8" r="4" /><path d="M5 21c.6-4 3.4-6 7-6s6.4 2 7 6" /></>),
  "/admin/centres": pic(<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></>),
  "/admin/audit": pic(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>),
  "/profile": pic(<><circle cx="12" cy="8" r="4" /><path d="M5 21c.6-4 3.4-6 7-6s6.4 2 7 6" /></>),
};

const SearchIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

function Hi({ text, q }: { text: string; q: string }) {
  const t = q.trim();
  if (!t) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-ink">{text.slice(i, i + t.length)}</span>
      {text.slice(i + t.length)}
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[5px] border border-ink/10 bg-white px-1 dark:bg-white/[0.08] text-[12px] font-medium text-soot/75 shadow-[0_1px_0_rgba(10,30,20,0.06)]">
      {children}
    </kbd>
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { patients, episodes, session } = useScoped();
  const { session: sess } = useSession();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const pages = useMemo<Item[]>(() => {
    if (!sess) return [];
    const g = "Go to";
    const p: Item[] = [
      { kind: "page", id: "/", title: "Dashboard", meta: "Overview", href: "/", group: g },
      { kind: "page", id: "/patients", title: "Patients", meta: "Registry", href: "/patients", group: g },
      { kind: "page", id: "/episodes", title: "Cancer Episodes", meta: "Registry", href: "/episodes", group: g },
      { kind: "page", id: "/reports", title: "Reports", meta: "Audit & outcomes", href: "/reports", group: g },
      { kind: "page", id: "/profile", title: "Profile", meta: "Account", href: "/profile", group: g },
    ];
    if (canCreate(sess)) p.splice(2, 0, { kind: "page", id: "/patients/new", title: "New Patient", meta: "Register", href: "/patients/new", group: g });
    if (canExport()) p.push({ kind: "page", id: "/reports/export", title: "Data Export", meta: "CSV · Excel · PDF", href: "/reports/export", group: g });
    if (canAdmin(sess)) {
      p.push({ kind: "page", id: "/admin/users", title: "Users", meta: "Administration", href: "/admin/users", group: g });
      p.push({ kind: "page", id: "/admin/centres", title: "Centres", meta: "Administration", href: "/admin/centres", group: g });
    }
    if (canSeeAudit(sess)) p.push({ kind: "page", id: "/admin/audit", title: "Audit Trail", meta: "Administration", href: "/admin/audit", group: g });
    return p;
  }, [sess]);

  const { items, totalHits } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const epByPatient = new Map(episodes.map((e) => [e.patientId, e]));
    const toItem = (p: (typeof patients)[number], group: string): Item => {
      const ep = epByPatient.get(p.id);
      const stage = ep ? deriveStage(ep.data).stage : null;
      const sex = p.sex === "Male" ? "M" : p.sex === "Female" ? "F" : "";
      return {
        kind: "patient",
        id: p.id,
        title: p.fullName,
        meta: [p.registryNo, `${ageFrom(p.dob) ?? ""}${sex}`, findCentre(p.centreId).code, stage].filter(Boolean).join(" · "),
        href: `/patients/${p.id}`,
        group,
      };
    };

    if (!term) {
      const recent = [...patients]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 5)
        .map((p) => toItem(p, "Recent patients"));
      return { items: [...recent, ...pages], totalHits: 0 };
    }

    const all = patients.filter((p) =>
      p.fullName.toLowerCase().includes(term) ||
      p.registryNo.toLowerCase().includes(term) ||
      p.mykad.toLowerCase().includes(term));
    const hits = all.slice(0, 7).map((p) => toItem(p, "Patients"));
    const pageHits = pages.filter((p) => p.title.toLowerCase().includes(term));
    const out: Item[] = [...hits, ...pageHits];
    out.push({
      kind: "action",
      id: "search-all",
      title: `Search all patients for “${q.trim()}”`,
      meta: `${all.length} match${all.length === 1 ? "" : "es"}`,
      href: `/patients?q=${encodeURIComponent(q.trim())}`,
      group: "",
    });
    return { items: out, totalHits: all.length };
  }, [q, patients, episodes, pages]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: Item) {
    onClose();
    if (item.kind === "action") {
      window.dispatchEvent(new CustomEvent("mugis:apply-search", { detail: q.trim() }));
    }
    router.push(item.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
  }

  if (!open || !session) return null;

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="mg-pop relative z-10 mx-auto mt-[10vh] w-[min(760px,94vw)] overflow-hidden rounded-[18px] border border-ink/[0.08] bg-white/[0.97] dark:bg-paper/[0.98] shadow-[0_32px_90px_-14px_rgba(6,48,28,0.42)] backdrop-blur-2xl">
        {/* borderless input row — the panel IS the field */}
        <div className="flex items-center gap-3 px-5">
          <span className="shrink-0 text-forest-500"><SearchIcon size={19} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search patients, pages…"
            className="h-[60px] min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-soot/50 focus-visible:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="border-t border-ink/[0.06]" />

        <div ref={listRef} className="max-h-[min(520px,58vh)] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/[0.04] text-soot/50">
                <SearchIcon size={22} />
              </span>
              <p className="text-[15px] font-medium text-ink">No matches for &ldquo;{q}&rdquo;</p>
              <p className="text-[13px] text-soot/70">Nothing in your scope matches that name, registry number or MyKad.</p>
            </div>
          )}
          {items.map((item, i) => {
            const header = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group || lastGroup;
            const isActive = i === active;
            return (
              <React.Fragment key={item.kind + item.id}>
                {header && (
                  <p className="px-3 pb-1.5 pt-4 text-[12px] font-semibold uppercase tracking-wide text-soot/60 first:pt-1.5">{header}</p>
                )}
                {item.kind === "action" && <div className="mx-2 my-1.5 border-t border-ink/[0.06]" />}
                <button
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={
                    "relative flex h-[52px] w-full items-center gap-3.5 rounded-[11px] px-3 text-left transition-colors duration-75 " +
                    (isActive ? "bg-forest-50 dark:bg-white/[0.06]" : "hover:bg-ink/[0.03]")
                  }
                >
                  {isActive && (
                    <span aria-hidden
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-forest-500" />
                  )}
                  {item.kind === "patient" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-forest-500 text-[13px] font-bold leading-none text-white ring-1 ring-inset ring-white/20">
                      {initials(item.title)}
                    </span>
                  ) : item.kind === "action" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-forest-50 text-forest-600">
                      <SearchIcon size={16} />
                    </span>
                  ) : (
                    <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors " +
                      (isActive ? "bg-white text-forest-600 dark:bg-white/10" : "bg-ink/[0.04] text-soot/70")}>
                      {PAGE_ICONS[item.id] ?? <SearchIcon size={16} />}
                    </span>
                  )}
                  <span className={"min-w-0 flex-1 truncate text-[15.5px] " + (item.kind === "action" ? "font-semibold text-forest-600" : "font-medium text-ink")}>
                    <Hi text={item.title} q={item.kind === "patient" ? q : ""} />
                  </span>
                  <span className="shrink-0 text-[13.5px] tabular-nums text-soot/65">
                    <Hi text={item.meta} q={item.kind === "patient" ? q : ""} />
                  </span>
                  <span className={"shrink-0 transition-opacity " + (isActive ? "opacity-100" : "opacity-0")}>
                    <Kbd>↵</Kbd>
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex h-11 items-center gap-4 border-t border-ink/[0.06] bg-cream/60 px-5 text-[13px] text-soot/70 dark:bg-white/[0.02]">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto tabular-nums">
            {q ? `${totalHits} patient match${totalHits === 1 ? "" : "es"}` : `${patients.length} patients in your scope`}
          </span>
        </div>
      </div>
    </div>
  );
}
