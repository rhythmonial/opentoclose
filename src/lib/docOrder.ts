// The order a client put their contracts in: their Upload Your Contracts
// order, or in Assign Your Fields their own order there (which
// starts from the upload order). Contracts added since go last, oldest
// first.
type Ordered = {
  created_at: string;
  upload_order: number | null;
  assign_order?: number | null;
};

export function inUploadOrder<T extends Ordered>(docs: T[]): T[] {
  return [...docs].sort(
    (a, b) =>
      (a.upload_order ?? Infinity) - (b.upload_order ?? Infinity) ||
      a.created_at.localeCompare(b.created_at),
  );
}

export function inAssignOrder<T extends Ordered>(docs: T[]): T[] {
  const byUpload = inUploadOrder(docs);
  if (!docs.some((d) => d.assign_order != null)) return byUpload;
  return [...byUpload].sort(
    (a, b) => (a.assign_order ?? Infinity) - (b.assign_order ?? Infinity),
  );
}

// Ids in a new order: the ones given, as long as they're all the account's.
export function cleanOrder(ids: unknown, known: string[]): string[] | null {
  if (!Array.isArray(ids)) return null;
  const set = new Set(known);
  const out = [...new Set(ids.filter((id): id is string => typeof id === "string" && set.has(id)))];
  return out.length === known.length ? out : null;
}
