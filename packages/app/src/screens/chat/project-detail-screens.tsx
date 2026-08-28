import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { ChatProject, ProjectSourceKind } from '../../state/projects.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import './product-pages.css';

/**
 * What to show when there is no project to show.
 *
 * Distinguishes "still loading" from "no such project" from "could not read it".
 * Before, every one of the three rendered "This project is not on this device",
 * which was wrong twice and, now that projects live on the account, wrong three
 * times.
 */
function ProjectFallback(props: {
  state: RemoteState;
  error?: string;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.state !== 'loading' && props.state !== 'idle'}
      fallback={<HonestState kind="loading" title="Opening project" body="Reading the brief and its sources." />}
    >
      <HonestState
        kind="error"
        title={props.state === 'disconnected' ? 'Not connected to Cortex' : 'Project not found'}
        body={props.error || 'This project is not on your account.'}
        actionLabel="Back to projects"
        onAction={props.onBack}
      />
    </Show>
  );
}

export function ProjectScreen(props: {
  project?: ChatProject;
  state: RemoteState;
  error?: string;
  onOpenSources: () => void;
  onSaveBrief: (brief: string) => void;
  onBack: () => void;
}): JSX.Element {
  const [brief, setBrief] = createSignal<string | undefined>();

  return (
    <Show
      when={props.project}
      fallback={
        <ProjectFallback
          state={props.state}
          {...(props.error ? { error: props.error } : {})}
          onBack={props.onBack}
        />
      }
    >
      {(project) => (
        <>
          <PageHeader
            title={project().title}
            subtitle={`${project().sources.length} attached source${project().sources.length === 1 ? '' : 's'}`}
            actions={<Button variant="secondary" onClick={() => props.onOpenSources()}>Sources</Button>}
          />
          <PageBody width="list">
            {/* An editable brief, because a project whose brief could only be
                empty was a field with no way to fill it. */}
            <form
              class="cx-product-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onSaveBrief(brief() ?? project().brief);
              }}
            >
              <input
                type="text"
                value={brief() ?? project().brief}
                placeholder="What is this project for?"
                aria-label="Project brief"
                onInput={(event) => setBrief(event.currentTarget.value)}
              />
              <Button variant="secondary" type="submit">Save brief</Button>
            </form>
          </PageBody>
        </>
      )}
    </Show>
  );
}

const SOURCE_KINDS: readonly ProjectSourceKind[] = ['url', 'file', 'folder', 'plugin'];

function AddSourceForm(props: {
  onAdd: (source: { label: string; kind: ProjectSourceKind }) => void;
}): JSX.Element {
  const [label, setLabel] = createSignal('');
  const [kind, setKind] = createSignal<ProjectSourceKind>('url');

  return (
    <form
      class="cx-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = label().trim();
        if (!value) return;
        props.onAdd({ label: value, kind: kind() });
        setLabel('');
      }}
    >
      <input
        type="text"
        value={label()}
        placeholder="Link, file name, or folder"
        aria-label="Source"
        onInput={(event) => setLabel(event.currentTarget.value)}
      />
      <select
        aria-label="Source kind"
        value={kind()}
        onChange={(event) => setKind(event.currentTarget.value as ProjectSourceKind)}
      >
        <For each={SOURCE_KINDS}>{(entry) => <option value={entry}>{entry}</option>}</For>
      </select>
      <Button variant="primary" type="submit">Add source</Button>
    </form>
  );
}

export function ProjectSourcesScreen(props: {
  project?: ChatProject;
  state: RemoteState;
  error?: string;
  onAdd: (source: { label: string; kind: ProjectSourceKind }) => void;
  onRemove: (sourceId: string) => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.project}
      fallback={
        <ProjectFallback
          state={props.state}
          {...(props.error ? { error: props.error } : {})}
          onBack={props.onBack}
        />
      }
    >
      {(project) => (
        <>
          <PageHeader
            title={`${project().title} · Sources`}
            subtitle="Files, folders, plugins, and links that belong only to this project."
            actions={<Button variant="secondary" onClick={() => props.onBack()}>Back</Button>}
          />
          <PageBody width="list">
            <AddSourceForm onAdd={props.onAdd} />
            <Show
              when={project().sources.length > 0}
              fallback={
                <HonestState
                  kind="empty"
                  title="No sources"
                  body="Attach a file, a folder, a plugin, or a URL. This list stays empty until you do."
                />
              }
            >
              <div class="cx-product-list">
                <For each={project().sources}>
                  {(source) => (
                    <div class="cx-product-row" data-source={source.id}>
                      <div>
                        <div class="cx-product-row__title">{source.label}</div>
                        <p class="cx-product-row__meta">{source.kind}</p>
                      </div>
                      <div class="cx-product-row__action">
                        <Button variant="secondary" onClick={() => props.onRemove(source.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}
