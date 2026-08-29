import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';

import {
  resolveUpdateHost,
  type AppUpdateInfo,
  type AppUpdateProgress,
  type UpdateHost,
} from '../state/update-host.ts';

import './update-banner.css';

type BannerState =
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string };

function downloadingCopy(version: string, percent: number): string {
  const label = version ? `Cortex ${version}` : 'Cortex';
  return percent > 0 ? `Downloading ${label}… ${percent}%` : `Downloading ${label}…`;
}

function readyCopy(version: string): string {
  return `Cortex ${version} is ready to install.`;
}

function applyAvailable(current: BannerState | null, info: AppUpdateInfo): BannerState {
  return {
    kind: 'downloading',
    version: info.version,
    percent: current?.kind === 'downloading' ? current.percent : 0,
  };
}

function applyProgress(current: BannerState | null, progress: AppUpdateProgress): BannerState {
  return {
    kind: 'downloading',
    version: current?.version ?? '',
    percent: progress.percent,
  };
}

type SetBanner = (fn: (current: BannerState | null) => BannerState | null) => void;

function subscribe(host: UpdateHost, setState: SetBanner): () => void {
  const stopAvailable = host.onAvailable((info) => {
    setState((current) => applyAvailable(current, info));
  });
  const stopProgress = host.onDownloadProgress((progress) => {
    setState((current) => applyProgress(current, progress));
  });
  const stopDownloaded = host.onDownloaded((info) => {
    setState(() => ({ kind: 'ready', version: info.version }));
  });
  return () => {
    stopAvailable();
    stopProgress();
    stopDownloaded();
  };
}

function UpdateToast(props: {
  state: BannerState;
  onRestart: () => void;
  onLater: () => void;
}): JSX.Element {
  const message = () =>
    props.state.kind === 'ready'
      ? readyCopy(props.state.version)
      : downloadingCopy(props.state.version, props.state.percent);

  return (
    <div class="cx-update-toast" role="status" aria-live="polite" data-kind={props.state.kind}>
      <p class="cx-update-toast__message">{message()}</p>
      <Show when={props.state.kind === 'ready'}>
        <div class="cx-update-toast__actions">
          <button type="button" class="cx-update-toast__action" onClick={() => props.onRestart()}>
            Restart now
          </button>
          <button
            type="button"
            class="cx-update-toast__action cx-update-toast__action--ghost"
            onClick={() => props.onLater()}
          >
            Later
          </button>
        </div>
      </Show>
    </div>
  );
}

/**
 * In-app update toast. Renders nothing in the browser: there is no feed and
 * no installer, so a "restart to update" control would be a lie.
 */
export function UpdateBanner(): JSX.Element {
  const host = resolveUpdateHost();
  if (!host.available) return null;

  const [state, setState] = createSignal<BannerState | null>(null);

  onMount(() => {
    const detach = subscribe(host, setState);
    onCleanup(detach);
  });

  return (
    <Show when={state()}>
      {(current) => (
        <UpdateToast
          state={current()}
          onRestart={() => {
            void host.install();
          }}
          onLater={() => setState(null)}
        />
      )}
    </Show>
  );
}
