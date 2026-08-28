import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { ChatProject } from '../../state/projects.ts';

import './product-pages.css';

export function ProjectScreen(props: {
  project?: ChatProject;
  onOpenSources: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.project}
      fallback={
        <HonestState
          kind="error"
          title="Project not found"
          body="This project is not on this device."
          actionLabel="Back to projects"
          onAction={props.onBack}
        />
      }
    >
      {(project) => (
        <>
          <PageHeader
            title={project().title}
            subtitle={project().brief || 'No brief yet.'}
            actions={<Button variant="secondary" onClick={() => props.onOpenSources()}>Sources</Button>}
          />
          <PageBody width="list">
            <p class="cx-product-row__meta">{project().sources.length} attached sources.</p>
          </PageBody>
        </>
      )}
    </Show>
  );
}

function SourceList(props: { project: ChatProject; onAdd: () => void }): JSX.Element {
  return (
    <Show
      when={props.project.sources.length > 0}
      fallback={
        <HonestState
          kind="empty"
          title="No sources"
          body="Attach a file, a folder, a plugin, or a URL. This list stays empty until you do."
          actionLabel="Add source"
          onAction={props.onAdd}
        />
      }
    >
      <div class="cx-product-list">
        <For each={props.project.sources}>
          {(source) => (
            <div class="cx-product-row">
              <div>
                <div class="cx-product-row__title">{source.label}</div>
                <p class="cx-product-row__meta">{source.kind}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

export function ProjectSourcesScreen(props: {
  project?: ChatProject;
  onAdd: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show
      when={props.project}
      fallback={
        <HonestState kind="error" title="Project not found" body="Nothing to attach sources to." actionLabel="Back" onAction={props.onBack} />
      }
    >
      {(project) => (
        <>
          <PageHeader
            title={`${project().title} · Sources`}
            subtitle="Files, folders, plugins, and links that belong only to this project."
            actions={<Button variant="primary" onClick={() => props.onAdd()}>Add source</Button>}
          />
          <PageBody width="list">
            <SourceList project={project()} onAdd={props.onAdd} />
          </PageBody>
        </>
      )}
    </Show>
  );
}
