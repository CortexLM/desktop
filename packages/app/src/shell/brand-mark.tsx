import type { JSX } from 'solid-js';

/**
 * The Cortex mark, knocked out of its plate.
 *
 * Kept out of the icon registry deliberately. The registry normalises every fill to
 * `currentColor`, which is right for interface glyphs and wrong for a logo: the mark is a
 * fixed cream on a fixed dark green, and neither shifts with the theme because it is brand
 * rather than palette.
 *
 * Geometry is the same path the design uses (Paper node a4a81f0a, viewBox 0 0 196 98).
 */
export function BrandMark(props: { width?: number; height?: number }): JSX.Element {
  return (
    <svg
      width={props.width ?? 16}
      height={props.height ?? 8}
      viewBox="0 0 196 98"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M84.8 2.9 L108.2 21.1 Q112 24 112 28.4 L112 92 Q112 97.6 107.7 94.3 L85.2 78.9 Q81 76 81 71.4 L81 6 Q81 0.8 84.8 2.9 Z M84 21 L9.2 65.6 Q4 68.7 8.4 72.8 L19.6 82.9 Q24 87 29.2 84 L84 53 Z M110 23 L184.8 65.7 Q190 68.7 185.7 72.9 L176.3 81.9 Q172 86 166.8 83 L110 50.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface BrandTileProps {
  /** The 44px tile used as the Home greeting mark, rather than the 24px sidebar one. */
  large?: boolean;
  class?: string;
}

/** The mark on its plate. */
export function BrandTile(props: BrandTileProps): JSX.Element {
  const classes = () =>
    ['cx-sidebar__logo', props.large ? 'cx-sidebar__logo--large' : '', props.class ?? '']
      .filter(Boolean)
      .join(' ');

  return (
    <span class={classes()}>
      <BrandMark width={props.large ? 26 : 16} height={props.large ? 13 : 8} />
    </span>
  );
}
