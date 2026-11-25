/** Znak Horyzontu: słońce nad linią horyzontu na zielonym kafelku. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0D5C63" />
      <path d="M7 21h18" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M11 21a5 5 0 0110 0z" fill="#F2A33A" />
    </svg>
  );
}
