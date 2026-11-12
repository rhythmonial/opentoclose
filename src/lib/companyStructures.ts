export const COMPANY_STRUCTURES = [
  "Real Estate Brokerage",
  "Real Estate Team",
  "Independent TC",
  "Team of TC's",
];

// Earlier answers, so returning clients keep their pick.
export const RENAMED_STRUCTURES: Record<string, string> = {
  Brokerage: "Real Estate Brokerage",
  "RE Team": "Real Estate Team",
  "TC Team": "Team of TC's",
  "Individual TC": "Independent TC",
};

// A saved structure as one of today's choices ("" if it isn't one).
export function currentStructure(saved: string | null | undefined) {
  const s = saved ?? "";
  return RENAMED_STRUCTURES[s] ?? (COMPANY_STRUCTURES.includes(s) ? s : "");
}
