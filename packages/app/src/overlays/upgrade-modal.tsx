import { For, type JSX } from 'solid-js';

import { Button, Icon } from '@cortex-ide/ui';

import { Scrim } from './scrim.tsx';

import './overlay.css';

export interface UpgradeModalProps {
  title: string;
  /** Why the modal appeared: a reached limit, a locked model, a gated runtime. */
  body: string;
  benefits: readonly string[];
  /** Copy for the confirming action, e.g. "Upgrade to Pro". */
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The upgrade modal.
 *
 * The body is supplied by whatever raised it rather than being generic, because the reason
 * matters: "you have run out of credits" and "this model needs a higher plan" lead to the
 * same place but are not the same message, and a single blurb covering both would say
 * nothing useful about either.
 */
export function UpgradeModal(props: UpgradeModalProps): JSX.Element {
  return (
    <Scrim label={props.title} align="centre" onDismiss={props.onDismiss}>
      <div class="cx-upgrade">
        <h2 class="cx-upgrade__title">{props.title}</h2>
        <p class="cx-upgrade__body">{props.body}</p>

        <ul class="cx-upgrade__benefits">
          <For each={props.benefits}>
            {(benefit) => (
              <li class="cx-upgrade__benefit">
                <span class="cx-upgrade__check" aria-hidden="true">
                  <Icon name="checkSmall" size={9} />
                </span>
                {benefit}
              </li>
            )}
          </For>
        </ul>

        <div class="cx-upgrade__actions">
          <Button variant="ghost" onClick={() => props.onDismiss()}>
            Not now
          </Button>
          <Button variant="primary" onClick={() => props.onConfirm()}>
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </Scrim>
  );
}
