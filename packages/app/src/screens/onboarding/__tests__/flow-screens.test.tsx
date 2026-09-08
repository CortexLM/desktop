import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  ConnectGitHubScreen,
  SshConnectScreen,
  WorkspaceSetupScreen,
  type FlowStep,
} from '../flow-screens.tsx';

const STEPS: FlowStep[] = [
  { id: 'account', label: 'Account', done: true },
  { id: 'github', label: 'GitHub', done: false },
  { id: 'workspace', label: 'Workspace', done: false },
];

describe('Flow progress', () => {
  it('names each step rather than counting them', () => {
    // "2 of 4" says less than the names themselves, and the names are worth reading.
    render(() => (
      <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={vi.fn()} />
    ));

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('marks completed steps', () => {
    render(() => <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getAllByLabelText('Done')).toHaveLength(1);
    expect(screen.getAllByLabelText('Not started')).toHaveLength(2);
  });

  it('omits the stepper on a single-step screen', () => {
    const { container } = render(() => (
      <SshConnectScreen onConnect={vi.fn()} onCancel={vi.fn()} />
    ));
    expect(container.querySelector('.cx-flow__steps')).toBeNull();
  });
});

describe('Connect GitHub', () => {
  it('lists what the app is being granted, item by item', () => {
    // A consent screen that says "access your repositories" and nothing else is asking for
    // trust it has not earned.
    render(() => <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByText('Read the repositories you choose')).toBeInTheDocument();
    expect(screen.getByText('Create branches and open pull requests')).toBeInTheDocument();
  });

  it('is skippable, and says what skipping means', () => {
    // A user who only wants local sessions against a repo already on disk has no need for a
    // GitHub app, and forcing one would make the anonymous path a lie.
    const onSkip = vi.fn();
    render(() => <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={onSkip} />);

    const skip = screen.getByRole('button', { name: 'Skip — I will work on local repositories' });
    fireEvent.click(skip);
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('starts the installation', () => {
    const onConnect = vi.fn();
    render(() => <ConnectGitHubScreen steps={STEPS} onConnect={onConnect} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Install the Cortex GitHub app/ }));
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('never asks for a GitHub token or password', () => {
    const { container } = render(() => (
      <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={vi.fn()} />
    ));
    const text = container.textContent ?? '';
    expect(container.querySelector('input')).toBeNull();
    expect(text.toLowerCase()).not.toMatch(/personal access|paste a token|ghp_/);
  });

  it('blocks the action while a flow is in flight', () => {
    render(() => (
      <ConnectGitHubScreen steps={STEPS} onConnect={vi.fn()} onSkip={vi.fn()} busy />
    ));
    expect(screen.getByRole('button', { name: /Install the Cortex GitHub app/ })).toBeDisabled();
  });

  it('never labels opening a local folder as an installation', () => {
    const onOpenFolder = vi.fn();
    render(() => <ConnectGitHubScreen steps={STEPS} onOpenFolder={onOpenFolder} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Install the Cortex GitHub app' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open a local repository' }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it('does not offer a folder picker without a desktop action', () => {
    render(() => <ConnectGitHubScreen steps={STEPS} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Install the Cortex GitHub app' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Open a local repository' })).toBeNull();
  });

  it('announces a failure assertively', () => {
    render(() => (
      <ConnectGitHubScreen
        steps={STEPS}
        onConnect={vi.fn()}
        onSkip={vi.fn()}
        error="The installation was cancelled"
      />
    ));
    expect(screen.getByRole('alert')).toHaveTextContent('cancelled');
  });
});

describe('Workspace setup', () => {
  it('opens the folder picker instead of asking for a name', () => {
    const onCreate = vi.fn();
    render(() => <WorkspaceSetupScreen steps={STEPS} onCreate={onCreate} />);

    expect(screen.queryByLabelText('Workspace name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('says the folder already has a name', () => {
    render(() => <WorkspaceSetupScreen steps={STEPS} onCreate={vi.fn()} />);
    expect(screen.getByText(/folder already has a name/i)).toBeInTheDocument();
  });

  it('holds the action while the picker is open', () => {
    render(() => <WorkspaceSetupScreen steps={STEPS} onCreate={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeDisabled();
  });

  it('explains This PC is desktop-only when the picker cannot run', () => {
    const { container } = render(() => (
      <WorkspaceSetupScreen steps={STEPS} onCreate={vi.fn()} thisPcAvailable={false} />
    ));
    expect(screen.queryByRole('button', { name: 'Choose folder' })).toBeNull();
    expect(container.textContent).toMatch(/desktop app/i);
    expect(container.querySelector('input')).toBeNull();
  });
});

describe('SSH connect', () => {
  it('defaults the port to 22 and leaves it editable', () => {
    // A non-standard SSH port is common enough that hiding it behind an "advanced" toggle
    // costs more than showing it.
    render(() => <SshConnectScreen onConnect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Port')).toHaveValue('22');
  });

  it('holds the action until host and user are both given', () => {
    render(() => <SshConnectScreen onConnect={vi.fn()} onCancel={vi.fn()} />);
    const connect = screen.getByRole('button', { name: 'Connect' });

    expect(connect).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Host'), { target: { value: 'build-01.internal' } });
    expect(connect).toBeDisabled();

    fireEvent.input(screen.getByLabelText('User'), { target: { value: 'deploy' } });
    expect(connect).not.toBeDisabled();
  });

  it('hands over a trimmed target', () => {
    const onConnect = vi.fn();
    render(() => <SshConnectScreen onConnect={onConnect} onCancel={vi.fn()} />);

    fireEvent.input(screen.getByLabelText('Host'), { target: { value: '  build-01  ' } });
    fireEvent.input(screen.getByLabelText('User'), { target: { value: ' deploy ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(onConnect).toHaveBeenCalledWith({ host: 'build-01', user: 'deploy', port: '22' });
  });

  it('cancels', () => {
    const onCancel = vi.fn();
    render(() => <SshConnectScreen onConnect={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls the target SSH, never This PC or This desktop', () => {
    const view = render(() => <SshConnectScreen onConnect={vi.fn()} onCancel={vi.fn()} />);
    const text = view.container.textContent ?? '';
    expect(text).toMatch(/SSH/);
    expect(text.toLowerCase()).not.toMatch(/\bthis pc\b|\bthis desktop\b/);
  });

  it('announces a connection failure', () => {
    render(() => (
      <SshConnectScreen
        onConnect={vi.fn()}
        onCancel={vi.fn()}
        error="Could not reach build-01.internal on port 22"
      />
    ));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach');
  });
});
