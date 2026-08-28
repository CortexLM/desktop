import { createEffect, createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import {
  addRoutine,
  forgetFact,
  groups,
  handoffTo,
  inbox,
  loadGroups,
  loadMemory,
  loadRoutines,
  loadSkills,
  memory,
  openSkill,
  panelError,
  panelState,
  routines,
  runMascotSkill,
  skillDoc,
  skills,
  toggleRoutine,
} from '../state/bot-grok-store.ts';
import {
  BotGroupsScreen,
  BotMemoryScreen,
  BotRoutinesScreen,
  BotSkillsScreen,
} from '../screens/bot/mascot-grok-screens.tsx';
import { useBotMascot } from './bot-mascot.ts';

export function BotMemoryRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  createEffect(() => {
    const current = mascot();
    if (current) void loadMemory(current.id);
  });
  return (
    <BotMemoryScreen
      mascot={mascot()}
      facts={memory()}
      state={panelState()}
      error={panelError()}
      onForget={(id, tier) => {
        const current = mascot();
        if (current) void forgetFact(current.id, id, tier);
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

export function BotSkillsRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  createEffect(() => {
    void loadSkills();
  });
  return (
    <BotSkillsScreen
      mascot={mascot()}
      skills={skills()}
      doc={skillDoc()}
      state={panelState()}
      error={panelError()}
      onOpen={(slug) => void openSkill(slug)}
      onRun={(slug) => {
        const current = mascot();
        if (current) void runMascotSkill(current.id, slug);
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

export function BotRoutinesRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  const [name, setName] = createSignal('');
  createEffect(() => {
    const current = mascot();
    if (current) void loadRoutines(current.id);
  });
  return (
    <BotRoutinesScreen
      mascot={mascot()}
      routines={routines()}
      state={panelState()}
      error={panelError()}
      draftName={name()}
      onDraftName={setName}
      onCreate={() => {
        const current = mascot();
        if (current && name().trim()) {
          void addRoutine(current.id, name().trim()).then(() => setName(''));
        }
      }}
      onToggle={(routine) => {
        const current = mascot();
        if (current) void toggleRoutine(current.id, routine);
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

export function BotGroupsRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  const [toId, setToId] = createSignal('');
  const [note, setNote] = createSignal('');
  createEffect(() => {
    const current = mascot();
    if (current) void loadGroups(current.id);
  });
  return (
    <BotGroupsScreen
      mascot={mascot()}
      groups={groups()}
      inbox={inbox()}
      state={panelState()}
      error={panelError()}
      toId={toId()}
      note={note()}
      onToId={setToId}
      onNote={setNote}
      onHandoff={() => {
        const current = mascot();
        if (current && toId().trim()) {
          void handoffTo(current.id, toId().trim(), note().trim() || undefined).then(() => {
            setToId('');
            setNote('');
          });
        }
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}
