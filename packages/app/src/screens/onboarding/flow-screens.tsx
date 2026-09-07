import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button, Icon, TextField } from '@cortex-ide/ui';

import { BrandMark } from '../../shell/brand-mark.tsx';

import '../auth/auth.css';
import './flow.css';

export interface FlowStep {
  id: string;
  label: string;
  done: boolean;
}

export interface FlowShellProps {
  title: string;
  subtitle: string;
  /** Progress across a multi-screen flow. Omitted on a single-step screen. */
  steps?: readonly FlowStep[];
  children: JSX.Element;
  /** Skips the whole flow. Present wherever the flow is genuinely optional. */
  onSkip?: () => void;
  skipLabel?: string;
}

/**
 * The frame shared by Onboarding, Auth Connect GitHub, Auth Workspace Setup and SSH Connect.
 *
 * All four are a centred card with a title, a body and one or two actions; three of them
 * also show where you are in a sequence. Writing that once means the four screens differ
 * only in their content, which is the only way they actually differ in the design.
 */
export function FlowShell(props: FlowShellProps): JSX.Element {
  return (
    <div class="cx-auth">
      <div class="cx-flow">
        <span class="cx-auth__mark">
          <BrandMark width={34} height={17} />
        </span>

        <h1 class="cx-auth__title">{props.title}</h1>
        <p class="cx-auth__subtitle">{props.subtitle}</p>

        <Show when={props.steps?.length ? props.steps : undefined}>
          {(steps) => (
            <ol class="cx-flow__steps">
              <For each={steps()}>
                {(step) => (
                  <li class={step.done ? 'cx-flow__step cx-flow__step--done' : 'cx-flow__step'}>
                    <span
                      class="cx-flow__step-mark"
                      role="img"
                      aria-label={step.done ? 'Done' : 'Not started'}
                    >
                      <Show when={step.done}>
                        <Icon name="checkSmall" size={9} />
                      </Show>
                    </span>
                    {step.label}
                  </li>
                )}
              </For>
            </ol>
          )}
        </Show>

        <div class="cx-flow__body">{props.children}</div>

        <Show when={props.onSkip}>
          {(skip) => (
            <button type="button" class="cx-auth__anonymous-action" onClick={() => skip()()}>
              {props.skipLabel ?? 'Skip for now'}
            </button>
          )}
        </Show>
      </div>
    </div>
  );
}

export interface ConnectGitHubScreenProps {
  steps: readonly FlowStep[];
  onConnect: () => void;
  onSkip: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * Auth Connect GitHub.
 *
 * Skippable, and that matters: a user who only wants local sessions against a repo already
 * on disk has no need for a GitHub app installation, and forcing one would make the
 * anonymous path a lie.
 */
export function ConnectGitHubScreen(props: ConnectGitHubScreenProps): JSX.Element {
  return (
    <FlowShell
      title="Connect GitHub"
      subtitle="So Cortex can read your repositories and open pull requests"
      steps={props.steps}
      onSkip={props.onSkip}
      skipLabel="Skip — I will work on local repositories"
    >
      <Show when={props.error}>
        {(error) => (
          <p class="cx-auth__error" role="alert">
            {error()}
          </p>
        )}
      </Show>

      <ul class="cx-flow__grants">
        <For
          each={[
            'Read the repositories you choose',
            'Create branches and open pull requests',
            'Read pull-request comments so sessions can respond to review',
          ]}
        >
          {(grant) => (
            <li class="cx-flow__grant">
              <Icon name="checkSmall" size={10} />
              {grant}
            </li>
          )}
        </For>
      </ul>

      <button
        type="button"
        class="cx-auth__provider cx-auth__provider--primary"
        disabled={props.busy}
        onClick={() => props.onConnect()}
      >
        <Icon name="github" size={16} />
        Install the Cortex GitHub app
      </button>
    </FlowShell>
  );
}

export interface WorkspaceSetupScreenProps {
  steps: readonly FlowStep[];
  onCreate: () => void;
  onSkip?: () => void;
  busy?: boolean;
  error?: string;
  /** False on web: This PC is the desktop folder picker. */
  thisPcAvailable?: boolean;
}

/**
 * Auth Workspace Setup.
 *
 * This PC *is* the folder. A name field would be ignored — the directory
 * already has a name, and the renderer never sees the path.
 */
export function WorkspaceSetupScreen(props: WorkspaceSetupScreenProps): JSX.Element {
  const available = props.thisPcAvailable !== false;

  return (
    <FlowShell
      title="Open a folder on This PC"
      subtitle={
        available
          ? 'This PC runs against that tree. The folder already has a name.'
          : 'This PC is available in the Cortex desktop app. Cloud and SSH start from Home once you have an account.'
      }
      steps={props.steps}
      onSkip={props.onSkip}
    >
      <Show when={props.error}>
        {(error) => (
          <p class="cx-auth__error" role="alert">
            {error()}
          </p>
        )}
      </Show>
      <Show when={available}>
        <Button
          type="button"
          variant="primary"
          block
          disabled={props.busy}
          onClick={() => props.onCreate()}
        >
          Choose folder
        </Button>
      </Show>
    </FlowShell>
  );
}

export interface SshConnectScreenProps {
  onConnect: (target: { host: string; user: string; port: string }) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * SSH Connect.
 *
 * The port defaults to 22 and is editable rather than hidden behind an "advanced" toggle:
 * a non-standard SSH port is common enough that hiding it costs more than showing it.
 */
function SshForm(props: {
  busy?: boolean;
  onConnect: (target: { host: string; user: string; port: string }) => void;
}): JSX.Element {
  const [host, setHost] = createSignal('');
  const [user, setUser] = createSignal('');
  const [port, setPort] = createSignal('22');

  const canConnect = () => !props.busy && host().trim() !== '' && user().trim() !== '';

  return (
    <form
      class="cx-flow__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canConnect()) return;
        props.onConnect({ host: host().trim(), user: user().trim(), port: port().trim() });
      }}
    >
      <TextField
        label="Host"
        placeholder="build-01.internal"
        value={host()}
        onInput={(event) => setHost(event.currentTarget.value)}
      />
      <TextField
        label="User"
        placeholder="deploy"
        value={user()}
        onInput={(event) => setUser(event.currentTarget.value)}
      />
      <TextField
        label="Port"
        value={port()}
        hint="Defaults to 22."
        onInput={(event) => setPort(event.currentTarget.value)}
      />
      <Button type="submit" variant="primary" block disabled={!canConnect()}>
        Connect
      </Button>
    </form>
  );
}

export function SshConnectScreen(props: SshConnectScreenProps): JSX.Element {
  return (
    <FlowShell
      title="Connect a server"
      subtitle="Run sessions on a machine you control over SSH"
      onSkip={props.onCancel}
      skipLabel="Cancel"
    >
      <Show when={props.error}>
        {(error) => (
          <p class="cx-auth__error" role="alert">
            {error()}
          </p>
        )}
      </Show>
      <SshForm busy={props.busy} onConnect={props.onConnect} />
    </FlowShell>
  );
}
