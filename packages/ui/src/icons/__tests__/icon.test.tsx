import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

import { Icon } from '../icon.tsx';
import { icons, resolveIcon, type IconName } from '../icon-names.tsx';
import { iconGeometry, STROKE_WIDTH_SLOT } from '../geometry.generated.ts';

const iconNames = Object.keys(icons) as IconName[];

describe('extracted icon geometry', () => {
  it('extracted a non-trivial set from the design', () => {
    // 79 glyphs across 24 artboards at the time of extraction. The floor guards against a
    // silently empty regeneration, which would otherwise render every icon blank.
    expect(Object.keys(iconGeometry).length).toBeGreaterThan(50);
  });

  it('gives every glyph a viewBox and a body', () => {
    for (const [key, geometry] of Object.entries(iconGeometry)) {
      expect(geometry.viewBox, key).toMatch(/^0 0 [\d.]+ [\d.]+$/);
      expect(geometry.body.length, key).toBeGreaterThan(0);
    }
  });

  it('normalised every colour to currentColor', () => {
    // A leftover token reference or hex literal would paint the glyph the wrong colour in
    // whichever theme it was extracted from.
    for (const [key, geometry] of Object.entries(iconGeometry)) {
      expect(geometry.body, `${key} still references a token`).not.toMatch(/var\(--/);
      expect(geometry.body, `${key} still has a hex literal`).not.toMatch(
        /(fill|stroke)="#[0-9A-Fa-f]/,
      );
    }
  });

  it('leaves a stroke-width slot on every stroked glyph', () => {
    for (const [key, geometry] of Object.entries(iconGeometry)) {
      const stroked = geometry.strokeWidths.length > 0;
      expect(geometry.body.includes(STROKE_WIDTH_SLOT), `${key} stroked=${stroked}`).toBe(stroked);
    }
  });

  it('keeps fill="none" intact, since it distinguishes outline from solid glyphs', () => {
    const outlined = Object.values(iconGeometry).filter((geometry) =>
      geometry.body.includes('fill="none"'),
    );
    expect(outlined.length).toBeGreaterThan(0);
  });

  it('dropped the layout attributes Paper stamps on every node', () => {
    for (const [key, geometry] of Object.entries(iconGeometry)) {
      expect(geometry.body, `${key} kept a style attribute`).not.toContain('style=');
    }
  });
});

describe('semantic icon names', () => {
  it('resolves every name to a real glyph', () => {
    for (const name of iconNames) {
      const definition = resolveIcon(name);
      expect(iconGeometry[definition.key], `${name} -> ${definition.key}`).toBeDefined();
    }
  });

  it('gives every name a size the design actually draws it at', () => {
    for (const name of iconNames) {
      const definition = resolveIcon(name);
      expect(definition.size, name).toBeGreaterThan(0);
      expect(definition.size, name).toBeLessThanOrEqual(48);
    }
  });

  it('sets a stroke width on every stroked glyph and none on fill-only glyphs', () => {
    for (const name of iconNames) {
      const definition = resolveIcon(name);
      const stroked = iconGeometry[definition.key].strokeWidths.length > 0;
      expect(definition.strokeWidth !== undefined, `${name} stroked=${stroked}`).toBe(stroked);
    }
  });

  it('uses a stroke width the design draws that glyph with', () => {
    for (const name of iconNames) {
      const definition = resolveIcon(name);
      if (definition.strokeWidth === undefined) continue;
      const observed = iconGeometry[definition.key].strokeWidths;
      expect(observed, `${name} width ${definition.strokeWidth}`).toContain(
        String(definition.strokeWidth),
      );
    }
  });

  it('resolves a raw geometry key for glyphs the product has no name for', () => {
    const unnamed = Object.keys(iconGeometry).find(
      (key) => !Object.values(icons).some((definition) => definition.key === key),
    );
    expect(unnamed).toBeDefined();
    expect(resolveIcon(unnamed as never).key).toBe(unnamed);
  });

  it('throws on an unknown name rather than rendering an empty glyph', () => {
    expect(() => resolveIcon('not-an-icon' as never)).toThrow(/Unknown icon/);
  });
});

describe('Icon component', () => {
  it('renders the glyph at the size the design draws it at', () => {
    const { container } = render(() => <Icon name="sessions" />);
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
  });

  it('substitutes the stroke width into the geometry', () => {
    const { container } = render(() => <Icon name="sessions" />);
    const svg = container.querySelector('svg')!;

    expect(svg.innerHTML).toContain('1.5');
    expect(svg.innerHTML).not.toContain(STROKE_WIDTH_SLOT);
  });

  it('lets a call site override size and stroke width', () => {
    const { container } = render(() => <Icon name="cloud" size={20} strokeWidth={2} />);
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.innerHTML).toContain('2');
  });

  it('is hidden from assistive technology when it has no label', () => {
    // The design pairs almost every icon with its own text, so announcing both would be
    // duplicate noise.
    const { container } = render(() => <Icon name="home" />);
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('becomes an labelled image when it carries meaning on its own', () => {
    const { container } = render(() => <Icon name="send" label="Send message" />);
    const svg = container.querySelector('svg')!;

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Send message');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('never shrinks inside a flex row', () => {
    const { container } = render(() => <Icon name="repo" />);
    expect(container.querySelector('svg')).toHaveClass('cx-icon');
  });

  it('keeps a caller class alongside its own', () => {
    const { container } = render(() => <Icon name="repo" class="custom" />);
    const svg = container.querySelector('svg')!;

    expect(svg).toHaveClass('cx-icon');
    expect(svg).toHaveClass('custom');
  });

  it('renders a fill-only glyph without inventing a stroke', () => {
    const { container } = render(() => <Icon name="github" />);
    const svg = container.querySelector('svg')!;

    expect(svg.innerHTML).toContain('fill="currentColor"');
    expect(svg.innerHTML).not.toContain('strokeWidth');
  });

  it('renders every named icon without throwing', () => {
    for (const name of iconNames) {
      const { container, unmount } = render(() => <Icon name={name} />);
      expect(container.querySelector('svg'), name).not.toBeNull();
      unmount();
    }
  });
});
