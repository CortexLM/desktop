import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import type { ApiMemoryFact, ApiRoutine, ApiSkill, ApiBotGroup, ApiBotInboxItem } from '@cortex-ide/cortex-api';
import { backendTooOldCopy } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import type { GrokPanelState } from '../../state/bot-grok-store.ts';
import type { Mascot } from '../../state/bot-map.ts';

import '../chat/product-pages.css';

function Missing(props: { onBack: () => void }): JSX.Element {
  return (
    <HonestState kind="error" title="Mascot not found" body="Open a mascot first." actionLabel="Back" onAction={props.onBack} />
  );
}

function PanelState(props: { state: GrokPanelState; error: string; surface: string }): JSX.Element | null {
  if (props.state === 'too-old') {
    const copy = backendTooOldCopy(props.surface);
    return <HonestState kind="error" title={copy.title} body={copy.body} />;
  }
  if (props.state === 'error') {
    return <HonestState kind="error" title={`Could not load ${props.surface}`} body={props.error} />;
  }
  return null;
}

export function BotMemoryScreen(props: {
  mascot?: Mascot;
  facts: readonly ApiMemoryFact[];
  state: GrokPanelState;
  error: string;
  onForget: (id: string, tier: 'profile' | 'log') => void;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Memory" subtitle="Profile facts and recent log. Forget removes a fact on the server." />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'memory', props.onGo)} />
            <PanelState state={props.state} error={props.error} surface="Memory" />
            <Show when={props.state === 'ready' && props.facts.length === 0}>
              <HonestState kind="empty" title="No memory yet" body="Facts this mascot keeps will land here." />
            </Show>
            <div class="cx-product-list">
              <For each={props.facts}>
                {(fact) => (
                  <div class="cx-product-row">
                    <div>
                      <div class="cx-product-row__title">{fact.tier ?? 'note'}</div>
                      <p class="cx-product-row__meta">{fact.text ?? fact.content ?? ''}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => props.onForget(fact.id, fact.tier === 'log' ? 'log' : 'profile')}
                    >
                      Forget
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </PageBody>
        </>
      )}
    </Show>
  );
}

export function BotSkillsScreen(props: {
  mascot?: Mascot;
  skills: readonly ApiSkill[];
  doc?: ApiSkill;
  state: GrokPanelState;
  error: string;
  onOpen: (slug: string) => void;
  onRun: (slug: string) => void;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Skills" subtitle="Open SKILL.md, then run it on this mascot." />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'skills', props.onGo)} />
            <PanelState state={props.state} error={props.error} surface="Skills" />
            <Show when={props.state === 'ready' && props.skills.length === 0}>
              <HonestState kind="empty" title="No skills" body="The skills library is empty on this backend." />
            </Show>
            <div class="cx-product-list">
              <For each={props.skills}>
                {(skill) => (
                  <div class="cx-product-row">
                    <div>
                      <div class="cx-product-row__title">{skill.name ?? skill.title ?? skill.slug}</div>
                      <p class="cx-product-row__meta">{skill.description ?? skill.slug}</p>
                    </div>
                    <Button variant="secondary" onClick={() => props.onOpen(skill.slug)}>Open</Button>
                    <Button variant="primary" onClick={() => props.onRun(skill.slug)}>Run</Button>
                  </div>
                )}
              </For>
            </div>
            <Show when={props.doc}>
              {(doc) => <pre class="cx-product-row__meta">{doc().markdown ?? doc().body ?? ''}</pre>}
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}

export function BotRoutinesScreen(props: {
  mascot?: Mascot;
  routines: readonly ApiRoutine[];
  state: GrokPanelState;
  error: string;
  draftName: string;
  onDraftName: (value: string) => void;
  onCreate: () => void;
  onToggle: (routine: ApiRoutine) => void;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Routines" subtitle="Weekday daytime (09:00, Mon–Fri) unless you set another cron." />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'routines', props.onGo)} />
            <PanelState state={props.state} error={props.error} surface="Routines" />
            <RoutineForm
              draftName={props.draftName}
              onDraftName={props.onDraftName}
              onCreate={props.onCreate}
              routines={props.routines}
              state={props.state}
              onToggle={props.onToggle}
            />
          </PageBody>
        </>
      )}
    </Show>
  );
}

function RoutineForm(props: {
  draftName: string;
  onDraftName: (value: string) => void;
  onCreate: () => void;
  routines: readonly ApiRoutine[];
  state: GrokPanelState;
  onToggle: (routine: ApiRoutine) => void;
}): JSX.Element {
  return (
    <>
      <input
        class="cx-product-row"
        value={props.draftName}
        onInput={(event) => props.onDraftName(event.currentTarget.value)}
        placeholder="Morning briefing"
      />
      <Button variant="primary" onClick={() => props.onCreate()}>Create routine</Button>
      <Show when={props.state === 'ready' && props.routines.length === 0}>
        <HonestState kind="empty" title="No routines" body="Create one. It defaults to weekday daytime." />
      </Show>
      <div class="cx-product-list">
        <For each={props.routines}>
          {(routine) => (
            <div class="cx-product-row">
              <div>
                <div class="cx-product-row__title">{routine.name ?? routine.title ?? routine.id}</div>
                <p class="cx-product-row__meta">
                  {routine.cron ?? 'trigger'} · last {routine.last_run_at ?? 'never'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => props.onToggle(routine)}>
                {routine.paused || routine.status === 'paused' ? 'Resume' : 'Pause'}
              </Button>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

export function BotGroupsScreen(props: {
  mascot?: Mascot;
  groups: readonly ApiBotGroup[];
  inbox: readonly ApiBotInboxItem[];
  state: GrokPanelState;
  error: string;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Groups" subtitle="Inbox and handoff. An old backend shows an empty state, not a mock roster." />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'groups', props.onGo)} />
            <PanelState state={props.state} error={props.error} surface="Groups" />
            <Show when={props.state === 'ready' && props.groups.length === 0 && props.inbox.length === 0}>
              <HonestState kind="empty" title="No groups" body="No channels or inbox items on the server." />
            </Show>
            <For each={props.groups}>
              {(group) => (
                <div class="cx-product-row">
                  <div>
                    <div class="cx-product-row__title">{group.name ?? group.title ?? group.id}</div>
                    <p class="cx-product-row__meta">{group.kind ?? 'group'}</p>
                  </div>
                </div>
              )}
            </For>
            <For each={props.inbox}>
              {(item) => (
                <div class="cx-product-row">
                  <div>
                    <div class="cx-product-row__title">{item.kind ?? 'inbox'}</div>
                    <p class="cx-product-row__meta">{item.message ?? ''}</p>
                  </div>
                </div>
              )}
            </For>
          </PageBody>
        </>
      )}
    </Show>
  );
}
