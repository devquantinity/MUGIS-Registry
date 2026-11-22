"use client";

/**
 * Notifications: access requests waiting on you, and your own requests still
 * pending. Opened from the bell in the header; slides in from the right, full
 * width on a phone.
 */

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { api, errorText, API_ROLE_LABELS, type AccessRequest } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui";

const LIMIT = 10;

type Box = { items: AccessRequest[]; total: number } | null;

export default function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [incoming, setIncoming] = useState<Box>(null);
  const [outgoing, setOutgoing] = useState<Box>(null);
  const [error, setError] = useState<string | null>(null);

  // Fresh every time it opens, and when a request is decided elsewhere.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () => {
      setError(null);
      Promise.all([
        api.accessRequests({ box: "incoming", status: "pending", page_size: LIMIT }),
        api.accessRequests({ box: "outgoing", status: "pending", page_size: LIMIT }),
      ])
        .then(([i, o]) => {
          if (!alive) return;
          setIncoming({ items: i.items, total: i.page.total });
          setOutgoing({ items: o.items, total: o.page.total });
        })
        .catch((e) => { if (alive) setError(errorText(e)); });
    };
    load();
    window.addEventListener("mugis:access-requests-changed", load);
    return () => { alive = false; window.removeEventListener("mugis:access-requests-changed", load); };
  }, [open]);

  // Esc closes; the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notifications">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="mg-menu absolute inset-y-0 right-0 flex w-full flex-col bg-cream shadow-raised sm:w-[400px] sm:rounded-l-[22px]">
        <div className="pt-safe border-b border-ink/[0.06]">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-[17px] font-semibold text-ink">Notifications</h2>
            <button onClick={onClose} aria-label="Close notifications" autoFocus
              className="flex h-11 w-11 items-center justify-center rounded-full text-soot hover:bg-ink/[0.06] hover:text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pb-safe flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
          {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
          <Section
            title="Access requests for you"
            hint="Pending your decision"
            box={incoming}
            empty="Nothing waiting for your decision."
            href="/patients/access-requests"
            onNavigate={onClose}
            render={(r) => (
              <>
                <p className="truncate text-sm font-medium text-ink">
                  {r.requester.full_name || r.requester.email}
                </p>
                <p className="text-[13px] text-soot/80">
                  {API_ROLE_LABELS[r.requester.role]} · asks to {r.permission}{" "}
                  <span className="whitespace-nowrap font-mono">{r.registry_no ?? "a patient"}</span>
                </p>
              </>
            )}
          />
          <Section
            title="Your requests"
            hint="Still pending"
            box={outgoing}
            empty="You have no pending requests."
            href="/patients/access-requests?box=outgoing"
            onNavigate={onClose}
            render={(r) => (
              <>
                <p className="truncate text-sm font-medium text-ink">
                  {r.registry_no ? <span className="font-mono">{r.registry_no}</span> : "A patient record"}
                </p>
                <p className="text-[13px] text-soot/80">{r.permission === "edit" ? "Edit" : "View"} access · awaiting a decision</p>
              </>
            )}
          />
        </div>
      </aside>
    </div>
  );
}

function Section({ title, hint, box, empty, href, onNavigate, render }: {
  title: string; hint: string; box: Box; empty: string; href: string;
  onNavigate: () => void; render: (r: AccessRequest) => React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[14.5px] font-semibold text-ink">
          {title}
          {box && box.total > 0 && <Badge tone="warn" className="ml-2 align-middle">{box.total}</Badge>}
        </h3>
        <span className="text-[12.5px] text-soot/65">{hint}</span>
      </div>
      {box === null ? <p className="text-sm text-soot/72">Loading…</p> : box.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/10 px-3 py-3 text-[13.5px] text-soot/75">{empty}</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-ink/[0.06] bg-paper/80 dark:bg-white/[0.04]">
          {box.items.map((r) => (
            <li key={r.id} className="border-b border-ink/[0.05] last:border-b-0">
              <Link href={href} onClick={onNavigate} className="flex items-start gap-3 px-3 py-2.5 hover:bg-ink/[0.03] touch:py-3">
                <div className="min-w-0 flex-1">{render(r)}</div>
                <span className="shrink-0 pt-0.5 text-[12.5px] text-soot/65">{fmtDate(r.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={href} onClick={onNavigate} className="mt-2 inline-block text-[13px] font-semibold text-forest-600 touch:py-2">
        {box && box.total > box.items.length ? `View all ${box.total}` : "Open access requests"}
      </Link>
    </section>
  );
}
