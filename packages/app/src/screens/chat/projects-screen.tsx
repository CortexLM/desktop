import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { ChatProject } from '../../state/projects.ts';

import './product-pages.css';

export interface ProjectsScreenProps {
  projects: readonly ChatProject[];
  loading?: boolean;
  error?: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
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
        <Show when={!props.loading} fallback={<HonestState kind="loading" title="Loading projects" body="Opening your list." />}>
          <Show when={!props.error} fallback={<HonestState kind="error" title="Could not load projects" body={props.error ?? ''} />}>
            <Show
              when={props.projects.length > 0}
              fallback={
                <HonestState
                  kind="empty"
                  title="No projects yet"
                  body="A project holds a brief and the files you attach to it. Nothing is invented here."
                  actionLabel="New project"
                  onAction={props.onCreate}
                />
              }
            >
              <div class="cx-product-list">
                <For each={props.projects}>
                  {(project) => (
                    <button type="button" class="cx-product-row" onClick={() => props.onOpen(project.id)}>
                      <div>
                        <div class="cx-product-row__title">{project.title}</div>
                        <p class="cx-product-row__meta">
                          {project.sources.length} source{project.sources.length === 1 ? '' : 's'}
                          {project.brief ? ` · ${project.brief}` : ''}
                        </p>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </PageBody>
    </>
  );
}
