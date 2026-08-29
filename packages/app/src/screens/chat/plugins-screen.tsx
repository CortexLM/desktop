import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { PluginSurfaceChoice } from './plugin-surface-choice.tsx';
import type { PluginApp, PluginWriteFailure } from '../../state/plugins.ts';
import type { PluginSurface } from '../../state/plugin-surfaces.ts';

import './product-pages.css';

/**
 * What a failed write says. The service's own message is not shown: it is
 * written by whoever threw it, and it has been seen naming the marketplace we
 * install through. Each line says what is affected and what state it left.
 */
const WRITE_FAILURE_COPY: Record<PluginWriteFailure, string> = {
  unavailable: 'Plugins are not available on this workspace right now. Nothing changed.',
  connect: 'Cortex could not connect that app. Nothing changed — try again.',
  assign: 'Cortex could not save where that plugin is used. Nothing changed — try again.',
  'assign-unsupported':
    'Cortex cannot yet choose where a plugin is used on this workspace. The plugin stays connected everywhere it already was.',
};

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
  onConnect: (slug: string, surfaces: readonly PluginSurface[]) => void;
  onDisconnect?: (slug: string) => void;
  /** Re-assigns a connection between Cortex Chat and Cortex Bot. */
  onSurfaces?: (slug: string, surfaces: readonly PluginSurface[]) => void;
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
  /**
   * A connect or an assignment that genuinely failed. The guest refusal never
   * lands here — that one opens sign-in instead.
   */
  writeError?: PluginWriteFailure;
}

export function PluginsScreen(props: PluginsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Plugins"
        subtitle="Connect the services you already use, in Cortex Chat, Cortex Bot, or both."
      />
      <PageBody width="list">
        <Show when={!props.loading} fallback={<HonestState kind="loading" title="Loading plugins" body="Asking the catalogue." />}>
          <Show when={props.signedIn === false && props.onSignIn && props.onCreateAccount}>
            <AccountGate
              onSignIn={() => props.onSignIn?.()}
              onCreateAccount={() => props.onCreateAccount?.()}
            />
          </Show>
          <Show when={props.writeError}>
            {(failure) => (
              <p class="cx-product-error" role="alert">
                {WRITE_FAILURE_COPY[failure()]}
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
            <PluginCards {...props} />
          </Show>
        </Show>
      </Show>
    </Show>
  );
}

function PluginCards(props: PluginsScreenProps): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={props.apps}>
        {(app) => (
          <PluginCard
            app={app}
            connected={props.connected.includes(app.slug)}
            onConnect={props.onConnect}
            {...(props.onDisconnect ? { onDisconnect: props.onDisconnect } : {})}
            {...(props.onSurfaces ? { onSurfaces: props.onSurfaces } : {})}
          />
        )}
      </For>
    </div>
  );
}

/**
 * One catalogue row, with the Chat / Bot choice it will be connected on.
 *
 * Before the connection exists the choice is local — there is nothing on the
 * account to write it to yet, so it travels in the connect call. Afterwards it
 * is the account's, and every change is a write.
 */
function PluginCard(props: {
  app: PluginApp;
  connected: boolean;
  onConnect: (slug: string, surfaces: readonly PluginSurface[]) => void;
  onDisconnect?: (slug: string) => void;
  onSurfaces?: (slug: string, surfaces: readonly PluginSurface[]) => void;
}): JSX.Element {
  const [draft, setDraft] = createSignal<readonly PluginSurface[]>(props.app.surfaces);
  const surfaces = () => (props.connected ? props.app.surfaces : draft());

  return (
    <div class="cx-plugin-card" data-plugin={props.app.slug}>
      <PluginLogo app={props.app} />
      <div class="cx-plugin-card__text">
        <div class="cx-plugin-card__name">{props.app.name}</div>
        <Show when={cardMeta(props.app)}>
          {(meta) => <p class="cx-plugin-card__meta">{meta()}</p>}
        </Show>
        <Show when={props.app.summary}>
          <p class="cx-plugin-card__summary">{props.app.summary}</p>
        </Show>
        <PluginSurfaceChoice
          appName={props.app.name}
          surfaces={surfaces()}
          connected={props.connected}
          onChange={(next) => {
            if (props.connected) props.onSurfaces?.(props.app.slug, next);
            else setDraft(next);
          }}
        />
      </div>
      <PluginAction
        app={props.app}
        connected={props.connected}
        onConnect={() => props.onConnect(props.app.slug, surfaces())}
        {...(props.onDisconnect ? { onDisconnect: props.onDisconnect } : {})}
      />
    </div>
  );
}

function PluginAction(props: {
  app: PluginApp;
  connected: boolean;
  onConnect: () => void;
  onDisconnect?: (slug: string) => void;
}): JSX.Element {
  return (
    <div class="cx-product-row__action">
      <Show
        when={!props.connected}
        fallback={
          <Button
            variant="secondary"
            onClick={() => props.onDisconnect?.(props.app.slug)}
            aria-label={`Disconnect ${props.app.name}`}
          >
            Disconnect
          </Button>
        }
      >
        <Button
          variant="primary"
          onClick={() => props.onConnect()}
          aria-label={`Connect ${props.app.name}`}
        >
          Connect
        </Button>
      </Show>
    </div>
  );
}
