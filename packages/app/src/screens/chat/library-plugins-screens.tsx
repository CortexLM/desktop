import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { LibraryItem } from '../../state/library.ts';
import type { PluginApp } from '../../state/plugins.ts';
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

/**
 * Why Connect will ask for an account first.
 *
 * Stated up front rather than left for the click to reveal: the reason is the
 * service's, not this screen's, and a user who reads it before choosing an app
 * is not surprised by a sign-in screen halfway through connecting one.
 */
function AccountGate(props: { onSignIn: () => void; onCreateAccount: () => void }): JSX.Element {
  return (
    <div class="cx-account-gate" role="status">
      <div>
        <div class="cx-account-gate__title">Connecting an app needs a Cortex account</div>
        <p class="cx-account-gate__body">
          Without an account this is a guest session, and a guest session cannot be signed
          back into — so an app connected now could never have its access revoked. Sign in
          and the app you picked connects straight away.
        </p>
      </div>
      <div class="cx-account-gate__actions">
        <Button variant="primary" onClick={() => props.onSignIn()}>
          Sign in
        </Button>
        <Button variant="secondary" onClick={() => props.onCreateAccount()}>
          Create account
        </Button>
      </div>
    </div>
  );
}

/**
 * A monogram, not the app's own mark.
 *
 * The catalogue hands out `logo_url` on the provider's CDN, and the renderer's
 * CSP is `img-src 'self' data:` — so those images would not load, and widening
 * the policy would make opening Plugins fetch sixty files from a third party.
 * The initial is drawn from the name the catalogue gave, so it is still the
 * API's data rather than a mark chosen here.
 */
function PluginLogo(props: { app: PluginApp }): JSX.Element {
  return (
    <span class="cx-plugin-card__mark" aria-hidden="true">
      {props.app.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** "email · 61 tools", from whatever of the two the catalogue actually carried. */
function cardMeta(app: PluginApp): string {
  const parts: string[] = [];
  if (app.category) parts.push(app.category);
  if (app.toolCount !== undefined) {
    parts.push(`${app.toolCount} ${app.toolCount === 1 ? 'tool' : 'tools'}`);
  }
  return parts.join(' · ');
}

export interface PluginsScreenProps {
  /** The catalogue, exactly as the API returned it. Never padded out locally. */
  apps: readonly PluginApp[];
  connected: readonly string[];
  onConnect: (slug: string) => void;
  onDisconnect?: (slug: string) => void;
  loading?: boolean;
  /** No marketplace configured on this backend, or the API is out of reach. */
  unavailable?: boolean;
  /** The backend answered from its cache and said the marketplace is down. */
  notLive?: boolean;
  error?: string;
  /**
   * A guest counts as signed out here. Connect stays enabled either way — it
   * opens sign-in and resumes — because a disabled button explains nothing.
   */
  signedIn?: boolean;
  onSignIn?: () => void;
  onCreateAccount?: () => void;
  /** A connect that genuinely failed. The guest refusal never lands here. */
  connectError?: string;
}

export function PluginsScreen(props: PluginsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader title="Plugins" subtitle="Connect the services you already use." />
      <PageBody width="list">
        <Show when={!props.loading} fallback={<HonestState kind="loading" title="Loading plugins" body="Asking the catalogue." />}>
          <Show when={props.signedIn === false && props.onSignIn && props.onCreateAccount}>
            <AccountGate
              onSignIn={() => props.onSignIn?.()}
              onCreateAccount={() => props.onCreateAccount?.()}
            />
          </Show>
          <Show when={props.connectError}>
            {(message) => (
              <p class="cx-product-error" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <PluginsBody {...props} />
        </Show>
      </PageBody>
    </>
  );
}

/**
 * The catalogue, or the reason there is not one.
 *
 * Every branch that is not `ready` renders nothing at all rather than a
 * stand-in list. An app the user cannot connect is not a better empty state
 * than an empty state.
 */
function PluginsBody(props: PluginsScreenProps): JSX.Element {
  return (
    <Show
      when={!props.unavailable}
      fallback={
        <HonestState
          kind="error"
          title="Plugins unavailable"
          body={props.error || 'No plugin marketplace is configured on this backend.'}
        />
      }
    >
      <Show
        when={!props.notLive}
        fallback={
          <HonestState
            kind="error"
            title="The marketplace is not answering"
            body={
              props.error ||
              'Cortex could not reach the plugin marketplace, so there is no catalogue to show. Nothing here is out of date — there is simply nothing to list yet.'
            }
          />
        }
      >
        <Show when={!props.error} fallback={<HonestState kind="error" title="Could not load plugins" body={props.error ?? ''} />}>
          <Show
            when={props.apps.length > 0}
            fallback={
              <HonestState
                kind="empty"
                title="No apps to connect"
                body="The marketplace answered with an empty catalogue."
              />
            }
          >
            <PluginCards
              apps={props.apps}
              connected={props.connected}
              onConnect={props.onConnect}
              onDisconnect={props.onDisconnect}
            />
          </Show>
        </Show>
      </Show>
    </Show>
  );
}

function PluginCards(props: {
  apps: readonly PluginApp[];
  connected: readonly string[];
  onConnect: (slug: string) => void;
  onDisconnect?: (slug: string) => void;
}): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={props.apps}>
        {(app) => (
          <div class="cx-plugin-card" data-plugin={app.slug}>
            <PluginLogo app={app} />
            <div class="cx-plugin-card__text">
              <div class="cx-plugin-card__name">{app.name}</div>
              <Show when={cardMeta(app)}>
                {(meta) => <p class="cx-plugin-card__meta">{meta()}</p>}
              </Show>
              <Show when={app.summary}>
                <p class="cx-plugin-card__summary">{app.summary}</p>
              </Show>
            </div>
            <div class="cx-product-row__action">
              <Show
                when={!props.connected.includes(app.slug)}
                fallback={
                  <Button
                    variant="secondary"
                    onClick={() => props.onDisconnect?.(app.slug)}
                    aria-label={`Disconnect ${app.name}`}
                  >
                    Disconnect
                  </Button>
                }
              >
                <Button
                  variant="primary"
                  onClick={() => props.onConnect(app.slug)}
                  aria-label={`Connect ${app.name}`}
                >
                  Connect
                </Button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
