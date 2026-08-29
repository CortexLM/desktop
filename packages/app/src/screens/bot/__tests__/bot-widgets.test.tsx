import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  AskCard,
  SecretCard,
  SendToUserBubble,
  UserBubble,
  WorkRail,
} from '../conversation-widgets.tsx';
import { ComputerDesktop, releaseFrom } from '../computer-desktop.tsx';
import { FilesPanel, TerminalPanel } from '../computer-panels.tsx';
import { MascotRail, mascotLinks } from '../mascot-rail.tsx';

describe('conversation widgets', () => {
  it('renders send-to-user, ask options, secret, and work', () => {
    const onAnswer = vi.fn();
    const onSecret = vi.fn();
    render(() => (
      <>
        <UserBubble text="hello" />
        <SendToUserBubble
          name="Scout"
          message={{
            id: 'm1',
            seq: 0,
            role: 'assistant',
            kind: 'send_to_user',
            content: 'Ready.',
            at: 1,
            attachments: [{ name: 'clip.mp4' }],
          }}
        />
        <AskCard ask={{ prompt: 'Wake?', options: ['yes'], pending: true }} onAnswer={onAnswer} />
        <AskCard ask={{ prompt: 'Type it', pending: true }} onAnswer={onAnswer} />
        <SecretCard secret={{ name: 'token', reason: 'farm', pending: true }} onSubmit={onSecret} />
        <WorkRail items={[{ tool: 'shell', output: { ok: true } }, { output: 'plain' }]} />
      </>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    expect(onAnswer).toHaveBeenCalledWith('yes');
    fireEvent.input(screen.getByPlaceholderText('token'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save secret' }));
    expect(onSecret).toHaveBeenCalledWith('token', 'secret');
    expect(screen.getByText('Ready.')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });
});

describe('computer chrome', () => {
  it('shows the honest offline state and a waiting screenshot', () => {
    const offline = render(() => <ComputerDesktop offline onInput={vi.fn()} />);
    expect(offline.getByRole('status')).toHaveTextContent('farm or local daemon');
    offline.unmount();

    render(() => <ComputerDesktop offline={false} onInput={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Dedicated computer' })).toBeInTheDocument();
  });

  it('sends click, drag, scroll, and keys on a live frame', () => {
    const onInput = vi.fn();
    render(() => <ComputerDesktop offline={false} src="data:image/png;base64,aa" onInput={onInput} />);
    const frame = screen.getByRole('button');
    Object.defineProperty(frame, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    });
    fireEvent.pointerDown(frame, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(frame, { clientX: 10, clientY: 10 });
    fireEvent.pointerDown(frame, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(frame, { clientX: 80, clientY: 90 });
    fireEvent.wheel(frame, { deltaX: 0, deltaY: 40 });
    fireEvent.keyDown(frame, { key: 'a' });
    fireEvent.keyDown(frame, { key: 'Enter' });
    fireEvent.click(frame, { clientX: 20, clientY: 20, button: 2 });
    expect(onInput).toHaveBeenCalledWith(expect.objectContaining({ action: 'click' }));
    expect(onInput).toHaveBeenCalledWith(expect.objectContaining({ action: 'drag' }));
    expect(onInput).toHaveBeenCalledWith(expect.objectContaining({ action: 'scroll' }));
    expect(onInput).toHaveBeenCalledWith(expect.objectContaining({ action: 'type', text: 'a' }));
    expect(onInput).toHaveBeenCalledWith(expect.objectContaining({ action: 'key', key: 'Enter' }));
  });

  it('classifies a double-click from releaseFrom', () => {
    const target = document.createElement('button');
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    });
    const event = { currentTarget: target, clientX: 5, clientY: 5, detail: 2 } as unknown as MouseEvent;
    expect(releaseFrom({ x: 5, y: 5 }, event).action).toBe('double_click');
  });
});

describe('terminal, files, and rail', () => {
  it('runs a command and opens a file', () => {
    const onRun = vi.fn();
    const onOpen = vi.fn();
    const go = vi.fn();
    render(() => (
      <>
        <TerminalPanel log="" onRun={onRun} />
        <FilesPanel
          entries={[{ name: 'README.md', path: '/README.md' }]}
          preview={{ path: '/README.md', text: 'hi' }}
          onOpen={onOpen}
        />
        <MascotRail links={mascotLinks('mst_1', 'chat', go)} />
      </>
    ));

    fireEvent.input(screen.getByPlaceholderText('ls'), { target: { value: 'pwd' } });
    fireEvent.keyDown(screen.getByPlaceholderText('ls'), { key: 'Enter' });
    expect(onRun).toHaveBeenCalledWith('pwd');
    fireEvent.click(screen.getByRole('button', { name: 'README.md' }));
    expect(onOpen).toHaveBeenCalledWith('/README.md');
    fireEvent.click(screen.getByRole('button', { name: 'Computer' }));
    expect(go).toHaveBeenCalledWith('/bot/mst_1/computer');
  });
});
