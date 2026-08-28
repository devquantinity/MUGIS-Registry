"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import { CommandPalette } from "@/components/CommandPalette";
import { findCentre } from "@/lib/centres";
import { ROLE_LABELS, SessionProvider, useSession, type Role } from "@/lib/session";
import { seedUsers } from "@/lib/seed";
import { StoreProvider, useStore } from "@/lib/store";
import { useScoped } from "@/lib/useScoped";
import { canApproveExport, scopeLabel } from "@/lib/access";
import { useExportAlerts } from "@/lib/useExportAlerts";
import { Modal } from "@/components/ui";
import { ACCENTS, ThemeProvider, useTheme } from "@/lib/theme";
import { initials, relTime } from "@/lib/format";

type NavItem = { href: string; label: string; icon: React.ReactNode; roles?: Role[] };
type NavGroup = { title: string; items: NavItem[] };

const ic = (d: React.ReactNode, size = 16) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

/* Lucide icon paths (ISC) — a coherent, production icon set. */
const ICONS = {
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  patients: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  add: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </>
  ),
  episode: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  reports: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  export: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c.6-4 3.4-6 7-6s6.4 2 7 6" />
    </>
  ),
  centres: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </>
  ),
  audit: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  bell: (
    <>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  approvals: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  crumb: <path d="m9 18 6-6-6-6" />,
  menu: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

const NAV: NavGroup[] = [
  {
    title: "Menu",
    items: [
      { href: "/", label: "Dashboard", icon: ic(ICONS.dashboard) },
      { href: "/reports", label: "Reports", icon: ic(ICONS.reports) },
      { href: "/reports/export", label: "Data Export", icon: ic(ICONS.export) },
    ],
  },
  {
    title: "Registry",
    items: [
      { href: "/patients", label: "Patients", icon: ic(ICONS.patients) },
      {
        href: "/patients/new",
        label: "New Patient",
        icon: ic(ICONS.add),
        roles: ["admin", "clinician", "trainee"],
      },
      { href: "/episodes", label: "Cancer Episodes", icon: ic(ICONS.episode) },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/admin/approvals",
        label: "Export Approvals",
        icon: ic(ICONS.approvals),
        roles: ["hod"],
      },
      { href: "/admin/users", label: "Users", icon: ic(ICONS.users), roles: ["admin"] },
      { href: "/admin/centres", label: "Centres", icon: ic(ICONS.centres), roles: ["admin"] },
      {
        href: "/admin/audit",
        label: "Audit Trail",
        icon: ic(ICONS.audit),
        roles: ["admin", "head"],
      },
    ],
  },
];

const ALL_HREFS = NAV.flatMap((g) => g.items.map((i) => i.href));

function matches(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function isActive(pathname: string, href: string) {
  const best = ALL_HREFS.filter((h) => matches(pathname, h))
    .sort((a, b) => b.length - a.length)[0];
  return best === href;
}

function visibleGroups(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export { initials } from "@/lib/format";

/** Live record counts shown as sidebar badges. */
function useNavCounts(): Record<string, number> {
  const { patients, episodes } = useScoped();
  const { state } = useStore();
  const { session } = useSession();
  const counts: Record<string, number> = {
    "/patients": patients.length,
    "/episodes": episodes.length,
  };
  if (session?.role === "admin") counts["/admin/users"] = state.users.length;
  if (session && canApproveExport(session)) {
    // Only what this person can actually action — their own requests are
    // waiting on somebody else.
    counts["/admin/approvals"] = state.exportRequests.filter(
      (r) => r.status === "pending" && r.requestedBy !== session.email
    ).length;
  }
  return counts;
}

/** The brand gradient behind the whole app — sidebar reads directly on it. */
const BACKDROP: React.CSSProperties = {
  backgroundColor: "var(--bd-base)",
  backgroundImage: [
    "radial-gradient(55% 45% at 10% 104%, rgb(var(--bloom) / var(--bloom-o)) 0%, rgb(var(--bloom) / 0) 60%)",
    "radial-gradient(70% 60% at 0% 0%, rgb(var(--glow-a) / 0.85) 0%, rgb(var(--glow-a) / 0) 70%)",
    "radial-gradient(90% 90% at 45% 55%, rgb(var(--glow-b) / 0.9) 0%, rgb(var(--glow-b) / 0) 80%)",
  ].join(", "),
};

function AppBackdrop() {
  return <div aria-hidden className="fixed inset-0 -z-10" style={BACKDROP} />;
}

/**
 * The sheet is inset 12px from the top, but the page — not the sheet —
 * is what scrolls, so content used to travel up through that 12px strip
 * and appear above the sticky header. This caps it.
 *
 * Same element geometry as AppBackdrop (fixed inset-0, identical gradients)
 * and then clipped to the top 12px, so it lines up with the backdrop exactly
 * instead of approximating it. z-20 sits above page content and below the
 * z-30 header, whose top edge meets this strip's bottom edge.
 */
function TopCap() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 hidden lg:block"
      style={{ ...BACKDROP, clipPath: "inset(0 0 calc(100% - 12px) 0)" }}
    />
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
        <Image src="/mugis-mark.png" alt="" width={250} height={250} className="h-6.5 w-6.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold tracking-tight text-white">MUGIS</span>
        <span className="block text-[12.5px] text-white/45">Upper GI Registry</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { session } = useSession();
  const counts = useNavCounts();
  if (!session) return null;

  return (
    <>
      {visibleGroups(session.role).map((group) => (
        <div key={group.title} className="mt-6 first:mt-2">
          <p className="mb-1 px-3.5 text-[12px] font-semibold uppercase tracking-wider text-white/40">{group.title}</p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const count = counts[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={
                  "mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all duration-150 " +
                  (active
                    ? "bg-white/15 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md"
                    : "font-medium text-white/60 hover:bg-white/[0.07] hover:text-white")
                }
              >
                <span className={"shrink-0 " + (active ? "text-white" : "text-white/40")}>{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {count !== undefined && (
                  <span className={
                    "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-medium tabular-nums " +
                    (active ? "bg-white/25 text-white" : "bg-white/10 text-white/55")
                  }>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Account row — opens the profile page; signing out lives there, quietly. */
function ProfileRow({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useSession();
  const pathname = usePathname();
  if (!session) return null;
  const active = pathname === "/profile";
  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      className={
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-150 " +
        (active ? "bg-white/15 backdrop-blur-md" : "hover:bg-white/[0.07]")
      }
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px] font-bold text-white ring-1 ring-white/25">
        {initials(session.name)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14.5px] font-semibold text-white">{session.name}</span>
        <span className="block truncate text-[12.5px] text-white/45">{session.email}</span>
      </span>
      <span className="text-white/35">{ic(ICONS.chevron, 14)}</span>
    </Link>
  );
}

function ResetDemo() {
  const { resetDemo } = useStore();
  const [ask, setAsk] = useState(false);
  return (
    <>
      <button
        onClick={() => setAsk(true)}
        aria-label="Reset demo data"
        title="Reset demo data"
        className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] text-soot/72 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12] hover:text-ink"
      >
        {ic(ICONS.reset, 15)}
      </button>
      <Modal open={ask} onClose={() => setAsk(false)} title="Reset demo data?">
        <p className="text-sm leading-relaxed text-soot">
          This restores the original seeded dataset. Any patients, episodes or
          edits you added in this browser will be lost.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setAsk(false)} className="btn-secondary">Cancel</button>
          <button
            onClick={() => { resetDemo(); setAsk(false); }}
            className="btn bg-danger-600 text-white hover:bg-danger-700"
          >
            Reset data
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Light/dark + accent colour — stored in this browser, applied instantly. */
function AppearanceControls() {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white/35">Appearance</span>
        <div className="flex rounded-[9px] bg-black/25 p-0.5" role="group" aria-label="Colour mode">
          <button
            type="button"
            onClick={() => setMode("light")}
            aria-label="Light mode"
            aria-pressed={mode === "light"}
            className={
              "flex h-6 w-7 items-center justify-center rounded-[7px] transition-colors " +
              (mode === "light" ? "bg-white/90 text-black/75" : "text-white/45 hover:text-white/80")
            }
          >
            {ic(ICONS.sun, 13)}
          </button>
          <button
            type="button"
            onClick={() => setMode("dark")}
            aria-label="Dark mode"
            aria-pressed={mode === "dark"}
            className={
              "flex h-6 w-7 items-center justify-center rounded-[7px] transition-colors " +
              (mode === "dark" ? "bg-white/90 text-black/75" : "text-white/45 hover:text-white/80")
            }
          >
            {ic(ICONS.moon, 13)}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between" role="group" aria-label="Accent colour">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAccent(a.id)}
            title={a.label}
            aria-label={`${a.label} theme`}
            aria-pressed={accent === a.id}
            className={
              "flex h-6 w-6 items-center justify-center rounded-full transition-all " +
              (accent === a.id ? "ring-2 ring-white/85" : "ring-1 ring-white/20 hover:ring-white/55")
            }
            style={{ background: a.swatch }}
          >
            {accent === a.id && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4.5 4.5L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Desktop sidebar — lives directly on the brand gradient */
function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col lg:flex">
      <div className="px-4 pb-3 pt-7">
        <Logo />
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 pb-3">
        <NavLinks />
      </nav>
      <AppearanceControls />
      <div className="mx-4 border-t border-white/10" />
      <div className="p-3">
        <ProfileRow />
      </div>
    </aside>
  );
}

/* Mobile slide-over — same gradient panel */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col overflow-hidden shadow-raised"
        style={{
          backgroundColor: "var(--bd-base)",
          backgroundImage: [
            "radial-gradient(55% 45% at 10% 104%, rgb(var(--bloom) / var(--bloom-o)) 0%, rgb(var(--bloom) / 0) 60%)",
            "radial-gradient(70% 60% at 0% 0%, rgb(var(--glow-a) / 0.85) 0%, rgb(var(--glow-a) / 0) 70%)",
          ].join(", "),
        }}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {ic(ICONS.close, 18)}
          </button>
        </div>
        <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-3">
          <NavLinks onNavigate={onClose} />
        </nav>
        <AppearanceControls />
        <div className="mx-4 border-t border-white/10" />
        <div className="bottom-safe p-2.5">
          <ProfileRow onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

/* Mobile top header */
function MobileHeader({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { session } = useSession();
  const centre = session ? findCentre(session.centreId) : null;
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink/[0.05] bg-white/55 dark:bg-paper/45 px-4 backdrop-blur-xl lg:hidden">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="-ml-2 rounded-full p-2 text-ink hover:bg-ink/[0.05]"
      >
        {ic(ICONS.menu, 20)}
      </button>
      <div className="flex items-center gap-2">
        <Image src="/mugis-mark.png" alt="" width={250} height={250} className="h-7 w-7" />
        <span className="text-sm font-bold tracking-tight text-ink">MUGIS</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onSearch} aria-label="Search" className="rounded-full p-2 text-forest-500 hover:bg-ink/[0.05]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-ink">{centre?.code ?? "—"}</span>
      </div>
    </header>
  );
}

/* ---------------- header ---------------- */

const ACTION_DOT: Record<string, string> = {
  create: "bg-sage-600", update: "bg-forest-500", delete: "bg-danger-600",
  export: "bg-gold-500", request: "bg-gold-500", approve: "bg-sage-600",
  reject: "bg-danger-600", view: "bg-soot/40", signin: "bg-soot/40", signout: "bg-soot/40",
};

/** Recent audit activity for this user's scope, with an honest unread dot. */
function ActivityBell() {
  const { state } = useStore();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { setSeen(window.sessionStorage.getItem("mugis.activity.seen")); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const items = useMemo(() => {
    if (!session) return [];
    const all = session.role === "admin" || session.role === "head"
      ? state.audit
      : state.audit.filter((a) => a.userEmail === session.email);
    return all.slice(0, 6);
  }, [state.audit, session]);

  const latest = items[0]?.at ?? null;
  const unread = !!latest && seen !== latest;

  function toggle() {
    setOpen((o) => !o);
    if (latest) {
      setSeen(latest);
      try { window.sessionStorage.setItem("mugis.activity.seen", latest); } catch { /* ignore */ }
    }
  }

  if (!session) return null;
  const auditAccess = session.role === "admin" || session.role === "head";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Recent activity"
        className="relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] text-soot/72 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12] hover:text-ink"
      >
        {ic(ICONS.bell, 15)}
        {unread && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-500" />}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[330px] overflow-hidden rounded-xl border border-white/60 bg-white/90 dark:border-white/[0.08] dark:bg-paper/95 shadow-raised backdrop-blur-xl">
          <p className="border-b border-ink/[0.06] px-3.5 py-2.5 text-[14.5px] font-semibold text-ink">
            Recent activity
          </p>
          <ul className="max-h-[300px] overflow-y-auto py-1">
            {items.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 px-3.5 py-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ACTION_DOT[a.action] ?? "bg-soot/40"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{a.entityLabel}</span>
                  <span className="block text-[13px] text-soot/70">
                    {a.action}{auditAccess ? ` · ${a.userEmail.split("@")[0]}` : ""} · {relTime(a.at, Date.now())}
                  </span>
                </span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-3.5 py-6 text-center text-[14.5px] text-soot/72">No activity yet.</li>
            )}
          </ul>
          <Link
            href={auditAccess ? "/admin/audit" : "/profile"}
            onClick={() => setOpen(false)}
            className="block border-t border-ink/[0.06] bg-white/50 px-3.5 py-2 text-center text-[14px] font-semibold text-forest-500 transition-colors hover:text-forest-600"
          >
            {auditAccess ? "View full audit trail" : "View your activity"}
          </Link>
        </div>
      )}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘K  or  /", "Search patients and pages"],
  ["⌘S", "Save the open episode record"],
  ["↑ ↓ and ↵", "Navigate and open search results"],
  ["Esc", "Close dialogs and menus"],
  ["Tab", "Move between fields; first Tab reveals Skip to content"],
];

/** Demo role switcher — re-signs-in as the seeded user holding that role
 *  (same centre where possible) so record scoping changes live. */
function RoleSwitcher() {
  const { session, signIn } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!session) return null;

  function pick(role: Role) {
    if (!session || role === session.role) { setOpen(false); return; }
    const u = seedUsers().find((x) => x.role === role && x.centreId === session.centreId)
      ?? seedUsers().find((x) => x.role === role);
    if (u) signIn({ email: u.email, name: u.name, role: u.role, centreId: u.centreId });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Viewing as — switch role"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[34px] items-center gap-1.5 rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] px-2.5 text-[14px] font-semibold text-ink shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12]"
      >
        <span className="text-forest-500">{ic(ICONS.users, 13)}</span>
        {ROLE_LABELS[session.role]}
        <span className="text-soot/65">{ic(ICONS.chevron, 12)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] overflow-hidden rounded-xl border border-ink/10 bg-white dark:border-white/[0.08] dark:bg-paper p-1.5 shadow-raised">
          <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-wide text-soot/70">View the registry as</p>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
            const active = r === session.role;
            return (
              <button
                key={r}
                onClick={() => pick(r)}
                className={
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors " +
                  (active ? "bg-forest-50 font-semibold text-forest-600" : "text-ink hover:bg-ink/[0.04]")
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-3.5 shrink-0">
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{ROLE_LABELS[r]}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-[12.5px] text-soot/70">{scopeLabel(r)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Export-approval alert. An approver sees what is waiting on them; a
 * requester sees their own request move. Sits in the header so it follows
 * the user around instead of living on one page they may never open.
 */
function ExportAlert() {
  const { toApprove, myPending, myDecided } = useExportAlerts();

  if (toApprove.length > 0) {
    return (
      <Link
        href="/admin/approvals"
        className="flex h-[34px] items-center gap-2 rounded-[10px] border border-gold-300 bg-gold-100 px-2.5 text-[13px] font-semibold text-goldink transition-colors hover:bg-gold-300/50"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
        </span>
        {toApprove.length} export {toApprove.length === 1 ? "request" : "requests"}
        <span className="hidden xl:inline font-medium text-goldink/70">awaiting you</span>
      </Link>
    );
  }

  if (myDecided) {
    const ok = myDecided.status === "approved";
    return (
      <Link
        href="/reports/export"
        className={"flex h-[34px] items-center gap-2 rounded-[10px] border px-2.5 text-[13px] font-semibold transition-colors " +
          (ok ? "border-sage-600/30 bg-sage-100 text-sage-700 hover:bg-sage-100/70"
              : "border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-50/70")}
      >
        {ic(ok ? ICONS.approvals : ICONS.close, 13)}
        {myDecided.ref} {ok ? "approved" : "refused"}
      </Link>
    );
  }

  if (myPending) {
    return (
      <span
        title={`Submitted ${relTime(myPending.requestedAt, Date.now())} — waiting on an approver`}
        className="flex h-[34px] items-center gap-2 rounded-[10px] border border-line bg-cream px-2.5 text-[13px] font-medium text-soot/80"
      >
        {ic(ICONS.pending, 13)}
        {myPending.ref} pending
      </span>
    );
  }

  return null;
}

function Topbar({ onSearch }: { onSearch: () => void }) {
  const { session } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  if (!session) return null;
  const centre = findCentre(session.centreId);
  return (
    <header className="no-print sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-ink/[0.05] bg-white/55 dark:bg-paper/45 px-5 backdrop-blur-xl lg:top-3 lg:flex lg:rounded-t-[26px]">
      {/* left — which workspace am I in */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          title={centre.name}
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm"
        >
          <span className="text-forest-500">{ic(ICONS.centres, 13)}</span>
          <span className="text-[14px] font-semibold text-ink">{centre.code}</span>
          <span className="hidden max-w-[180px] truncate text-[14px] text-soot/72 xl:inline">{centre.name}</span>
        </span>
      </div>

      {/* right — search, activity, help, reset, you */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onSearch}
          aria-label="Search patients"
          className="group hidden h-11 w-[300px] items-center gap-2.5 rounded-[12px] border border-ink/10 bg-white/85 dark:border-white/[0.12] dark:bg-white/[0.09] pl-3.5 pr-2 text-[15px] text-soot/75 shadow-[0_1px_2px_rgba(10,30,20,0.06)] transition-all hover:border-forest-500/45 hover:bg-white hover:text-ink hover:shadow-[0_2px_10px_rgba(10,30,20,0.10)] dark:hover:bg-white/[0.14] md:flex lg:w-[340px] xl:w-[400px]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"
            className="shrink-0 text-forest-500 transition-transform duration-150 group-hover:scale-110">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span className="flex-1 text-left">Search patients…</span>
          <kbd className="shrink-0 rounded-[7px] border border-ink/10 bg-white/80 dark:bg-white/[0.10] px-2 py-1 text-[12px] font-semibold text-soot/70">⌘K</kbd>
        </button>

        <ExportAlert />

        <span className="h-4 w-px bg-ink/[0.08]" />

        <RoleSwitcher />

        <ActivityBell />

        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] text-soot/72 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12] hover:text-ink"
        >
          {ic(ICONS.help, 15)}
        </button>

        <ResetDemo />

        <span className="h-4 w-px bg-ink/[0.08]" />

        <Link
          href="/profile"
          title={`${session.name} — ${ROLE_LABELS[session.role]} · ${scopeLabel(session.role)}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-500 text-[13px] font-bold text-white ring-2 ring-white/70 dark:ring-white/25 transition-transform hover:scale-105"
        >
          {initials(session.name)}
        </Link>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
        <ul className="divide-y divide-ink/[0.05]">
          {SHORTCUTS.map(([keys, what]) => (
            <li key={keys} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-soot">{what}</span>
              <kbd className="shrink-0 rounded-[8px] border border-ink/10 bg-cream px-2 py-1 text-[13.5px] font-semibold text-ink">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
      </Modal>
    </header>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  // ⌘K / Ctrl+K anywhere; "/" outside form fields
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "/" && !inField) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-forest-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to content
      </a>
      <AppBackdrop />
      <TopCap />
      <Sidebar />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* the floating content sheet — inset so the gradient shows around it */}
      <div className="min-h-screen lg:py-3 lg:pl-[268px] lg:pr-3">
        <div
          className="min-h-screen bg-cream shadow-[0_2px_28px_rgba(0,0,0,0.14)] lg:min-h-[calc(100vh-24px)] lg:rounded-[26px]"
          style={{
            backgroundImage: [
              "radial-gradient(46% 38% at 100% 0%, rgb(var(--wash-a) / 0.07) 0%, rgb(var(--wash-a) / 0) 62%)",
              "radial-gradient(42% 34% at 0% 100%, rgb(var(--bloom) / 0.06) 0%, rgb(var(--bloom) / 0) 62%)",
            ].join(", "),
          }}
        >
          <MobileHeader onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} />
          <Topbar onSearch={() => setSearchOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-[1720px] px-4 pb-16 pt-5 sm:px-5 lg:px-6 lg:pb-10 lg:pt-6 2xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const { ready: storeReady } = useStore();
  if (!ready || !storeReady) return <div className="min-h-screen bg-cream" />;
  if (!session) return <LoginScreen />;
  return <Frame>{children}</Frame>;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <SessionProvider>
        <ThemeProvider>
          <AuthGate>{children}</AuthGate>
        </ThemeProvider>
      </SessionProvider>
    </StoreProvider>
  );
}
