import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PEBBLE_PATH } from '../mascot-looks.ts';
import { MascotMark } from '../mascot-mark.tsx';
import { MascotIdentityFields } from '../mascot-identity.tsx';
import { MascotListScreen } from '../mascot-screens.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

const listed: Mascot = {
  id: 'mst_1',
  name: 'Scout',
  look: 'amber',
  face: 'wink',
  unread: true,
  createdAt: 1,
  computer: { id: 'pc_1', mascotId: 'mst_1', status: 'hibernated' },
  messages: [],
  videos: [],
};

describe('MascotMark', () => {
  it('renders one flat pebble with ivory eyes and no gradient', () => {
    const { container } = render(() => (
      <MascotMark look="meadow" face="idle" size={64} seed="mst_tilt" label="Scout" />
    ));
    const svg = container.querySelector('svg.cx-mascot') as SVGSVGElement;
    expect(svg.getAttribute('data-look')).toBe('meadow');
    expect(svg.getAttribute('data-face')).toBe('idle');
    expect(svg.innerHTML).toContain(PEBBLE_PATH);
    expect(svg.innerHTML.toLowerCase()).not.toContain('gradient');
    expect(svg.innerHTML.toLowerCase()).not.toContain('polygon');
    expect(svg.style.getPropertyValue('--mascot-look')).toBe('#1f4945');
    expect(svg.style.getPropertyValue('--mascot-look-dark')).toBe('#2e6b64');
    expect(svg.style.getPropertyValue('--mascot-eye')).toBe('#faf8f4');
    expect(Number(svg.getAttribute('data-tilt'))).not.toBe(0);
    expect(screen.getByRole('img', { name: 'Scout' })).toBeTruthy();
  });

  it('suppresses tilt under 48px and shows working slits', () => {
    const { container } = render(() => (
      <MascotMark look="slate" face="idle" size={40} seed="mst_tilt" state="working" />
    ));
    const svg = container.querySelector('svg.cx-mascot')!;
    expect(svg.getAttribute('data-tilt')).toBe('0');
    expect(svg.getAttribute('data-face')).toBe('slit');
    expect(svg.getAttribute('data-state')).toBe('working');
    expect(container.querySelectorAll('rect.cx-mascot__eye')).toHaveLength(2);
  });

  it('returns to idle after a success pop', () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    render(() => <MascotMark look="teal" face="idle" state="success" onSettled={onSettled} />);
    vi.advanceTimersByTime(900);
    expect(onSettled).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('mascot identity picker', () => {
  it('lets the user pick a look and a resting face', () => {
    const onLook = vi.fn();
    const onFace = vi.fn();
    render(() => <MascotIdentityFields look="meadow" face="idle" onLook={onLook} onFace={onFace} />);
    screen.getByRole('button', { name: 'Terracotta' }).click();
    screen.getByRole('button', { name: 'Narrow' }).click();
    expect(onLook).toHaveBeenCalledWith('terracotta');
    expect(onFace).toHaveBeenCalledWith('slit');
  });
});

describe('mascot list mark', () => {
  it('draws the live pebble instead of a swatch', () => {
    const { container } = render(() => (
      <MascotListScreen mascots={[listed]} onOpen={vi.fn()} onCreate={vi.fn()} />
    ));
    const svg = container.querySelector('svg.cx-mascot')!;
    expect(svg.getAttribute('data-look')).toBe('amber');
    expect(svg.getAttribute('data-state')).toBe('notify');
    expect(container.querySelector('.cx-mascot-swatch')).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain('grok');
  });
});
