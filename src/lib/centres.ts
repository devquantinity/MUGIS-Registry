/**
 * MUGIS participating centres.
 *
 * PLACEHOLDER DATA — replace with the confirmed MUGIS centre list before
 * go-live. Centre code drives record scoping: a Clinician only ever sees
 * their own entries, an HOD sees their whole centre, and the Head of
 * Service sees every centre.
 */
export type Centre = {
  id: string;
  code: string;
  name: string;
  state: string;
};

export const CENTRES: Centre[] = [
  { id: "hkl", code: "HKL", name: "Hospital Kuala Lumpur", state: "WP Kuala Lumpur" },
  { id: "hs", code: "HSgB", name: "Hospital Sungai Buloh", state: "Selangor" },
  { id: "hussm", code: "HUSM", name: "Hospital Universiti Sains Malaysia", state: "Kelantan" },
  { id: "hpp", code: "HPP", name: "Hospital Pulau Pinang", state: "Pulau Pinang" },
  { id: "hqe", code: "HQE", name: "Hospital Queen Elizabeth", state: "Sabah" },
  { id: "hus", code: "HUS", name: "Hospital Umum Sarawak", state: "Sarawak" },
];

export function findCentre(id: string): Centre {
  return CENTRES.find((c) => c.id === id) ?? CENTRES[0];
}
