// A page's count on its button: in red, how many fields still need an
// answer (nothing once none do).
export function PageCount({ left, current }: { total: number; left: number; current: boolean }) {
  if (left === 0) return null;
  return <span className={current ? "text-white" : "text-danger"}>&middot; {left}</span>;
}

export const pageCountTitle = ({ total, left }: { total: number; left: number }) =>
  left > 0
    ? `${left} of ${total} field${total === 1 ? "" : "s"} on this page still need${left === 1 ? "s" : ""} an answer`
    : undefined;
