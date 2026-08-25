import { onCleanup, onMount, type JSX } from 'solid-js';

import './overlay.css';

export interface ScrimProps {
  children: JSX.Element;
  /** Where the panel sits. The palette hangs high so its results grow downward. */
  align?: 'top' | 'centre';
  onDismiss: () => void;
  /** Accessible name for the dialog. */
  label: string;
}

/**
 * The backdrop every overlay sits on.
 *
 * Escape dismisses and a click on the scrim itself dismisses; a click inside the panel does
 * not, which is why the handler checks the event target rather than relying on the panel
 * stopping propagation. Making the panel swallow clicks would also swallow them from
 * anything that legitimately wanted to listen higher up.
 */
export function Scrim(props: ScrimProps): JSX.Element {
  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      props.onDismiss();
    };

    // Bound to the document rather than the scrim: focus is usually inside the panel, and a
    // handler on the scrim would only fire once focus bubbled back out to it.
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => document.removeEventListener('keydown', onKeyDown));
  });

  return (
    <div
      class={props.align === 'centre' ? 'cx-scrim cx-scrim--centre' : 'cx-scrim cx-scrim--top'}
      role="dialog"
      aria-modal="true"
      aria-label={props.label}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onDismiss();
      }}
    >
      {props.children}
    </div>
  );
}
