import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import { BrandLogo } from './brand-logos.tsx';
import type { LibraryItem } from '../../state/library.ts';
import { PLUGIN_CARDS, type PluginBrand } from '../../state/plugins.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import './product-pages.css';

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
          </RemoteStateView>
        </Show>
      </PageBody>
    </>
  );
}

export function PluginsScreen(props: {
  connected: readonly PluginBrand[];
  onConnect: (id: PluginBrand) => void;
  onDisconnect?: (id: PluginBrand) => void;
  loading?: boolean;
  unavailable?: boolean;
  error?: string;
}): JSX.Element {
  return (
    <>
      <PageHeader
        title="Plugins"
        subtitle="Connect the services you already use. Install path is Composio."
      />
      <PageBody width="list">
        <Show when={!props.loading} fallback={<HonestState kind="loading" title="Loading plugins" body="Asking the catalog." />}>
          <Show
            when={!props.unavailable}
            fallback={
              <HonestState
                kind="error"
                title="Plugins unavailable"
                body={props.error || 'Composio is not configured on this backend. Drive and Slack are not connected.'}
              />
            }
          >
            <Show when={!props.error} fallback={<HonestState kind="error" title="Could not load plugins" body={props.error ?? ''} />}>
              <PluginCards connected={props.connected} onConnect={props.onConnect} onDisconnect={props.onDisconnect} />
            </Show>
          </Show>
        </Show>
      </PageBody>
    </>
  );
}

function PluginCards(props: {
  connected: readonly PluginBrand[];
  onConnect: (id: PluginBrand) => void;
  onDisconnect?: (id: PluginBrand) => void;
}): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={PLUGIN_CARDS}>
        {(card) => (
          <div class="cx-plugin-card">
            <BrandLogo brand={card.id} />
            <div>
              <div class="cx-plugin-card__name">{card.name}</div>
              <p class="cx-plugin-card__summary">{card.summary}</p>
            </div>
            <div class="cx-product-row__action">
              <Show
                when={!props.connected.includes(card.id)}
                fallback={
                  <Button variant="secondary" onClick={() => props.onDisconnect?.(card.id)}>
                    Disconnect
                  </Button>
                }
              >
                <Button variant="primary" onClick={() => props.onConnect(card.id)}>
                  Connect with Composio
                </Button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
