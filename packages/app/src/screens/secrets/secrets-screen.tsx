import { createSignal, Show, type JSX } from 'solid-js';

import { Button, Chip, TextField } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { Section, Table } from '../shared/data.tsx';

export interface Secret {
  id: string;
  /** The environment-variable name sessions reference, e.g. STRIPE_KEY. */
  name: string;
  /** Where it is stored: on this machine, or synced to the account. */
  scope: 'local' | 'account';
  /** Pre-formatted, e.g. "3d ago". Absent when it has never been used. */
  lastUsed?: string;
}

export interface SecretsScreenProps {
  capabilities: Capabilities;
  secrets: readonly Secret[];
  onCreate: (name: string, value: string) => void;
  onDelete: (id: string) => void;
  /**
   * A create or delete that did not take.
   *
   * Shown rather than swallowed: the name is validated in main as well as here, so
   * a rejection can arrive for a reason the form did not anticipate — and a silent
   * one leaves the user staring at a list that never grew.
   */
  error?: string;
}

/** Environment-variable naming: uppercase, digits and underscores, not starting with a digit. */
function isValidName(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

interface SecretFormProps {
  synced: boolean;
  validate: (name: string) => string | undefined;
  onCreate: (name: string, value: string) => void;
}

function SecretForm(props: SecretFormProps): JSX.Element {
  const [name, setName] = createSignal('');
  const [value, setValue] = createSignal('');

  const error = () => props.validate(name().trim());
  const canCreate = () => name().trim() !== '' && value() !== '' && error() === undefined;

  const create = () => {
    if (!canCreate()) return;
    props.onCreate(name().trim(), value());
    setName('');
    setValue('');
  };

  return (
    <Section
      title="Add a secret"
      note={props.synced ? 'Synced to your Cortex account' : 'Stored on this machine only'}
    >
      <form
        class="cx-settings__card cx-secret-form"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <TextField
          label="Name"
          placeholder="STRIPE_KEY"
          value={name()}
          error={error()}
          hint="Reference it in prompts with $NAME"
          // Upper-cased as it is typed rather than on submit, so the field always shows the
          // name the session will actually reference.
          onInput={(event) => setName(event.currentTarget.value.toUpperCase())}
        />
        <TextField
          label="Value"
          type="password"
          autocomplete="off"
          placeholder="Paste the value"
          value={value()}
          onInput={(event) => setValue(event.currentTarget.value)}
        />
        <div>
          <Button type="submit" variant="primary" disabled={!canCreate()}>
            Add secret
          </Button>
        </div>
      </form>
    </Section>
  );
}

function SecretsTable(props: {
  secrets: readonly Secret[];
  onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <Section title="Stored secrets" note={`${props.secrets.length} total`}>
      <Table
        caption="Stored secrets"
        emptyMessage="No secrets yet. Sessions can only use values you add here."
        columns={[
          { key: 'name', label: 'Name', mono: true },
          { key: 'scope', label: 'Scope', muted: true },
          { key: 'lastUsed', label: 'Last used', muted: true },
          { key: 'actions', label: '', numeric: true },
        ]}
        rows={props.secrets.map((secret) => ({
          name: (
            <Chip variant="outlined" mono icon="lock">
              {secret.name}
            </Chip>
          ),
          scope: <>{secret.scope === 'account' ? 'Cortex account' : 'This machine'}</>,
          lastUsed: <>{secret.lastUsed ?? 'Never'}</>,
          actions: (
            <Button variant="ghost" onClick={() => props.onDelete(secret.id)}>
              Delete
            </Button>
          ),
        }))}
      />
    </Section>
  );
}

/**
 * Secrets.
 *
 * A secret's value is write-only. Once stored it is never returned to the renderer, so there
 * is no reveal action and no masked display - the list shows names, scope and last use only.
 * Anything else would imply the value could be recovered from this screen.
 *
 * Without an account, secrets are stored on this machine and stay here. That is stated in
 * the scope column rather than hidden, because a user who signs in later will want to know
 * which of their secrets did not follow them.
 */
export function SecretsScreen(props: SecretsScreenProps): JSX.Element {
  const validate = (candidate: string): string | undefined => {
    if (candidate === '') return undefined;
    if (!isValidName(candidate)) return 'Use uppercase letters, digits and underscores';
    if (props.secrets.some((secret) => secret.name === candidate)) return 'That name is taken';
    return undefined;
  };

  return (
    <>
      <PageHeader
        title="Secrets"
        subtitle="Values sessions can reference without them appearing in a prompt or a log."
      />

      <PageBody width="settings">
        <div class="cx-settings">
          {/* `role="alert"` because the list simply does not change on a rejection,
              and an unchanged list is indistinguishable from never having clicked. */}
          <Show when={props.error}>
            {(message) => (
              <p class="cx-settings__error" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <SecretForm
            synced={props.capabilities.syncedSecrets}
            validate={validate}
            onCreate={props.onCreate}
          />
          <SecretsTable secrets={props.secrets} onDelete={props.onDelete} />
        </div>
      </PageBody>
    </>
  );
}
