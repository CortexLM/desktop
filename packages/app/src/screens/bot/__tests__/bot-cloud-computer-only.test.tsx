/**
 * Cortex Bot's computer is a cloud farm box. This PC is Code on the desktop
 * app. SSH is SSH, on Code. These tests fail if those Code hosts leak into Bot.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { CreateMascotScreen, MascotListScreen } from '../mascot-screens.tsx';
import { BotComputerScreen } from '../mascot-computer-screens.tsx';
import { BotConversationScreen } from '../conversation-screen.tsx';
import { ComputerDesktop } from '../computer-desktop.tsx';
import {
  computerLabel,
  mapComputer,
  type BotComputer,
  type Mascot,
} from '../../../state/bot-map.ts';

const FORBIDDEN = /\bthis pc\b|\bthis desktop\b/i;

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
  videos: [],
};

function botProductionFiles(): string[] {
  const roots = [
    join(import.meta.dirname, '..'),
    join(import.meta.dirname, '../../../routes'),
    join(import.meta.dirname, '../../../state'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const path = join(entry.parentPath, entry.name);
      if (path.includes('/__tests__/') || path.includes('\\__tests__\\')) continue;
      const relative = path.replace(/\\/g, '/');
      const inBotScreen = relative.includes('/screens/bot/');
      const inBotRoute = /\/routes\/bot[-.]/.test(relative);
      const inBotState = /\/state\/bot[-.]/.test(relative);
      if (inBotScreen || inBotRoute || inBotState) files.push(path);
    }
  }
  return files;
}

function withComputer(status: BotComputer['status']): Mascot {
  return { ...mascot, computer: { ...mascot.computer, status } };
}

function renderComputer(row: Mascot) {
  return render(() => (
    <BotComputerScreen
      mascot={row}
      screenshot="data:image/png;base64,aa"
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
}

describe('Bot never offers This PC or This desktop', () => {
  it('keeps those phrases out of Bot production source', () => {
    const hits: string[] = [];
    for (const file of botProductionFiles()) {
      if (FORBIDDEN.test(readFileSync(file, 'utf8'))) hits.push(file);
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('does not put This PC, This desktop, or SSH on create or the roster', () => {
    const create = render(() => (
      <CreateMascotScreen
        name="Scout"
        onName={vi.fn()}
        look="meadow"
        onLook={vi.fn()}
        face="idle"
        onFace={vi.fn()}
        onCreate={vi.fn()}
      />
    ));
    const text = create.container.textContent ?? '';
    expect(text).toMatch(/cloud computer/i);
    expect(text).not.toMatch(FORBIDDEN);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /^SSH$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /This PC/i })).toBeNull();
    create.unmount();

    const list = render(() => (
      <MascotListScreen mascots={[mascot]} onOpen={vi.fn()} onCreate={vi.fn()} />
    ));
    expect(list.container.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('does not put This PC or This desktop on the computer page', () => {
    const live = renderComputer(mascot);
    expect(live.container.textContent ?? '').not.toMatch(FORBIDDEN);
    expect(screen.queryByRole('radio')).toBeNull();
    live.unmount();

    const asleep = renderComputer(withComputer('hibernated'));
    expect(asleep.container.textContent ?? '').not.toMatch(FORBIDDEN);
    asleep.unmount();

    const offline = renderComputer(withComputer('offline'));
    const text = offline.container.textContent ?? '';
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).toMatch(/cloud computer/i);
  });

  it('does not put This PC or This desktop on conversation or the live frame', () => {
    const chat = render(() => (
      <BotConversationScreen
        mascot={mascot}
        draft=""
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onAnswer={vi.fn()}
        onSecret={vi.fn()}
        onGo={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(chat.container.textContent ?? '').not.toMatch(FORBIDDEN);
    chat.unmount();

    const frame = render(() => <ComputerDesktop offline onInput={vi.fn()} />);
    expect(frame.container.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('labels a farm box by status even when the API names a Code host', () => {
    const labeled = computerLabel(
      mapComputer(
        { id: 'mst_1' },
        { id: 'pc_1', mascot_id: 'mst_1', status: 'running', runtime: 'this_pc' } as never,
      ),
    );
    expect(labeled.toLowerCase()).not.toMatch(FORBIDDEN);
    expect(labeled.toLowerCase()).not.toBe('ssh');
  });
});
