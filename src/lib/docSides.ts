// Which side of the deal a contract is for. They can add their own.
export const DEFAULT_SIDES = ["Buyer", "Seller", "Transaction", "Listing", "Other"];

// Every side in use: the defaults, then any they added (in first-used order).
export function allSides(used: (string | null | undefined)[]) {
  const out = [...DEFAULT_SIDES];
  for (const s of used) {
    const clean = s?.trim();
    if (clean && !out.some((o) => o.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }
  return out;
}

// Short labels for the sides: their first letter (B, S, T, L…), or more
// letters when two sides start the same way (e.g. "Tr" and "Te").
export function sideAbbreviations(sides: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const side of sides) {
    let n = 1;
    const clash = (len: number) =>
      sides.some(
        (o) => o !== side && o.slice(0, len).toLowerCase() === side.slice(0, len).toLowerCase(),
      );
    while (n < 3 && n < side.length && clash(n)) n++;
    const short = side.slice(0, n);
    out[side] = short.charAt(0).toUpperCase() + short.slice(1).toLowerCase();
  }
  return out;
}
