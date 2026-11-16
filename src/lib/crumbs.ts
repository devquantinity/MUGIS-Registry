/**
 * Breadcrumb trail per route. Lives outside the shell so the page header can
 * render it — the top bar was too crowded to carry it as well.
 */
export type Crumb = { label: string; href?: string };

const CRUMBS: [RegExp, Crumb[]][] = [
  [/^\/$/, [{ label: "Overview" }]],
  [/^\/patients\/access-requests/, [{ label: "Registry" }, { label: "Access requests" }]],
  [/^\/patients\/new/, [{ label: "Registry" }, { label: "Patients", href: "/patients" }, { label: "New patient" }]],
  [/^\/patients\/[^/]+/, [{ label: "Registry" }, { label: "Patients", href: "/patients" }, { label: "Patient record" }]],
  [/^\/patients/, [{ label: "Registry" }, { label: "Patients" }]],
  [/^\/episodes\/[^/]+/, [{ label: "Registry" }, { label: "Patients", href: "/patients" }, { label: "Cancer record" }]],
  [/^\/admin\/forms/, [{ label: "Administration" }, { label: "Cancer forms" }]],
  [/^\/reports\/export/, [{ label: "Reports", href: "/reports" }, { label: "Data export" }]],
  [/^\/reports/, [{ label: "Reports" }]],
  [/^\/admin\/approvals/, [{ label: "Administration" }, { label: "Export approvals" }]],
  [/^\/admin\/users/, [{ label: "Administration" }, { label: "Users" }]],
  [/^\/admin\/centres/, [{ label: "Administration" }, { label: "Centres" }]],
  [/^\/admin\/audit/, [{ label: "Administration" }, { label: "Audit trail" }]],
  [/^\/profile/, [{ label: "Account" }, { label: "Profile" }]],
];

export function crumbsFor(pathname: string): Crumb[] {
  return CRUMBS.find(([re]) => re.test(pathname))?.[1] ?? [{ label: "MUGIS" }];
}
