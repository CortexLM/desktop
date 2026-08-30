import { describe, expect, it } from 'vitest';

import { installAppMenu, windowChromeOptions } from '../chrome';

describe('windowChromeOptions', () => {
  it('keeps traffic lights inset on macOS', () => {
    expect(windowChromeOptions('darwin')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 12 },
    });
  });

  it('hides the native title bar on Windows so the renderer draws controls', () => {
    expect(windowChromeOptions('win32')).toEqual({ titleBarStyle: 'hidden' });
  });

  it('removes the frame on Linux, where there is no hidden-title-bar mode', () => {
    expect(windowChromeOptions('linux')).toEqual({ frame: false });
  });
});

describe('installAppMenu', () => {
  it('is callable per platform without throwing', () => {
    expect(() => installAppMenu('linux')).not.toThrow();
    expect(() => installAppMenu('win32')).not.toThrow();
    expect(() => installAppMenu('darwin')).not.toThrow();
  });
});
