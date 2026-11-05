/** Team crest from the match-center design (ADR-0007). Decorative. */
export function Crest({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={Math.round((size * 68) / 58)} viewBox="0 0 58 68" fill="none">
      <path d="M29 2l25 7v22c0 17-11 28-25 35C15 59 4 48 4 31V9z" fill="var(--color-panel)" />
      <path d="M29 14l14 4v13c0 9-6 16-14 20-8-4-14-11-14-20V18z" fill="var(--color-accent)" />
    </svg>
  )
}
