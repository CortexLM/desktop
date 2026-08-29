import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { LibraryItem } from '../../state/library.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import './product-pages.css';

function LibraryList(props: {
  items: readonly LibraryItem[];
  onRemove?: (id: string) => void;
}): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={props.items}>
        {(item) => (
          <div class="cx-product-row" data-library-item={item.id}>
            <div>
              <div class="cx-product-row__title">{item.title}</div>
              <p class="cx-product-row__meta">{item.kind} · {item.excerpt}</p>
            </div>
            <div class="cx-product-row__action">
              <Show when={props.onRemove}>
                <Button variant="secondary" onClick={() => props.onRemove?.(item.id)}>
                  Remove
                </Button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export function LibraryScreen(props: {
  items: readonly LibraryItem[];
  state: RemoteState;
  error?: string;
  signedIn: boolean;
  onOpen?: (item: LibraryItem) => void;
  onRemove?: (id: string) => void;
  onRetry: () => void;
  onSignIn: () => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Library" subtitle="Answers and uploads you chose to keep." />
      <PageBody width="list">
        <Show
          when={props.signedIn}
          fallback={
            <HonestState
              kind="signed-out"
              title="Sign in to keep a library"
              body="A saved answer lives on your account so it is there on your other machines."
              actionLabel="Sign in"
              onAction={props.onSignIn}
            />
          }
        >
          <RemoteStateView
            state={props.state}
            {...(props.error ? { error: props.error } : {})}
            label="Your library"
            emptyTitle="Library is empty"
            emptyBody="Save an answer from a conversation and it will land here."
            onRetry={props.onRetry}
          >
            <LibraryList
              items={props.items}
              {...(props.onRemove ? { onRemove: props.onRemove } : {})}
            />
          </RemoteStateView>
        </Show>
      </PageBody>
    </>
  );
}
