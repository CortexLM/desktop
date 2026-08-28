import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpdateBanner } from '../update-banner.tsx';

type InfoListener = (info: { version: string }) => void;
type ProgressListener = (progress: { percent: number }) => void;

function stubUpdateBridge() {
  const available: InfoListener[] = [];
  const progress: ProgressListener[] = [];
  const downloaded: InfoListener[] = [];
  const install = vi.fn(async () => ({ success: true }));

  vi.stubGlobal('cortex', {
    update: {
      check: vi.fn(async () => ({ success: true })),
      download: vi.fn(async () => ({ success: true })),
      install,
      onAvailable: (callback: InfoListener) => {
        available.push(callback);
        return () => {};
      },
      onDownloadProgress: (callback: ProgressListener) => {
        progress.push(callback);
        return () => {};
      },
      onDownloaded: (callback: InfoListener) => {
        downloaded.push(callback);
        return () => {};
      },
    },
  });

  return {
    install,
    emitAvailable: (version: string) => available.forEach((listener) => listener({ version })),
    emitProgress: (percent: number) => progress.forEach((listener) => listener({ percent })),
    emitDownloaded: (version: string) => downloaded.forEach((listener) => listener({ version })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UpdateBanner', () => {
  it('renders nothing in the browser, where there is no installer', () => {
    const { container } = render(() => <UpdateBanner />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText(/ready to install/)).toBeNull();
  });

  it('shows download progress when main reports an available update', () => {
    const bridge = stubUpdateBridge();
    render(() => <UpdateBanner />);

    bridge.emitAvailable('1.4.0');
    expect(screen.getByRole('status')).toHaveTextContent('Downloading Cortex 1.4.0…');

    bridge.emitProgress(42);
    expect(screen.getByRole('status')).toHaveTextContent('Downloading Cortex 1.4.0… 42%');
    expect(screen.queryByRole('button', { name: 'Restart now' })).toBeNull();
  });

  it('offers Restart now after the update is downloaded', () => {
    const bridge = stubUpdateBridge();
    render(() => <UpdateBanner />);

    bridge.emitDownloaded('1.4.0');

    expect(screen.getByRole('status')).toHaveTextContent('Cortex 1.4.0 is ready to install.');
    fireEvent.click(screen.getByRole('button', { name: 'Restart now' }));
    expect(bridge.install).toHaveBeenCalledTimes(1);
  });

  it('dismisses the toast when the user chooses Later', () => {
    const bridge = stubUpdateBridge();
    render(() => <UpdateBanner />);

    bridge.emitDownloaded('1.4.0');
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(bridge.install).not.toHaveBeenCalled();
  });
});
