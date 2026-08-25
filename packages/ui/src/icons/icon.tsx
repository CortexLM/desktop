import { type JSX, splitProps } from 'solid-js';

import { iconGeometry, STROKE_WIDTH_SLOT, type IconKey } from './geometry.generated.ts';
import { icons, resolveIcon, type IconName } from './icon-names.tsx';

import './icon.css';

export interface IconProps extends Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'children'> {
  /** A semantic name from `icons`, or a raw geometry key for an unnamed glyph. */
  name: IconName | IconKey;
  /** Overrides the size the design draws this glyph at. */
  size?: number;
  /** Overrides the stroke width the design draws this glyph with. */
  strokeWidth?: number;
  /**
   * Accessible label. Icons are decorative by default - they sit next to their own text
   * label almost everywhere in this design - so the element is hidden from assistive
   * technology unless a label is given.
   */
  label?: string;
}

/**
 * Renders a glyph extracted from the Paper file.
 *
 * The geometry carries `currentColor` fills and a stroke-width slot, so colour comes from
 * the surrounding text colour and weight comes from the definition. That keeps a single
 * record able to render every place the design uses the glyph, without the component
 * knowing anything about which role it is painting.
 */
export function Icon(props: IconProps): JSX.Element {
  const [local, rest] = splitProps(props, ['name', 'size', 'strokeWidth', 'label', 'class']);

  const definition = () => resolveIcon(local.name);
  const geometry = () => iconGeometry[definition().key];
  const size = () => local.size ?? definition().size;
  const strokeWidth = () => local.strokeWidth ?? definition().strokeWidth;

  const body = () => {
    const width = strokeWidth();
    const markup = geometry().body;
    // A fill-only glyph has no slot to fill, so the replace is a no-op rather than a
    // special case. Anything left unsubstituted would be invalid SVG, so an unset width
    // falls back to the design's most common weight for that glyph.
    return markup.replaceAll(STROKE_WIDTH_SLOT, String(width ?? geometry().strokeWidths[0] ?? 1.5));
  };

  return (
    <svg
      class={local.class ? `cx-icon ${local.class}` : 'cx-icon'}
      width={size()}
      height={size()}
      viewBox={geometry().viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role={local.label ? 'img' : undefined}
      aria-label={local.label}
      aria-hidden={local.label ? undefined : true}
      // eslint-disable-next-line solid/no-innerhtml -- geometry is generated from the
      // design file at build time and contains no interpolated runtime input.
      innerHTML={body()}
      {...rest}
    />
  );
}

export { icons, type IconName };
export { iconGeometry, type IconKey };
