import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';

import { chromePlatform, windowControls } from '../state/platform.ts';

import './title-bar.css';

/**
 * The window's own top bar, platform-adapted.
 *
 * The native frame is gone (it carried the File/Edit menu strip and a
 * system-styled title bar), so this strip is what the frame used to be: a drag
 * region, and — on Windows and Linux — the minimize / maximize / close
 * controls, drawn in the app's own grammar. On macOS the native traffic lights
 * remain (hiddenInset) and sit inside this bar, so it renders no buttons of its
 * own. In a browser (suites, preview, parity captures) there is no window to
 * control and the bar does not render at all.
 */
export function TitleBar(): JSX.Element {
  const platform = chromePlatform();
  if (platform === 'browser') return null;

  const controls = windowControls();
  const [maximized, setMaximized] = createSignal(false);

  onMount(() => {
    if (!controls) return;
    void controls.isMaximized().then((response) => {
      setMaximized(response.data?.maximized ?? false);
    });
    const detach = controls.onMaximizedChange((event) => setMaximized(event.maximized));
    onCleanup(detach);
  });

  // The toggle's response carries the new state. Consumed as well as the pushed
  // event: under a window-manager-less X server (the e2e harness) the
  // maximize/unmaximize events are not delivered reliably, while the response is.
  const toggle = () => {
    void controls?.toggleMaximize().then((response) => {
      if (response.data) setMaximized(response.data.maximized);
    });
  };

  // Double-click on the empty bar toggles maximize, as every native frame does.
  // macOS handles this itself on the drag region.
  const onDoubleClick = () => {
    if (platform !== 'darwin') toggle();
  };

  return (
    <header class="cx-titlebar" data-platform={platform} onDblClick={onDoubleClick}>
      <span class="cx-titlebar__drag" aria-hidden="true" />

      <Show when={platform !== 'darwin' && controls}>
        {(bridge) => (
          <Controls
            minimize={() => void bridge().minimize()}
            toggle={toggle}
            close={() => void bridge().close()}
            maximized={maximized}
          />
        )}
      </Show>
    </header>
  );
}

interface ControlsProps {
  minimize: () => void;
  toggle: () => void;
  close: () => void;
  maximized: () => boolean;
}

/** The minimize / maximize-restore / close cluster, in the app's own grammar. */
function Controls(props: ControlsProps): JSX.Element {
  return (
    <div class="cx-titlebar__controls">
      <button type="button" class="cx-titlebar__button" aria-label="Minimize" onClick={() => props.minimize()}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
        </svg>
      </button>
      <button
        type="button"
        class="cx-titlebar__button"
        aria-label={props.maximized() ? 'Restore' : 'Maximize'}
        onClick={() => props.toggle()}
      >
        <Show
          when={props.maximized()}
          fallback={
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
            </svg>
          }
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 3.5v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" />
            <rect x="2.5" y="4.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
          </svg>
        </Show>
      </button>
      <button
        type="button"
        class="cx-titlebar__button cx-titlebar__button--close"
        aria-label="Close window"
        onClick={() => props.close()}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
        </svg>
      </button>
    </div>
  );
}
