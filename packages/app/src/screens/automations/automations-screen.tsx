import { For, type JSX, Show } from 'solid-js';

import { Button, type IconName } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { Gate, Section, StatRow, Tile, type StatProps } from '../shared/data.tsx';

export interface Automation {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** When it runs, e.g. "Runs nightly at 02:00" or "On every pull request". */
  trigger: string;
  enabled: boolean;
}

export interface AutomationsScreenProps {
  capabilities: Capabilities;
  stats: readonly StatProps[];
  active: readonly Automation[];
  /** Templates the user has not enabled yet. */
  suggested: readonly Automation[];
  onToggle: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onSignIn: () => void;
}

function AutomationGrid(props: {
  automations: readonly Automation[];
  enabled: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <div class="cx-tiles">
      <For each={props.automations}>
        {(automation) => (
          <Tile
            title={automation.title}
            body={automation.description}
            icon={automation.icon}
            state={automation.trigger}
            enabled={props.enabled}
            actionLabel={props.enabled ? 'Disable' : 'Enable'}
            onAction={() => props.onToggle(automation.id, !props.enabled)}
            onOpen={() => props.onOpen(automation.id)}
          />
        )}
      </For>
    </div>
  );
}

/**
 * Automations.
 *
 * Active and suggested are separate sections rather than one list with a state column,
 * because they answer different questions: what is running, and what else could. Merging
 * them would bury the two or three live automations among a dozen templates.
 */
export function AutomationsScreen(props: AutomationsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Recurring work Cortex runs without being asked."
        actions={
          <Show when={props.capabilities.automations}>
            <Button variant="primary" icon="plusSmall" onClick={() => props.onCreate()}>
              New automation
            </Button>
          </Show>
        }
      />

      <PageBody width="list">
        <Show
          when={props.capabilities.automations}
          fallback={
            <Gate
              title="Automations need a Cortex account"
              body="An automation runs on a schedule or a repository event, which means it has to run somewhere other than this machine. Sign in to schedule work on Cortex cloud runtimes."
              actionLabel="Sign in to Cortex"
              onAction={props.onSignIn}
            />
          }
        >
          <AutomationSections {...props} />
        </Show>
      </PageBody>
    </>
  );
}

function AutomationSections(props: AutomationsScreenProps): JSX.Element {
  return (
    <div class="cx-settings">
      <StatRow stats={props.stats} />

      <Section title="Active" note={`${props.active.length} running`}>
        <Show
          when={props.active.length > 0}
          fallback={
            <p class="cx-table__empty">
              Nothing is running yet. Enable one of the suggestions below.
            </p>
          }
        >
          <AutomationGrid
            automations={props.active}
            enabled
            onToggle={props.onToggle}
            onOpen={props.onOpen}
          />
        </Show>
      </Section>

      <Section title="Suggested">
        <AutomationGrid
          automations={props.suggested}
          enabled={false}
          onToggle={props.onToggle}
          onOpen={props.onOpen}
        />
      </Section>
    </div>
  );
}
