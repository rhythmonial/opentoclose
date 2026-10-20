export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="OTC Setup with Josie"
    >
      <path
        d="M62.6 16.6 A38 38 0 1 1 18.6 47.4"
        fill="none"
        stroke="#00275e"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M40 55 L52 68 L77 36"
        fill="none"
        stroke="#00275e"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="23"
        y="47"
        textAnchor="middle"
        fontFamily="Poppins, Arial Black, sans-serif"
        fontWeight="800"
        fontSize="60"
        fill="#feb729"
      >
        $
      </text>
    </svg>
  );
}
