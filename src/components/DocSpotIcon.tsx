// A document icon for a field that's on the client's contracts: its
// contract's name and line number show on hover.
export function DocSpotIcon({ spot }: { spot: string | undefined }) {
  if (!spot) return null;
  return (
    <span title={spot} aria-label={`On your contract: ${spot}`} className="inline-flex shrink-0 align-middle text-accent">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    </span>
  );
}
