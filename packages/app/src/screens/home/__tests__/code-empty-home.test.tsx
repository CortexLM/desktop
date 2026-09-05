import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import { CodeEmptyHome } from '../code-empty-home.tsx';
import type { SessionDraft } from '../home-screen.tsx';

function renderEmpty(overrides: {
  capabilities?: typeof ANONYMOUS_CAPABILITIES;
  draft?: SessionDraft;
  onDraftChange?: (draft: SessionDraft) => void;
  onStart?: (draft: SessionDraft) => void;
} = {}) {
  const onStart = overrides.onStart ?? vi.fn();
  const onDraftChange = overrides.onDraftChange ?? vi.fn();
  const draft = overrides.draft ?? { prompt: '', runtime: 'local' as const };

  const result = render(() => (
    <CodeEmptyHome
      capabilities={overrides.capabilities ?? ANONYMOUS_CAPABILITIES}
      draft={draft}
      onDraftChange={onDraftChange}
      onStart={onStart}
    />
  ));

  return { ...result, onStart, onDraftChange };
}

describe('Code empty home', () => {
  it('ships the English headline and a session CTA, not a download', () => {
    renderEmpty();

    expect(screen.getByRole('heading', { name: 'Ship features, not lines.' })).toBeInTheDocument();
    expect(screen.getByText(/parallel sessions on your real codebase/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download|get /i })).toBeNull();
  });

  it('starts a session on This PC with a real starter prompt', () => {
    const { onStart, onDraftChange } = renderEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Start a session' }));

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'local',
        prompt: 'Look around this workspace and summarise the layout.',
      }),
    );
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'local',
        prompt: 'Look around this workspace and summarise the layout.',
      }),
    );
  });

  it('offers This PC, SSH and Cloud, and locks the account-only hosts when signed out', () => {
    renderEmpty();

    expect(screen.getByRole('button', { name: 'This PC' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'SSH' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cloud' })).toBeDisabled();
    expect(screen.getByText('Cloud and SSH need a Cortex account.')).toBeInTheDocument();
  });

  it('lets a signed-in account pick Cloud', () => {
    const onDraftChange = vi.fn();
    renderEmpty({ capabilities: AUTHENTICATED_CAPABILITIES, onDraftChange });

    fireEvent.click(screen.getByRole('button', { name: 'Cloud' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ runtime: 'cloud' }));
    expect(screen.queryByText('Cloud and SSH need a Cortex account.')).toBeNull();
  });

  it('does not tell a signed-in web account that Cloud needs a sign-in', () => {
    renderEmpty({
      capabilities: { ...AUTHENTICATED_CAPABILITIES, runtimes: ['cloud', 'ssh'] },
      draft: { prompt: '', runtime: 'cloud' },
    });

    expect(screen.getByRole('button', { name: 'This PC' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cloud' })).not.toBeDisabled();
    expect(screen.getByText('This PC runs in the Cortex desktop app.')).toBeInTheDocument();
    expect(screen.queryByText('Cloud and SSH need a Cortex account.')).toBeNull();
  });

  it('explains both missing hosts when the tab has none', () => {
    renderEmpty({
      capabilities: { ...ANONYMOUS_CAPABILITIES, runtimes: [] },
      draft: { prompt: '', runtime: 'cloud' },
    });

    expect(screen.getByText(/This PC is the Cortex desktop app/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a session' })).toBeDisabled();
  });

  it('names the preview model in Cortex product language', () => {
    renderEmpty();
    expect(screen.getByText('Cortex Codex')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Claude|Opus|Grok|Cursor/i);
  });
});
