import type { JSX } from 'solid-js';

/**
 * Brand marks that carry their own colours.
 *
 * Deliberately outside the icon registry. The extractor normalises every fill to
 * `currentColor`, which is right for an interface glyph and wrong for a logo: it collapsed
 * Google's four-colour G into one flat shape, and no amount of styling at the call site can
 * recover the colours the registry threw away.
 *
 * The extractor cannot tell the difference - a path is a path - so the distinction is made
 * here, by hand, for the small set of marks that need it. Geometry is the same as Paper's
 * export (node d022c5b8, viewBox 0 0 18 18).
 */

export function GoogleMark(props: { size?: number }): JSX.Element {
  const size = props.size ?? 16;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ 'flex-shrink': '0' }}
    >
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.97 10.72A5.41 5.41 0 013.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
