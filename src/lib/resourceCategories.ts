export const RESOURCE_CATEGORIES = [
  { value: "training", label: "Training" },
  { value: "replay", label: "Replays" },
  { value: "faq", label: "FAQs" },
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]["value"];
