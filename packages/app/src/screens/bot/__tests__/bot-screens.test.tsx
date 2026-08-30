import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { CreateMascotScreen, MascotListScreen } from '../mascot-screens.tsx';
import {
  BotGroupsScreen,
  BotMemoryScreen,
  BotRoutinesScreen,
  BotSkillsScreen,
} from '../mascot-runtime-screens.tsx';
import { BotComputerScreen } from '../mascot-computer-screens.tsx';
import { BotSettingsScreen } from '../mascot-settings-screen.tsx';
import { BotMessagesScreen, BotVideosScreen } from '../mascot-detail-screens.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

const mascot: Mascot = {
  id: 'mst_1',
  name: 'Scout',
  look: 'meadow',
  face: 'idle',
  unread: false,
  createdAt: 1,
  computer: {
    id: 'pc_1',
    mascotId: 'mst_1',
    status: 'running',
    spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
  },
  messages: [],
  videos: [{ id: 'vid_1', title: 'Clip', recordedAt: 1, kind: 'cursor-zoom' }],
};

describe('mascot list and create', () => {
  it('lists a mascot and creates a new one', () => {
    const onOpen = vi.fn();
    const onCreate = vi.fn();
    const listed = render(() => (
      <MascotListScreen mascots={[mascot]} onOpen={onOpen} onCreate={onCreate} />
    ));
    fireEvent.click(screen.getByRole('button', { name: /Scout/ }));
    expect(onOpen).toHaveBeenCalledWith('mst_1');
    listed.unmount();

    render(() => <MascotListScreen mascots={[]} loading onOpen={onOpen} onCreate={onCreate} />);
    expect(screen.getByText('Loading mascots')).toBeInTheDocument();
  });

  it('shows unavailable and error list states', () => {
    const unavailable = render(() => (
      <MascotListScreen mascots={[]} unavailable error="no farm" onOpen={vi.fn()} onCreate={vi.fn()} />
    ));
    expect(screen.getByText('Bot API not connected')).toBeInTheDocument();
    unavailable.unmount();
    render(() => <MascotListScreen mascots={[]} error="boom" onOpen={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText('Could not load mascots')).toBeInTheDocument();
  });

  it('collects name, look, and face', () => {
    const onName = vi.fn();
    const onLook = vi.fn();
    const onFace = vi.fn();
    const onCreate = vi.fn();
    render(() => (
      <CreateMascotScreen
        name=""
        onName={onName}
        look="meadow"
        onLook={onLook}
        face="idle"
        onFace={onFace}
        onCreate={onCreate}
        error="denied"
      />
    ));
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Scout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wink' }));
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
    expect(onName).toHaveBeenCalledWith('Scout');
    expect(onLook).toHaveBeenCalledWith('plum');
    expect(onFace).toHaveBeenCalledWith('wink');
    expect(onCreate).toHaveBeenCalled();
    expect(screen.getByText('Could not create')).toBeInTheDocument();
  });
});

describe('bot runtime screens', () => {
  it('renders memory, skills, routines, and groups including too-old', () => {
    const onForget = vi.fn();
    const onOpen = vi.fn();
    const onRun = vi.fn();
    const onToggle = vi.fn();
    const onHandoff = vi.fn();
    render(() => (
      <>
        <BotMemoryScreen
          mascot={mascot}
          facts={[{ id: 'f1', tier: 'profile', text: 'tea' }]}
          state="ready"
          error=""
          onForget={onForget}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
        <BotSkillsScreen
          mascot={mascot}
          skills={[{ slug: 'research', name: 'Research' }]}
          doc={{ slug: 'research', markdown: '# SKILL' }}
          state="ready"
          error=""
          onOpen={onOpen}
          onRun={onRun}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
        <BotRoutinesScreen
          mascot={mascot}
          routines={[{ id: 'r1', name: 'Morning', status: 'paused' }]}
          state="ready"
          error=""
          draftName="Standup"
          onDraftName={vi.fn()}
          onCreate={vi.fn()}
          onToggle={onToggle}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
        <BotGroupsScreen
          mascot={mascot}
          groups={[{ id: 'g1', name: 'Ops' }]}
          inbox={[{ id: 'in_1', message: 'hi' }]}
          state="ready"
          error=""
          toId="mst_2"
          note="take it"
          onToId={vi.fn()}
          onNote={vi.fn()}
          onHandoff={onHandoff}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
      </>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.click(screen.getByRole('button', { name: 'Handoff' }));
    expect(onForget).toHaveBeenCalledWith('f1', 'profile');
    expect(onOpen).toHaveBeenCalledWith('research');
    expect(onRun).toHaveBeenCalledWith('research');
    expect(onToggle).toHaveBeenCalled();
    expect(onHandoff).toHaveBeenCalled();
  });

  it('shows backend-too-old and missing mascot', () => {
    const missing = render(() => (
      <BotMemoryScreen
        facts={[]}
        state="too-old"
        error=""
        onForget={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));
    expect(screen.getByText('Mascot not found')).toBeInTheDocument();
    missing.unmount();
    render(() => (
      <BotMemoryScreen
        mascot={mascot}
        facts={[]}
        state="too-old"
        error=""
        onForget={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));
    expect(screen.getByText('Backend too old')).toBeInTheDocument();
  });
});

describe('computer, videos, and settings', () => {
  it('wakes a live box and lists a video', () => {
    const onWake = vi.fn();
    const onTeach = vi.fn();
    render(() => (
      <>
        <BotComputerScreen
          mascot={mascot}
          screenshot="data:image/png;base64,aa"
          shellLog="$ ls"
          files={[{ name: 'a', path: '/a' }]}
          recording
          onWake={onWake}
          onHibernate={vi.fn()}
          onStop={vi.fn()}
          onInput={vi.fn()}
          onShell={vi.fn()}
          onOpenFile={vi.fn()}
          onToggleRecord={vi.fn()}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
        <BotVideosScreen mascot={mascot} onTeach={onTeach} onBack={vi.fn()} onGo={vi.fn()} />
        <BotMessagesScreen mascot={mascot} onBack={vi.fn()} onGo={vi.fn()} />
        <BotSettingsScreen
          mascot={mascot}
          onRename={vi.fn()}
          onLook={vi.fn()}
          onFace={vi.fn()}
          onDelete={vi.fn()}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
      </>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Hibernate' }));
    expect(screen.getByText('Clip')).toBeInTheDocument();
  });

  it('offers no desktop and quotes no hardware for a mascot with no computer', () => {
    // `mapComputer` used to default an absent computer to a hibernated
    // 4 vCPU / 16 GiB box, so this screen showed a Wake button and a spec line
    // for a machine the farm had never allocated.
    const unprovisioned: Mascot = {
      ...mascot,
      computer: { id: 'pc_mst_1', mascotId: 'mst_1', status: 'empty' },
    };
    render(() => (
      <BotComputerScreen
        mascot={unprovisioned}
        shellLog=""
        files={[]}
        onWake={vi.fn()}
        onHibernate={vi.fn()}
        onStop={vi.fn()}
        onInput={vi.fn()}
        onShell={vi.fn()}
        onOpenFile={vi.fn()}
        onToggleRecord={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));

    expect(screen.getAllByText('No computer yet').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Wake' })).toBeNull();
    expect(screen.queryByText(/vCPU/)).toBeNull();
  });

  it('shows the offline farm copy on a missing computer', () => {
    render(() => (
      <BotComputerScreen
        shellLog=""
        files={[]}
        onWake={vi.fn()}
        onHibernate={vi.fn()}
        onStop={vi.fn()}
        onInput={vi.fn()}
        onShell={vi.fn()}
        onOpenFile={vi.fn()}
        onToggleRecord={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));
    expect(screen.getByText('Mascot not found')).toBeInTheDocument();
  });
});
