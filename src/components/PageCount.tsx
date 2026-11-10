// A page's count on its button: in red, how many fields still need an
// answer; once none do, how many fields it has.
export function PageCount({ total, left, current }: { total: number; left: number; current: boolean }) {
  if (total === 0) return null;
  return (
    <span className={left > 0 ? (current ? "text-white" : "text-danger") : "opacity-80"}>
      &middot; {left > 0 ? left : total}
    </span>
  );
}

export const pageCountTitle = ({ total, left }: { total: number; left: number }) =>
  total === 0
    ? undefined
    : left > 0
      ? `${left} of ${total} field${total === 1 ? "" : "s"} on this page still need${left === 1 ? "s" : ""} an answer`
      : `${total} field${total === 1 ? "" : "s"} on this page, all done`;
