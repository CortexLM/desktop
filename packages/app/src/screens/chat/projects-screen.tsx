import { For, type JSX } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { ChatProject } from '../../state/projects.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import './product-pages.css';

export interface ProjectsScreenProps {
  projects: readonly ChatProject[];
  state: RemoteState;
  error?: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
}

export function ProjectsScreen(props: ProjectsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="A brief and the sources that belong to it."
        actions={<Button variant="primary" onClick={() => props.onCreate()}>New project</Button>}
      />
      <PageBody width="list">
        <RemoteStateView
          state={props.state}
          {...(props.error ? { error: props.error } : {})}
          label="Projects"
          emptyTitle="No projects yet"
          emptyBody="A project holds a brief and the sources you attach to it. Nothing is invented here."
          emptyActionLabel="New project"
          onEmptyAction={props.onCreate}
          onRetry={props.onRetry}
        >
          <div class="cx-product-list">
            <For each={props.projects}>
              {(project) => (
                <button type="button" class="cx-product-row" onClick={() => props.onOpen(project.id)}>
                  <div>
                    <div class="cx-product-row__title">{project.title}</div>
                    <p class="cx-product-row__meta">
                      {project.brief || 'No brief yet.'}
                    </p>
                  </div>
                </button>
              )}
            </For>
          </div>
        </RemoteStateView>
      </PageBody>
    </>
  );
}
