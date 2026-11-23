"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import EnrolTwoFactor from "@/components/EnrolTwoFactor";
import { api, errorText, API_BASE, API_ROLE_LABELS } from "@/lib/api";
import PatientSearch from "@/components/PatientSearch";
import NotificationsDrawer from "@/components/NotificationsDrawer";
import { CLINICAL, SessionProvider, useSession, type Role } from "@/lib/session";
import { Modal } from "@/components/ui";
import { ACCENTS, ThemeProvider, useTheme } from "@/lib/theme";
import { initials } from "@/lib/format";

/** soon: the screen exists but its API does not yet — shown with a tag. */
type NavItem = { href: string; label: string; icon: React.ReactNode; roles?: Role[]; soon?: boolean };
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
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
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
      { href: "/reports", label: "Reports", icon: ic(ICONS.reports), soon: true },
      { href: "/reports/export", label: "Data Export", icon: ic(ICONS.export) },
    ],
  },
  {
    title: "Registry",
    items: [
      { href: "/patients", label: "Patients", icon: ic(ICONS.patients), roles: CLINICAL },
      { href: "/patients/new", label: "New Patient", icon: ic(ICONS.add), roles: CLINICAL },
      { href: "/patients/access-requests", label: "Access Requests", icon: ic(ICONS.approvals), roles: CLINICAL },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/admin/registrations",
        label: "Registrations",
        icon: ic(ICONS.approvals),
        roles: ["admin", "head", "hod"],
      },
      { href: "/admin/users", label: "Users", icon: ic(ICONS.users), roles: ["admin"] },
      { href: "/admin/centres", label: "Centres", icon: ic(ICONS.centres), roles: ["admin"] },
      { href: "/admin/forms", label: "Cancer Forms", icon: ic(ICONS.episode), roles: ["admin"] },
      {
        href: "/admin/audit",
        label: "Audit Trail",
        icon: ic(ICONS.audit),
        roles: ["admin", "head"],
        soon: true,
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

/** Applications waiting for this reviewer (admin, head, HOD); 0 for others. */
function usePendingRegistrations(): number {
  const { session } = useSession();
  const reviewer = session?.role === "admin" || session?.role === "head" || session?.role === "hod";
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!reviewer) return;
    let alive = true;
    const load = () => api.registrations({ page_size: 1 })
      .then((r) => { if (alive) setN(r.page.total); })
      .catch(() => undefined);
    load();
    const t = window.setInterval(load, 60_000);
    window.addEventListener("mugis:registrations-changed", load);
    return () => { alive = false; window.clearInterval(t); window.removeEventListener("mugis:registrations-changed", load); };
  }, [reviewer]);
  return reviewer ? n : 0;
}

/** Requests waiting on this clinician's decision (owner, or HOD for a departed owner). */
function usePendingAccessRequests(): number {
  const { session } = useSession();
  const clinical = !!session && CLINICAL.includes(session.role);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!clinical) return;
    let alive = true;
    const load = () => api.accessRequests({ box: "incoming", status: "pending", page_size: 1 })
      .then((r) => { if (alive) setN(r.page.total); })
      .catch(() => undefined);
    load();
    const t = window.setInterval(load, 60_000);
    window.addEventListener("mugis:access-requests-changed", load);
    return () => { alive = false; window.clearInterval(t); window.removeEventListener("mugis:access-requests-changed", load); };
  }, [clinical]);
  return clinical ? n : 0;
}

/** Badges: only things waiting on this user, from the API. */
function useLiveNavCounts(): Record<string, number> {
  const pendingRegs = usePendingRegistrations();
  const pendingAccess = usePendingAccessRequests();
  const counts: Record<string, number> = {};
  if (pendingRegs) counts["/admin/registrations"] = pendingRegs;
  if (pendingAccess) counts["/patients/access-requests"] = pendingAccess;
  return counts;
}

/**
 * The counts are polled once, in Frame, and shared: the sidebar, the phone
 * menu and the tab bar all show them, and three pollers would be three times
 * the requests.
 */
const NavCounts = createContext<Record<string, number>>({});
const useNavCounts = () => useContext(NavCounts);

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
      className="pointer-events-none fixed inset-0 z-20 hidden xl:block"
      style={{ ...BACKDROP, clipPath: "inset(0 0 calc(100% - 12px) 0)" }}
    />
  );
}

function Logo() {
  return (
    <Link href="/" className="flex min-h-[44px] items-center gap-2.5 px-1">
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
                  "mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all duration-150 touch:py-3 " +
                  (active
                    ? "bg-white/15 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md"
                    : "font-medium text-white/60 hover:bg-white/[0.07] hover:text-white")
                }
              >
                <span className={"shrink-0 " + (active ? "text-white" : "text-white/40")}>{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.soon && (
                  <span className="ml-auto shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    Soon
                  </span>
                )}
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
              "flex h-6 w-7 items-center justify-center rounded-[7px] transition-colors touch:h-10 touch:w-11 " +
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
              "flex h-6 w-7 items-center justify-center rounded-[7px] transition-colors touch:h-10 touch:w-11 " +
              (mode === "dark" ? "bg-white/90 text-black/75" : "text-white/45 hover:text-white/80")
            }
          >
            {ic(ICONS.moon, 13)}
          </button>
        </div>
      </div>
      {/* Each button is a 40px target on touch; the colour dot inside stays small. */}
      <div className="mt-2 grid grid-cols-5 justify-items-center" role="group" aria-label="Accent colour">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAccent(a.id)}
            title={a.label}
            aria-label={`${a.label} theme`}
            aria-pressed={accent === a.id}
            className="group flex h-7 w-full max-w-10 items-center justify-center touch:h-10"
          >
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full transition-all touch:h-7 touch:w-7 " +
                (accent === a.id ? "ring-2 ring-white/85" : "ring-1 ring-white/20 group-hover:ring-white/55")
              }
              style={{ background: a.swatch }}
            >
              {accent === a.id && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4.5 4.5L19 7" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Running backend version, from GET /health. Fetched once per page load. */
let versionPromise: Promise<string> | null = null;
function loadVersion(): Promise<string> {
  versionPromise ??= fetch(`${API_BASE}/health`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => (typeof j?.data?.version === "string" && j.data.version ? j.data.version : "—"))
    .catch(() => {
      versionPromise = null; // retry on the next mount
      return "—";
    });
  return versionPromise;
}

function VersionLabel() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadVersion().then((v) => live && setVersion(v));
    return () => {
      live = false;
    };
  }, []);
  return (
    <p className="px-4 pb-3 text-[11px] text-white/45" title="Backend version">
      Version {version ?? "…"}
    </p>
  );
}

/* Desktop sidebar — lives directly on the brand gradient */
function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col xl:flex">
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
      <VersionLabel />
    </aside>
  );
}

/* Phone menu — the full navigation, opened from the tab bar's Menu tab.
   Slides in from the right, the side that tab sits on. */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useSession();

  // The page behind must not scroll under the menu.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="mg-menu absolute inset-y-0 right-0 flex w-[85%] max-w-xs flex-col overflow-hidden shadow-raised short:overflow-y-auto"
        style={{
          backgroundColor: "var(--bd-base)",
          backgroundImage: [
            "radial-gradient(55% 45% at 10% 104%, rgb(var(--bloom) / var(--bloom-o)) 0%, rgb(var(--bloom) / 0) 60%)",
            "radial-gradient(70% 60% at 0% 0%, rgb(var(--glow-a) / 0.85) 0%, rgb(var(--glow-a) / 0) 70%)",
          ].join(", "),
        }}
      >
        <div className="pt-safe">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <Logo />
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              {ic(ICONS.close, 18)}
            </button>
          </div>
          {session && (
            <p className="truncate px-5 pb-1 text-[13px] text-white/55">
              {API_ROLE_LABELS[session.apiRole]} · {session.centreName}
            </p>
          )}
        </div>
        {/* On a sideways phone the whole drawer scrolls, not a sliver of it. */}
        <nav className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3 short:flex-none short:overflow-visible">
          <NavLinks onNavigate={onClose} />
        </nav>
        <AppearanceControls />
        <div className="mx-4 border-t border-white/10" />
        <div className="p-2.5">
          <ProfileRow onNavigate={onClose} />
        </div>
        <div className="pb-safe">
          <VersionLabel />
        </div>
      </div>
    </div>
  );
}

/* Phone top bar: where am I (logo, centre) and search. Navigation is the tab bar. */
function MobileHeader({ onSearch, onNotifications }: { onSearch: () => void; onNotifications: () => void }) {
  const { session } = useSession();
  const clinical = !!session && CLINICAL.includes(session.role);
  return (
    <header className="no-print pt-safe sticky top-0 z-30 border-b border-ink/[0.05] bg-white/70 dark:bg-paper/60 backdrop-blur-xl short:static xl:hidden">
      <div className="flex h-14 items-center justify-between gap-2 pl-3 pr-3 sm:pl-5 sm:pr-4">
        <Link href="/" className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-1" aria-label="MUGIS — home">
          <Image src="/mugis-mark.png" alt="" width={250} height={250} className="h-7 w-7 shrink-0" />
          {/* Below 360px the clinical header also carries search and the bell: the mark alone fits. */}
          <span className={`text-sm font-bold tracking-tight text-ink ${clinical ? "hidden xs:inline" : ""}`}>MUGIS</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {clinical && (
            <button onClick={onSearch} aria-label="Search patients"
              className="flex h-11 w-11 items-center justify-center rounded-full text-forest-500 hover:bg-ink/[0.05]">
              {ic(ICONS.search, 21)}
            </button>
          )}
          <NotificationBell onOpen={onNotifications} compact />
          <CentreSwitcher align="right" />
        </div>
      </div>
    </header>
  );
}

/**
 * True while a text field has focus on a phone — the on-screen keyboard is up,
 * and the tab bar would otherwise ride on top of it and hide what is typed.
 */
function usePhoneTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia("(pointer: coarse) and (max-width: 767px)");
    const isField = (el: Element | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/.test(el.type)) ||
      (el instanceof HTMLElement && el.isContentEditable);
    const onIn = (e: FocusEvent) => { if (phone.matches && isField(e.target as Element)) setTyping(true); };
    const onOut = () => window.setTimeout(() => { if (!isField(document.activeElement)) setTyping(false); }, 0);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);
  return typing;
}

/**
 * Tab bar for phones and tablets — the four places a role goes most, one
 * thumb-tap away, and Menu for everything else. Hidden from `xl`, where the
 * sidebar takes over.
 */
function TabBar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname();
  const { session } = useSession();
  const counts = useNavCounts();
  const typing = usePhoneTyping();
  if (!session) return null;

  type Tab = { href: string; label: string; icon: React.ReactNode; primary?: boolean };
  const tabs: Tab[] = CLINICAL.includes(session.role)
    ? [
        { href: "/", label: "Home", icon: ic(ICONS.dashboard, 22) },
        { href: "/patients", label: "Patients", icon: ic(ICONS.patients, 22) },
        { href: "/patients/new", label: "New", icon: ic(ICONS.plus, 20), primary: true },
        { href: "/patients/access-requests", label: "Requests", icon: ic(ICONS.approvals, 22) },
      ]
    : [
        { href: "/", label: "Home", icon: ic(ICONS.dashboard, 22) },
        { href: "/admin/registrations", label: "Sign-ups", icon: ic(ICONS.approvals, 22) },
        { href: "/admin/users", label: "Users", icon: ic(ICONS.users, 22) },
        { href: "/admin/centres", label: "Centres", icon: ic(ICONS.centres, 22) },
      ];
  // Anything waiting that has no tab of its own shows as a dot on Menu.
  const elsewhere = Object.entries(counts).some(([href, n]) => n > 0 && !tabs.some((t) => t.href === href));
  const cell = "relative flex min-w-0 flex-col items-center justify-center gap-[3px] text-[12px] leading-none transition-colors";
  // Labels stay readable to screen readers when a short screen hides them.
  const text = "max-w-full truncate px-0.5 tracking-tight short:sr-only";

  return (
    <nav aria-label="Primary"
      className={"no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-ink/[0.06] bg-paper/90 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] shadow-nav backdrop-blur-xl transition-transform duration-200 xl:hidden " +
        (typing ? "translate-y-full" : "")}>
      <div className="mx-auto grid h-[58px] max-w-xl grid-cols-5 short:h-11">
        {tabs.map((t) => {
          const active = !menuOpen && isActive(pathname, t.href);
          const count = counts[t.href];
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={cell + " " + (active ? "font-semibold text-forest-600" : "font-medium text-soot/80")}>
              <span className={"relative flex h-7 items-center justify-center " +
                (t.primary ? "w-11 rounded-[10px] bg-forest-500 text-white shadow-[0_2px_8px_rgb(var(--color-forest-500)/0.35)]" : "w-7")}>
                {t.icon}
                {!!count && (
                  <span className="absolute -right-2.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold tabular-nums text-goldink ring-2 ring-paper">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className={text}>{t.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen}
          className={cell + " " + (menuOpen ? "font-semibold text-forest-600" : "font-medium text-soot/80")}>
          <span className="relative flex h-7 w-7 items-center justify-center">
            {ic(ICONS.menu, 22)}
            {elsewhere && <span className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full bg-gold-500 ring-2 ring-paper" />}
          </span>
          <span className={text}>Menu</span>
        </button>
      </div>
    </nav>
  );
}

/* ---------------- header ---------------- */

/** Bell for the clinical roles: opens the notifications drawer. The badge
 *  counts access requests waiting on this user's decision. */
function NotificationBell({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const { session } = useSession();
  const counts = useNavCounts();
  if (!session || !CLINICAL.includes(session.role)) return null;
  const n = counts["/patients/access-requests"] ?? 0;
  return (
    <button
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={n ? `Notifications, ${n} waiting for your decision` : "Notifications"}
      title="Notifications"
      className={compact
        ? "relative flex h-11 w-11 items-center justify-center rounded-full text-forest-500 hover:bg-ink/[0.05]"
        : "relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/60 bg-white/60 text-soot/72 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 hover:text-ink dark:border-white/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] touch:h-11 touch:w-11"}
    >
      {ic(ICONS.bell, compact ? 21 : 16)}
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold tabular-nums text-goldink ring-2 ring-paper">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘K  or  /", "Search patients"],
  ["↑ ↓ and ↵", "Navigate and open search results"],
  ["Esc", "Close dialogs and menus"],
  ["Tab", "Move between fields; first Tab reveals Skip to content"],
];

/** Centre switcher — only for someone who belongs to more than one centre
 *  (a fellow on rotation). Calls /auth/switch-centre; otherwise a plain
 *  badge naming the centre the session works in. */
function CentreSwitcher({ align = "left" }: { align?: "left" | "right" }) {
  const { session, switchCentre } = useSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const centres = session.user.centres;
  const badge = (
    <>
      <span className="text-forest-500">{ic(ICONS.centres, 13)}</span>
      <span className="text-[14px] font-semibold text-ink">{session.centreCode}</span>
      <span className="hidden max-w-[220px] truncate text-[14px] text-soot/72 md:inline">{session.centreName}</span>
    </>
  );
  const chip = "flex shrink-0 items-center gap-1.5 rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] px-2.5 py-1.5 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm touch:min-h-[40px]";
  const side = align === "right" ? "right-0" : "left-0";

  if (centres.length < 2) return <span title={session.centreName} className={chip}>{badge}</span>;

  async function pick(id: string) {
    setOpen(false);
    if (id === session?.user.active_centre_id) return;
    try {
      setError(null);
      await switchCentre(id);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch centre"
        aria-haspopup="menu"
        aria-expanded={open}
        className={chip + " transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12]"}
      >
        {badge}
        <span className="text-soot/65">{ic(ICONS.chevron, 12)}</span>
      </button>
      {error && <p className={`absolute ${side} top-[calc(100%+6px)] z-50 w-64 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700`}>{error}</p>}
      {open && (
        <div className={`absolute ${side} top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-ink/10 bg-white dark:border-white/[0.08] dark:bg-paper p-1.5 shadow-raised`}>
          <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-wide text-soot/70">Work in centre</p>
          {centres.map((c) => {
            const active = c.id === session.user.active_centre_id;
            return (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                className={
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors touch:py-3 " +
                  (active ? "bg-forest-50 font-semibold text-forest-600" : "text-ink hover:bg-ink/[0.04]")
                }
              >
                <span className="min-w-0 break-words">{c.name}</span>
                <span className="shrink-0 text-[12.5px] text-soot/70">{c.code}{c.is_primary ? " · primary" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Topbar({ onSearch, onNotifications }: { onSearch: () => void; onNotifications: () => void }) {
  const { session } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  if (!session) return null;
  return (
    <header className="no-print sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-ink/[0.05] bg-white/55 dark:bg-paper/45 px-5 backdrop-blur-xl xl:top-3 xl:flex xl:rounded-t-[26px]">
      {/* left — which workspace am I in */}
      <div className="flex min-w-0 items-center gap-3">
        <CentreSwitcher />
        <span className="hidden text-[13.5px] font-medium text-soot/72 xl:inline">{API_ROLE_LABELS[session.apiRole]}</span>
      </div>

      {/* right — search, activity, help, reset, you */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onSearch}
          aria-label="Search patients"
          className="group flex h-11 w-[340px] items-center gap-2.5 rounded-[12px] border border-ink/10 bg-white/85 dark:border-white/[0.12] dark:bg-white/[0.09] pl-3.5 pr-2 text-[15px] text-soot/75 shadow-[0_1px_2px_rgba(10,30,20,0.06)] transition-all hover:border-forest-500/45 hover:bg-white hover:text-ink hover:shadow-[0_2px_10px_rgba(10,30,20,0.10)] dark:hover:bg-white/[0.14] 2xl:w-[400px]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"
            className="shrink-0 text-forest-500 transition-transform duration-150 group-hover:scale-110">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span className="flex-1 text-left">Search patients…</span>
          <kbd className="shrink-0 rounded-[7px] border border-ink/10 bg-white/80 dark:bg-white/[0.10] px-2 py-1 text-[12px] font-semibold text-soot/70">⌘K</kbd>
        </button>


        <span className="h-4 w-px bg-ink/[0.08]" />


        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/60 bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.06] text-soot/72 shadow-[0_0_0_1px_rgba(10,30,20,0.04)] backdrop-blur-sm transition-colors hover:bg-white/90 dark:hover:bg-white/[0.12] hover:text-ink touch:h-11 touch:w-11"
        >
          {ic(ICONS.help, 15)}
        </button>


        <NotificationBell onOpen={onNotifications} />

        <span className="h-4 w-px bg-ink/[0.08]" />

        <Link
          href="/profile"
          title={`${session.name} — ${API_ROLE_LABELS[session.apiRole]}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-500 text-[13px] font-bold text-white ring-2 ring-white/70 dark:ring-white/25 transition-transform hover:scale-105 touch:h-11 touch:w-11"
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
  const [notesOpen, setNotesOpen] = useState(false);
  const closeNotes = React.useCallback(() => setNotesOpen(false), []);
  const pathname = usePathname();
  const counts = useLiveNavCounts();
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setNotesOpen(false); }, [pathname]);

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
    <NavCounts.Provider value={counts}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-forest-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to content
      </a>
      <AppBackdrop />
      <TopCap />
      <Sidebar />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <PatientSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsDrawer open={notesOpen} onClose={closeNotes} />
      {/* the floating content sheet — inset so the gradient shows around it */}
      <div className="min-h-app xl:py-3 xl:pl-[268px] xl:pr-3">
        <div
          className="min-h-app bg-cream shadow-[0_2px_28px_rgba(0,0,0,0.14)] xl:min-h-[calc(100vh-24px)] xl:rounded-[26px]"
          style={{
            backgroundImage: [
              "radial-gradient(46% 38% at 100% 0%, rgb(var(--wash-a) / 0.07) 0%, rgb(var(--wash-a) / 0) 62%)",
              "radial-gradient(42% 34% at 0% 100%, rgb(var(--bloom) / 0.06) 0%, rgb(var(--bloom) / 0) 62%)",
            ].join(", "),
          }}
        >
          <MobileHeader onSearch={() => setSearchOpen(true)} onNotifications={() => setNotesOpen(true)} />
          <Topbar onSearch={() => setSearchOpen(true)} onNotifications={() => setNotesOpen(true)} />
          {/* bottom padding clears the tab bar (--tabbar-h is 0 from xl) */}
          <main id="main" className="mx-auto w-full max-w-[1720px] px-4 pb-[calc(var(--tabbar-h)+1.75rem)] pt-5 sm:px-6 xl:pb-10 xl:pt-6 2xl:px-8">
            {children}
          </main>
        </div>
      </div>
      <TabBar onMenu={() => setMenuOpen((o) => !o)} menuOpen={menuOpen} />
    </NavCounts.Provider>
  );
}

/** Pages reachable signed out: they come from email links or the sign-in screen. */
const PUBLIC_PATHS = ["/register", "/activate", "/accept-invitation", "/forgot-password", "/reset-password"];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { phase } = useSession();
  const pathname = usePathname();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return <>{children}</>;
  if (phase === "loading") return <div className="min-h-screen bg-cream" />;
  if (phase === "out") return <LoginScreen />;
  if (phase === "enrol") return <EnrolTwoFactor />;
  return <Frame>{children}</Frame>;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AuthGate>{children}</AuthGate>
      </ThemeProvider>
    </SessionProvider>
  );
}
