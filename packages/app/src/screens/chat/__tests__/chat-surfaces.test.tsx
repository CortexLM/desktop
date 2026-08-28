import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { LibraryScreen } from '../library-plugins-screens.tsx';
import { ProjectsScreen } from '../projects-screen.tsx';
import { ProjectScreen, ProjectSourcesScreen } from '../project-detail-screens.tsx';
import { ChatSettingsScreen, ResearchScreen } from '../research-settings-screens.tsx';
import { RemoteStateView } from '../../shared/remote-state-view.tsx';
import type { ChatProject } from '../../../state/projects.ts';

const PROJECT: ChatProject = {
  id: 'proj_1',
  title: 'Brief for Ana',
  brief: 'why this exists',
  updatedAt: 0,
  sources: [{ id: 'src_1', label: 'notes.md', kind: 'file' }],
};

describe('RemoteStateView', () => {
  it('gives each lifecycle its own words', () => {
    const loading = render(() => (
      <RemoteStateView state="loading" label="Widgets" emptyTitle="None" emptyBody="b">
        <p>rows</p>
      </RemoteStateView>
    ));
    expect(screen.getByText('Loading widgets')).toBeInTheDocument();
    loading.unmount();

    const unsupported = render(() => (
      <RemoteStateView state="unsupported" label="Widgets" error="not here" emptyTitle="None" emptyBody="b">
        <p>rows</p>
      </RemoteStateView>
    ));
    // A missing route must not read as "you have nothing".
    expect(screen.getByText('Widgets is not on this backend')).toBeInTheDocument();
    unsupported.unmount();

    const onRetry = vi.fn();
    const disconnected = render(() => (
      <RemoteStateView
        state="disconnected"
        label="Widgets"
        error="no connection"
        emptyTitle="None"
        emptyBody="b"
        onRetry={onRetry}
      >
        <p>rows</p>
      </RemoteStateView>
    ));
    expect(screen.getByText('Not connected to Cortex')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    disconnected.unmount();

    const errored = render(() => (
      <RemoteStateView state="error" label="Widgets" error="boom" emptyTitle="None" emptyBody="b">
        <p>rows</p>
      </RemoteStateView>
    ));
    expect(screen.getByText('Could not load widgets')).toBeInTheDocument();
    errored.unmount();

    const empty = render(() => (
      <RemoteStateView state="empty" label="Widgets" emptyTitle="None yet" emptyBody="add one">
        <p>rows</p>
      </RemoteStateView>
    ));
    expect(screen.getByText('None yet')).toBeInTheDocument();
    empty.unmount();

    render(() => (
      <RemoteStateView state="ready" label="Widgets" emptyTitle="None" emptyBody="b">
        <p>rows</p>
      </RemoteStateView>
    ));
    expect(screen.getByText('rows')).toBeInTheDocument();
  });
});

describe('LibraryScreen', () => {
  it('needs an account, because a saved answer lives on one', () => {
    const onSignIn = vi.fn();
    render(() => (
      <LibraryScreen
        items={[]}
        state="idle"
        signedIn={false}
        onRetry={vi.fn()}
        onSignIn={onSignIn}
      />
    ));

    expect(screen.getByText('Sign in to keep a library')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('lists saved answers and removes one', () => {
    const onRemove = vi.fn();
    render(() => (
      <LibraryScreen
        items={[{ id: 'l1', title: 'Tokyo plan', kind: 'answer', excerpt: 'five days', savedAt: 0 }]}
        state="ready"
        signedIn
        onRemove={onRemove}
        onRetry={vi.fn()}
        onSignIn={vi.fn()}
      />
    ));

    expect(screen.getByText('Tokyo plan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('l1');
  });
});

describe('ProjectsScreen', () => {
  it('lists projects and creates one', () => {
    const onCreate = vi.fn();
    const onOpen = vi.fn();
    render(() => (
      <ProjectsScreen
        projects={[PROJECT]}
        state="ready"
        onOpen={onOpen}
        onCreate={onCreate}
        onRetry={vi.fn()}
      />
    ));

    fireEvent.click(screen.getByText('Brief for Ana'));
    expect(onOpen).toHaveBeenCalledWith('proj_1');
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('reports a missing projects route rather than no projects', () => {
    render(() => (
      <ProjectsScreen
        projects={[]}
        state="unsupported"
        error="Projects is not available on this Cortex backend yet."
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onRetry={vi.fn()}
      />
    ));
    expect(screen.getByText('Projects is not on this backend')).toBeInTheDocument();
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
  });
});

describe('ProjectScreen', () => {
  it('edits the brief a project could previously only lack', () => {
    const onSaveBrief = vi.fn();
    render(() => (
      <ProjectScreen
        project={PROJECT}
        state="ready"
        onOpenSources={vi.fn()}
        onSaveBrief={onSaveBrief}
        onBack={vi.fn()}
      />
    ));

    expect(screen.getByText('1 attached source')).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText('Project brief'), { target: { value: 'new brief' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save brief' }));
    expect(onSaveBrief).toHaveBeenCalledWith('new brief');
  });

  it('tells loading apart from a project that is not there', () => {
    const loading = render(() => (
      <ProjectScreen
        state="loading"
        onOpenSources={vi.fn()}
        onSaveBrief={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('Opening project')).toBeInTheDocument();
    loading.unmount();

    const disconnected = render(() => (
      <ProjectScreen
        state="disconnected"
        error="Projects need a connection to Cortex."
        onOpenSources={vi.fn()}
        onSaveBrief={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('Not connected to Cortex')).toBeInTheDocument();
    disconnected.unmount();

    render(() => (
      <ProjectScreen
        state="error"
        onOpenSources={vi.fn()}
        onSaveBrief={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    // No longer "not on this device": projects live on the account.
    expect(screen.getByText('This project is not on your account.')).toBeInTheDocument();
  });
});

describe('ProjectSourcesScreen', () => {
  it('attaches a real source instead of an Untitled placeholder', () => {
    const onAdd = vi.fn();
    render(() => (
      <ProjectSourcesScreen
        project={PROJECT}
        state="ready"
        onAdd={onAdd}
        onRemove={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    fireEvent.input(screen.getByLabelText('Source'), { target: { value: 'https://example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(onAdd).toHaveBeenCalledWith({ label: 'https://example', kind: 'url' });
  });

  it('removes a source and refuses a blank one', () => {
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    render(() => (
      <ProjectSourcesScreen
        project={PROJECT}
        state="ready"
        onAdd={onAdd}
        onRemove={onRemove}
        onBack={vi.fn()}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('src_1');
  });

  it('shows an empty source list', () => {
    render(() => (
      <ProjectSourcesScreen
        project={{ ...PROJECT, sources: [] }}
        state="ready"
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('No sources')).toBeInTheDocument();
  });
});

describe('ResearchScreen', () => {
  it('queues a question once the account has answered', () => {
    const onStart = vi.fn();
    render(() => (
      <ResearchScreen
        runs={[]}
        state="empty"
        signedIn
        onStart={onStart}
        onRetry={vi.fn()}
        onSignIn={vi.fn()}
      />
    ));

    fireEvent.input(screen.getByLabelText('Research question'), {
      target: { value: 'Who ships fastest?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledWith('Who ships fastest?');
  });

  it('hides the composer when the backend has no research route', () => {
    render(() => (
      <ResearchScreen
        runs={[]}
        state="unsupported"
        error="Research is not available on this Cortex backend yet."
        signedIn
        onStart={vi.fn()}
        onRetry={vi.fn()}
        onSignIn={vi.fn()}
      />
    ));

    // A box that accepts a question nothing will act on is worse than no box.
    expect(screen.queryByLabelText('Research question')).not.toBeInTheDocument();
    expect(screen.getByText('Research is not on this backend')).toBeInTheDocument();
  });

  it('lists runs and opens the conversation a finished one landed in', () => {
    const onOpen = vi.fn();
    render(() => (
      <ResearchScreen
        runs={[
          { id: 'r1', question: 'Why?', status: 'done', sourceCount: 3, conversationId: 'cnv_2' },
          { id: 'r2', question: 'How?', status: 'running', sourceCount: 0 },
        ]}
        state="ready"
        signedIn
        onStart={vi.fn()}
        onOpen={onOpen}
        onRetry={vi.fn()}
        onSignIn={vi.fn()}
      />
    ));

    expect(screen.getByText('3 sources')).toBeInTheDocument();
    expect(screen.getByText('Researching')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('gates on an account', () => {
    const onSignIn = vi.fn();
    render(() => (
      <ResearchScreen
        runs={[]}
        state="idle"
        signedIn={false}
        onStart={vi.fn()}
        onRetry={vi.fn()}
        onSignIn={onSignIn}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });
});

describe('ChatSettingsScreen', () => {
  it('saves a toggle when the account can hold it', () => {
    const onStreamReplies = vi.fn();
    render(() => (
      <ChatSettingsScreen
        streamReplies
        onStreamReplies={onStreamReplies}
        notifyMentions
        onNotifyMentions={vi.fn()}
        editable
      />
    ));

    fireEvent.click(screen.getByLabelText('Stream replies'));
    expect(onStreamReplies).toHaveBeenCalledWith(false);
  });

  it('locks the toggles rather than letting them move and save nowhere', () => {
    render(() => (
      <ChatSettingsScreen
        streamReplies
        onStreamReplies={vi.fn()}
        notifyMentions
        onNotifyMentions={vi.fn()}
        editable={false}
        error="This Cortex backend does not store Chat preferences yet."
      />
    ));

    expect(screen.getByLabelText('Stream replies')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/does not store Chat preferences/);
    expect(screen.getByText(/These are the shipped defaults/)).toBeInTheDocument();
  });
});
