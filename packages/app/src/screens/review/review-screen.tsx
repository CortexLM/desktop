import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { Button, Chip, StatusBadge, type SessionStatus } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { Gate, Section, Table } from '../shared/data.tsx';

export interface ReviewItem {
  id: string;
  title: string;
  repo: string;
  /** Pull-request number, once one exists. */
  pullRequest?: number;
  status: SessionStatus;
  diff: { added: number; removed: number };
  /** Pre-formatted, e.g. "2h ago". */
  age: string;
}

export interface ReviewScreenProps {
  capabilities: Capabilities;
  items: readonly ReviewItem[];
  onOpen: (id: string) => void;
  onSignIn: () => void;
}

const REVIEW_COLUMNS = [
  { key: 'title', label: 'Session' },
  { key: 'repo', label: 'Repository', muted: true },
  { key: 'status', label: 'Status' },
  { key: 'diff', label: 'Changes', numeric: true },
  { key: 'age', label: 'Finished', numeric: true, muted: true },
  { key: 'actions', label: '', numeric: true },
] as const;

function reviewRow(item: ReviewItem, onOpen: (id: string) => void): Record<string, JSX.Element> {
  return {
    title: <>{item.title}</>,
    repo: <>{item.repo}</>,
    status: <StatusBadge status={item.status} />,
    diff: (
      <span class="cx-review__diff">
        <span class="cx-review__added">+{item.diff.added}</span>
        <span class="cx-review__removed">
          {'\u2212'}
          {item.diff.removed}
        </span>
      </span>
    ),
    age: <>{item.age}</>,
    actions: (
      <span class="cx-review__actions">
        <Show when={item.pullRequest}>
          {(number) => (
            <Chip variant="outlined" mono icon="pullRequest">
              #{number()}
            </Chip>
          )}
        </Show>
        <Button variant="secondary" onClick={() => onOpen(item.id)}>
          Open
        </Button>
      </span>
    ),
  };
}

/**
 * Review: what the agent has produced that is waiting on a person.
 *
 * Sorted by the caller rather than here. "Waiting longest" and "highest risk" are both
 * defensible orders and the screen has no way to know which the team wants, so imposing one
 * would be guessing.
 */
export function ReviewScreen(props: ReviewScreenProps): JSX.Element {
  return (
    <>
      <PageHeader title="Review" subtitle="Sessions that finished and are waiting on you." />

      <PageBody width="list">
        <Show
          when={props.capabilities.review}
          fallback={
            <Gate
              title="Review needs a Cortex account"
              body="Review collects work across a team's repositories, which means it has to see sessions other people ran. Sign in to share a review queue."
              actionLabel="Sign in to Cortex"
              onAction={props.onSignIn}
            />
          }
        >
          <Section title="Awaiting review" note={`${props.items.length} open`}>
            <Table
              caption="Sessions awaiting review"
              emptyMessage="Nothing is waiting on you."
              columns={REVIEW_COLUMNS}
              rows={props.items.map((item) => reviewRow(item, props.onOpen))}
            />
          </Section>
        </Show>
      </PageBody>
    </>
  );
}
