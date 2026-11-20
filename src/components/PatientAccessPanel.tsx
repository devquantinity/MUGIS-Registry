"use client";

/**
 * Who holds or has asked for access to a patient, for whoever manages it: the
 * doctor who added the patient, or — once they have left — a Head of
 * Department of the centre. Renders nothing for anyone else (the API answers
 * 403). Sharing gives a colleague the personal data at once (view), plus
 * editing the patient and continuing the cancer records (edit).
 */
import { useCallback, useEffect, useState } from "react";
import { api, API_ROLE_LABELS, ApiError, errorText, type AccessRequest } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Badge, Card, SectionTitle } from "@/components/ui";

export default function PatientAccessPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<AccessRequest[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.patientAccess(patientId)
      .then((r) => setItems(r.items))
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setHidden(true);
        else setError(errorText(e));
      });
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (hidden) return null;

  async function share(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await api.sharePatientAccess(patientId, email.trim(), permission);
      setEmail("");
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(g: AccessRequest) {
    setBusy(true); setError(null);
    try {
      await api.revokePatientAccess(patientId, g.id);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>People with access</SectionTitle>
      <p className="text-[13px] text-soot/80">
        Only they see this patient&apos;s name and identity number. Others who can see the record get age, sex and the cancer records.
      </p>
      {items === null ? (
        !error && <p className="mt-3 text-[13.5px] text-soot/72">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-soot/80">Nobody else yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {items.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{g.requester.full_name || g.requester.email}</p>
                <p className="text-[12.5px] text-soot/72">
                  {API_ROLE_LABELS[g.requester.role]} · {g.permission === "edit" ? "View and edit" : "View"}
                  {g.status === "approved" && g.decided_at ? ` · since ${fmtDate(g.decided_at)}` : ""}
                </p>
              </div>
              {g.status === "pending" ? (
                <Badge tone="warn">Asked</Badge>
              ) : (
                <button className="shrink-0 text-[13px] font-semibold text-danger-700 hover:underline disabled:opacity-50 touch:-my-1 touch:py-2.5"
                  onClick={() => revoke(g)} disabled={busy}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={share} className="mt-4 grid grid-cols-1 gap-2" noValidate>
        <label className="label" htmlFor="share-email">Share with a colleague</label>
        <input id="share-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@hospital.gov.my" maxLength={254} />
        <div className="flex flex-wrap items-center gap-3 text-[13.5px] text-ink">
          <label className="flex items-center gap-1.5 touch:min-h-[44px]">
            <input type="radio" name="share-permission" checked={permission === "view"} onChange={() => setPermission("view")} /> View
          </label>
          <label className="flex items-center gap-1.5 touch:min-h-[44px]">
            <input type="radio" name="share-permission" checked={permission === "edit"} onChange={() => setPermission("edit")} /> View and edit
          </label>
          <button type="submit" className="btn-primary ml-auto" disabled={busy || !email.trim()}>{busy ? "Sharing…" : "Share"}</button>
        </div>
      </form>
      {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
    </Card>
  );
}
