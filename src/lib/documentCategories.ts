// Document categories for Categorize Your Documents: the starter ones every
// client has, plus any they add (saved in document_categories, with ids
// "custom:<id>"). Lists are always shown A to Z.

export type CategoryColor = "green" | "yellow" | "red" | "blue" | "purple" | "gray";

export type DocCategory = { id: string; name: string; color: CategoryColor };

const STARTERS: [string, CategoryColor][] = [
  ["Brokerage", "green"],
  ["General", "green"],
  ["Residential", "yellow"],
  ["Land", "yellow"],
  ["Cash", "yellow"],
  ["Loan", "yellow"],
  ["Appraisal", "yellow"],
  ["New Construction", "yellow"],
  ["Rental", "yellow"],
  ["Property Disclosure", "red"],
  ["Inspection", "red"],
  ["Septic", "red"],
  // Kept as "termite" (its id) so earlier picks stay.
  ["Termite/Pest", "red"],
  ["Well", "red"],
  ["Radon", "red"],
  ["Pool", "red"],
  ["Survey", "red"],
  ["Solar", "red"],
  ["Home Warranty", "red"],
  ["HOA", "red"],
  ["LBP", "red"],
  ["Referral", "red"],
  ["Cancellation", "red"],
  ["Photography", "blue"],
  ["For Sale Sign", "blue"],
  ["Open House", "blue"],
];

export const STARTER_CATEGORIES: DocCategory[] = STARTERS.map(([name, color]) => ({
  id: name === "Termite/Pest" ? "termite" : name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  name,
  color,
}));

export const CUSTOM_PREFIX = "custom:";

// Swatch and chip colors (the starter ones match the pale sheet colors).
export const CATEGORY_COLORS: Record<CategoryColor, { swatch: string; chip: string }> = {
  green: { swatch: "bg-[#d9ead3]", chip: "bg-[#d9ead3] border-[#b6d7a8]" },
  yellow: { swatch: "bg-[#ffe599]", chip: "bg-[#fff2cc] border-[#ffe599]" },
  red: { swatch: "bg-[#f4cccc]", chip: "bg-[#f4cccc] border-[#ea9999]" },
  blue: { swatch: "bg-[#cfe2f3]", chip: "bg-[#cfe2f3] border-[#9fc5e8]" },
  purple: { swatch: "bg-[#d9d2e9]", chip: "bg-[#d9d2e9] border-[#b4a7d6]" },
  gray: { swatch: "bg-[#e5e7eb]", chip: "bg-[#eef0f2] border-[#d1d5db]" },
};

export const COLOR_NAMES = Object.keys(CATEGORY_COLORS) as CategoryColor[];

export const sortByName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

export const SIDES = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "listing", label: "Listing" },
] as const;

export type Side = (typeof SIDES)[number]["value"];

// A document template is named for its category, prefixed with the sides it
// covers: "S Appraisal", "B/S Appraisal", "B/S/L General".
const SIDE_LETTERS: Record<Side, string> = { buyer: "B", seller: "S", listing: "L" };
// Always in B, S, L order.
export function templatePrefix(sides: string[]) {
  return (["buyer", "seller", "listing"] as const)
    .filter((side) => sides.includes(side))
    .map((side) => SIDE_LETTERS[side])
    .join("/");
}

// How much a document matters to their files.
export const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Med" },
  { value: "low", label: "Low" },
] as const;

// The template sides (buyer, seller, listing) for a contract's side from
// Upload Your Contracts. A transaction document is both buyer and seller.
export function templateSidesFor(side: string | null | undefined): string[] {
  const s = side?.toLowerCase();
  if (s === "buyer" || s === "seller" || s === "listing") return [s];
  if (s === "transaction") return ["buyer", "seller"];
  return [];
}
