import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { CodeHost, HostStatus, SshRuntime } from '../../state/code-hosts.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import '../chat/product-pages.css';

const STATUS_LABEL: Record<HostStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  unknown: 'Status unknown',
};

export interface RuntimesScreenProps {
  hosts: readonly CodeHost[];
  hostsState: RemoteState;
  hostsError?: string;
  runtimes: readonly SshRuntime[];
  runtimesState: RemoteState;
  runtimesError?: string;
  /** Shown once, straight after pairing. Never persisted. */
  pairingCode?: string;
  pairingError?: string;
  signedIn: boolean;
  onPair: () => void;
  onDismissCode: () => void;
  onUnpair: (id: string) => void;
  onAddSsh: (target: { host: string; user: string; port?: number }) => void;
  onRemoveSsh: (id: string) => void;
  onReload: () => void;
  onSignIn: () => void;
}

/**
 * The pairing code, with the instruction that makes it usable.
 *
 * The code alone is not actionable — the user has to know where to type it. The
 * copy names the command on the other machine, because a code with no destination
 * is the same as no code.
 */
function PairingCode(props: { code: string; onDismiss: () => void }): JSX.Element {
  return (
    <div class="cx-pairing" role="status">
      <p class="cx-product-note">
        On the machine running Cortex Code, open Settings → Runtimes and enter this
        code. It is shown once and expires.
      </p>
      <code class="cx-pairing__code">{props.code}</code>
      <Button variant="secondary" onClick={() => props.onDismiss()}>Done</Button>
    </div>
  );
}

function SshForm(props: {
  onAdd: (target: { host: string; user: string; port?: number }) => void;
}): JSX.Element {
  const [host, setHost] = createSignal('');
  const [user, setUser] = createSignal('');
  const [port, setPort] = createSignal('22');

  return (
    <form
      class="cx-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        const hostValue = host().trim();
        const userValue = user().trim();
        if (!hostValue || !userValue) return;
        const portValue = Number.parseInt(port(), 10);
        props.onAdd({
          host: hostValue,
          user: userValue,
          ...(Number.isFinite(portValue) ? { port: portValue } : {}),
        });
        setHost('');
      }}
    >
      <input
        type="text"
        value={host()}
        placeholder="build-01.internal"
        aria-label="SSH host"
        onInput={(event) => setHost(event.currentTarget.value)}
      />
      <input
        type="text"
        value={user()}
        placeholder="deploy"
        aria-label="SSH user"
        onInput={(event) => setUser(event.currentTarget.value)}
      />
      <input
        type="text"
        value={port()}
        aria-label="SSH port"
        onInput={(event) => setPort(event.currentTarget.value)}
      />
      <Button variant="primary" type="submit">Add server</Button>
    </form>
  );
}

function PairedHosts(props: RuntimesScreenProps): JSX.Element {
  return (
    <>
      <h3 class="cx-product-section">Paired machines</h3>
      <RemoteStateView
        state={props.hostsState}
        {...(props.hostsError ? { error: props.hostsError } : {})}
        label="Cortex Code hosts"
        emptyTitle="No paired machines"
        emptyBody="Pair a machine that already runs Cortex Code and its sessions will show up here."
        emptyActionLabel="Pair a machine"
        onEmptyAction={props.onPair}
        onRetry={props.onReload}
      >
        <div class="cx-product-list">
          <For each={props.hosts}>
            {(host) => (
              <div class="cx-product-row" data-host={host.id}>
                <div>
                  <div class="cx-product-row__title">{host.name}</div>
                  <p class="cx-product-row__meta">
                    {STATUS_LABEL[host.status]}
                    {host.url ? ` · ${host.url}` : ''}
                  </p>
                </div>
                <div class="cx-product-row__action">
                  <Button variant="secondary" onClick={() => props.onUnpair(host.id)}>
                    Unpair
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </RemoteStateView>
    </>
  );
}

function SshRuntimes(props: RuntimesScreenProps): JSX.Element {
  return (
    <>
      <h3 class="cx-product-section">Servers over SSH</h3>
      <p class="cx-product-note">
        Cortex completes the handshake. No key or password is typed here, and none is
        stored by this client.
      </p>
      <SshForm onAdd={props.onAddSsh} />
      <RemoteStateView
        state={props.runtimesState}
        {...(props.runtimesError ? { error: props.runtimesError } : {})}
        label="SSH runtimes"
        emptyTitle="No servers"
        emptyBody="Add a host and user above. Cortex verifies the server and reports its fingerprint."
        onRetry={props.onReload}
      >
        <div class="cx-product-list">
          <For each={props.runtimes}>
            {(runtime) => (
              <div class="cx-product-row" data-runtime={runtime.id}>
                <div>
                  <div class="cx-product-row__title">{runtime.label}</div>
                  <p class="cx-product-row__meta">
                    {STATUS_LABEL[runtime.status]}
                    {runtime.fingerprint ? ` · ${runtime.fingerprint}` : ''}
                  </p>
                </div>
                <div class="cx-product-row__action">
                  <Button variant="secondary" onClick={() => props.onRemoveSsh(runtime.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </RemoteStateView>
    </>
  );
}

/**
 * Where Code runs: Cloud, a paired machine, or a server over SSH.
 *
 * This screen is the answer to "the browser cannot run a harness". It does not
 * pretend otherwise — it is the place you connect the machine that can.
 */
export function RuntimesScreen(props: RuntimesScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Runtimes"
        subtitle="Cortex Cloud runs sessions with no setup. Pair a machine to run them where your code already is."
        actions={
          <Show when={props.signedIn}>
            <Button variant="primary" onClick={() => props.onPair()}>Pair a machine</Button>
          </Show>
        }
      />
      <PageBody width="list">
        <Show
          when={props.signedIn}
          fallback={
            <HonestState
              kind="signed-out"
              title="Runtimes need a Cortex account"
              body="A paired machine is registered against your account, so Cortex knows where to send a run."
              actionLabel="Sign in"
              onAction={props.onSignIn}
            />
          }
        >
          <Show when={props.pairingError}>
            <p class="cx-product-error" role="alert">{props.pairingError}</p>
          </Show>
          <Show when={props.pairingCode}>
            {(code) => <PairingCode code={code()} onDismiss={props.onDismissCode} />}
          </Show>
          <PairedHosts {...props} />
          <SshRuntimes {...props} />
        </Show>
      </PageBody>
    </>
  );
}
