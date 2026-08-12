/**
 * MUGIS participating centres — the confirmed list from the MUGIS committee:
 * HPP, IKN/IEP, HSA, HSNZKT, HUS, QEH1.
 *
 * Centre code drives record scoping: a Clinician only ever sees their own
 * entries, an HOD sees their whole centre, and the Head of Service sees
 * every centre.
 */
export type Centre = {
  id: string;
  code: string;
  name: string;
  state: string;
};

export const CENTRES: Centre[] = [
  { id: "hpp", code: "HPP", name: "Hospital Pulau Pinang", state: "Pulau Pinang" },
  { id: "ikn", code: "IKN/IEP", name: "Institut Kanser Negara / Institut Endokrin Putrajaya", state: "WP Putrajaya" },
  { id: "hsa", code: "HSA", name: "Hospital Sultanah Aminah", state: "Johor" },
  { id: "hsnzkt", code: "HSNZKT", name: "Hospital Sultanah Nur Zahirah", state: "Terengganu" },
  { id: "hus", code: "HUS", name: "Hospital Umum Sarawak", state: "Sarawak" },
  { id: "qeh1", code: "QEH1", name: "Hospital Queen Elizabeth I", state: "Sabah" },
];

export function findCentre(id: string): Centre {
  return CENTRES.find((c) => c.id === id) ?? CENTRES[0];
}
