"use client";

/**
 * Warning before removing a cancer record. Only the doctor who added the
 * patient may remove its records; the server checks that too.
 */
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { Modal } from "@/components/ui";

export default function RemoveEpisodeDialog({ episode, onClose, onRemoved }: {
  episode: { id: string; cancer_type_name: string; progress: { filled: number; total: number } } | null;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!episode || busy) return;
    setBusy(true); setError(null);
    try {
      await api.removeEpisode(episode.id);
      onRemoved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal open={!!episode} onClose={() => { if (!busy) { setError(null); onClose(); } }} title="Remove cancer record?">
      {episode && (
        <>
          <div className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-[13.5px] text-danger-700">
            <p className="font-semibold">This removes the {episode.cancer_type_name} record and everything entered in it
              ({episode.progress.filled} of {episode.progress.total} fields).</p>
            <p className="mt-1">It will no longer appear for you or anyone else, and it cannot be restored from the registry.</p>
          </div>
          {error && <p className="mt-3 text-[13.5px] text-danger-700">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
            <button className="btn bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-60" onClick={remove} disabled={busy}>
              {busy ? "Removing…" : "Remove record"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
