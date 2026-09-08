/**
 * Automations, and the form that creates one.
 *
 * Both go through main, which is the only process that can honour them: chokidar
 * watchers and cron schedules cannot live in a renderer, and a schedule that only
 * fires while a window is open is not a schedule.
 */

import { createMemo, createResource, createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { describeWorkspaceError } from '@cortex-ide/cortex-api';
import type { Automation as StoredAutomation, Trigger } from '@cortex-ide/shared';
import type { IconName } from '@cortex-ide/ui';

import { useAccount } from '../state/session-context.tsx';
import { resolveAutomationHost, type AutomationHost } from '../state/automation-host.ts';
import {
  AutomationsScreen,
  type Automation as AutomationTile,
} from '../screens/automations/automations-screen.tsx';
import {
  describeCron,
  NewAutomationScreen,
  type NewAutomationDraft,
} from '../screens/automations/new-automation-screen.tsx';

/**
 * Templates offered when the list is empty.
 *
 * Marked as suggestions, not as automations that exist — the screen renders them
 * in its own section with the toggles off. Enabling one opens the form pre-filled
 * rather than creating it silently: a standing instruction that starts running
 * because someone flicked a switch is not something to guess at.
 */
const SUGGESTIONS: readonly AutomationTile[] = [
  {
    id: 'suggest-dependency-audit',
    title: 'Nightly dependency audit',
    description: 'Look for outdated or vulnerable dependencies and open a pull request.',
    icon: 'automations',
    trigger: 'Runs nightly at 02:00',
    enabled: false,
  },
  {
    id: 'suggest-test-triage',
    title: 'Triage failing tests',
    description: 'When a test file changes, run it and summarise what broke.',
    icon: 'review',
    trigger: 'On every change under tests/',
    enabled: false,
  },
];

const SUGGESTION_DRAFTS: Record<string, NewAutomationDraft> = {
  'suggest-dependency-audit': {
    name: 'Nightly dependency audit',
    kind: 'schedule',
    cron: '0 2 * * *',
    patterns: '',
    prompt:
      'Check for outdated or vulnerable dependencies. If any are behind, update them and open a pull request explaining what changed.',
  },
  'suggest-test-triage': {
    name: 'Triage failing tests',
    kind: 'file_watch',
    cron: '0 2 * * *',
    patterns: 'tests/**/*',
    prompt: 'Run the tests that cover the changed files and summarise any failures.',
  },
};

const EMPTY_DRAFT: NewAutomationDraft = {
  name: '',
  kind: 'schedule',
  cron: '0 2 * * *',
  patterns: '',
  prompt: '',
};

/** Reads a stored automation's trigger back as the line the tile shows. */
function describeTrigger(automation: StoredAutomation): string {
  const trigger = automation.trigger;
  if (trigger.type === 'schedule') return describeCron(trigger.cron);
  if (trigger.type === 'file_watch') {
    const patterns = trigger.patterns.join(', ');
    return `When ${patterns || 'watched files'} change`;
  }
  if (trigger.type === 'git_hook') return 'On a git hook';
  return 'Only when you run it';
}

const TRIGGER_ICONS: Record<string, IconName> = {
  schedule: 'automations',
  file_watch: 'repo',
  git_hook: 'branch',
  manual: 'send',
};

/**
 * Projects a stored automation onto the tile.
 *
 * The description is the agent's own instruction, which is the most useful thing
 * to show: the name is what the user called it, the prompt is what it will do.
 */
function toTile(automation: StoredAutomation): AutomationTile {
  const aiAction = automation.actions.find((action) => action.type === 'ai_task');
  const description =
    aiAction && 'prompt' in aiAction && typeof aiAction.prompt === 'string'
      ? aiAction.prompt
      : `${automation.actions.length} action${automation.actions.length === 1 ? '' : 's'}`;

  return {
    id: automation.id,
    title: automation.name,
    description,
    icon: TRIGGER_ICONS[automation.trigger.type] ?? 'automations',
    trigger: describeTrigger(automation),
    enabled: automation.enabled,
  };
}

/**
 * Builds the trigger from the form's chosen kind.
 *
 * `workspacePath`, `events`, `provider` and `model` are left empty: main fills them
 * in. The path is a disk location the renderer is deliberately not sent, and the
 * provider is whichever one the stored key actually registered — guessing either
 * here would produce an automation that fails on its first firing, hours later,
 * with nobody watching.
 */
function toTrigger(draft: NewAutomationDraft): Trigger {
  if (draft.kind === 'schedule') return { type: 'schedule', cron: draft.cron.trim() };
  if (draft.kind === 'file_watch') {
    return {
      type: 'file_watch',
      patterns: draft.patterns
        .split(',')
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern.length > 0),
      events: [],
      workspacePath: '',
    };
  }
  return { type: 'manual' };
}

export function AutomationsRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();
  const host = resolveAutomationHost();

  const [automations, { mutate }] = createResource(
    async () => {
      try {
        return await host.list();
      } catch {
        return [];
      }
    },
    { initialValue: [] as StoredAutomation[] },
  );

  const tiles = createMemo(() => automations().map(toTile));

  const stats = createMemo(() => {
    const all = automations();
    const enabled = all.filter((automation) => automation.enabled).length;
    return [
      { label: 'Automations', value: String(all.length) },
      { label: 'Enabled', value: String(enabled) },
    ];
  });

  const toggle = async (id: string, enabled: boolean) => {
    // A suggestion has no stored automation to toggle; enabling it opens the form
    // pre-filled instead of creating a standing instruction from a switch.
    if (id.startsWith('suggest-')) {
      navigate(`/automations/new?template=${id}`);
      return;
    }
    try {
      const updated = await host.toggle(id, enabled);
      mutate((current) =>
        current.map((automation) => (automation.id === id ? updated : automation)),
      );
    } catch {
      // The list is authoritative; a failed toggle leaves it as it was rather than
      // showing a switch in a position nothing stored.
    }
  };

  return (
    <AutomationsScreen
      capabilities={account.capabilities()}
      stats={stats()}
      active={tiles()}
      // Suggestions are hidden once there is something real: they are an empty
      // state, not a permanent catalogue.
      suggested={tiles().length === 0 ? SUGGESTIONS : []}
      onToggle={(id, enabled) => void toggle(id, enabled)}
      onOpen={(id) => navigate(`/automations/${id}`)}
      onCreate={() => navigate('/code/automations/new')}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

/** Reads `?template=` so a suggestion can open the form pre-filled. */
function initialDraft(host: AutomationHost): NewAutomationDraft {
  void host;
  const template = new URLSearchParams(globalThis.location?.hash?.split('?')[1] ?? '').get(
    'template',
  );
  return template ? (SUGGESTION_DRAFTS[template] ?? EMPTY_DRAFT) : EMPTY_DRAFT;
}

export function NewAutomationRoute(): JSX.Element {
  const navigate = useNavigate();
  const host = resolveAutomationHost();

  const [draft, setDraft] = createSignal<NewAutomationDraft>(initialDraft(host));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const create = async () => {
    const current = draft();
    setBusy(true);
    setError(undefined);
    try {
      await host.create({
        name: current.name.trim(),
        trigger: toTrigger(current),
        actions: [{ type: 'ai_task', prompt: current.prompt.trim(), provider: '' as never, model: '' }],
        // A manual automation is created enabled too: "enabled" for it means
        // "listed and runnable", not "scheduled".
        enabled: true,
      });
      navigate('/code/automations');
    } catch (caught) {
      setError(describeWorkspaceError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <NewAutomationScreen
      draft={draft()}
      onDraftChange={setDraft}
      onCreate={() => void create()}
      onCancel={() => navigate('/code/automations')}
      busy={busy()}
      {...(error() ? { error: error()! } : {})}
    />
  );
}
