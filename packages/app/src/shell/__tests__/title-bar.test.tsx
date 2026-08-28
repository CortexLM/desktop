import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TitleBar } from '../title-bar.tsx';

type MaximizedListener = (event: { maximized: boolean }) => void;

function stubBridge(platform: string) {
  const listeners: MaximizedListener[] = [];
  const controls = {
    minimize: vi.fn(async () => ({ success: true as const, data: { minimized: true as const } })),
    toggleMaximize: vi.fn(async () => ({ success: true as const, data: { maximized: true } })),
    close: vi.fn(async () => ({ success: true as const, data: { closed: true as const } })),
    isMaximized: vi.fn(async () => ({ success: true as const, data: { maximized: false } })),
    onMaximizedChange: vi.fn((callback: MaximizedListener) => {
      listeners.push(callback);
      return () => {};
    }),
  };

  vi.stubGlobal('cortex', { platform: () => platform, windowControls: controls });
  return { controls, emitMaximized: (maximized: boolean) => listeners.forEach((l) => l({ maximized })) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TitleBar', () => {
  it('renders nothing in a browser, where there is no window to control', () => {
    // The suites, the preview server and the parity captures all run without a
    // bridge; a phantom bar there would shift every capture by its height.
    const { container } = render(() => <TitleBar />);
    expect(container.innerHTML).toBe('');
  });

  it('draws the three window controls on Linux', () => {
    stubBridge('linux');
    render(() => <TitleBar />);

    expect(screen.getByRole('button', { name: 'Minimize' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maximize' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close window' })).toBeInTheDocument();
  });

  it('draws no controls of its own on macOS, where the traffic lights are native', () => {
    stubBridge('darwin');
    const { container } = render(() => <TitleBar />);

    expect(container.querySelector('.cx-titlebar')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Close window' })).toBeNull();
  });

  it('routes each control to the bridge', () => {
    const { controls } = stubBridge('win32');
    render(() => <TitleBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));

    expect(controls.minimize).toHaveBeenCalledTimes(1);
    expect(controls.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(controls.close).toHaveBeenCalledTimes(1);
  });

  it('flips the maximize button into a restore button when the window maximizes', async () => {
    const { emitMaximized } = stubBridge('linux');
    render(() => <TitleBar />);

    expect(screen.getByRole('button', { name: 'Maximize' })).toBeInTheDocument();

    emitMaximized(true);
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();

    emitMaximized(false);
    expect(await screen.findByRole('button', { name: 'Maximize' })).toBeInTheDocument();
  });

  it('toggles maximize on a double-click of the empty bar', () => {
    const { controls } = stubBridge('linux');
    const { container } = render(() => <TitleBar />);

    fireEvent.dblClick(container.querySelector('.cx-titlebar')!);
    expect(controls.toggleMaximize).toHaveBeenCalledTimes(1);
  });
});
