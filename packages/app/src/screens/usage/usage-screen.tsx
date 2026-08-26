import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { Gate, Section, StatRow, Table, type StatProps } from '../shared/data.tsx';

export interface UsageRow {
  id: string;
  /** Model id or display name. */
  model: string;
  sessions: number;
  /** Credits consumed, pre-formatted so the caller controls rounding. */
  credits: string;
  /** Share of the period's total, pre-formatted, e.g. "42%". */
  share: string;
}

export interface UsageScreenProps {
  capabilities: Capabilities;
  /** Period the figures cover, e.g. "1-25 August". */
  period: string;
  stats: readonly StatProps[];
  rows: readonly UsageRow[];
  onSignIn: () => void;
}

/**
 * Usage.
 *
 * Every figure here is metered server-side, so without an account there is nothing to show -
 * not an empty table, but no data source at all. That distinction is why the signed-out
 * state is a gate explaining the requirement rather than a table with zeroes in it, which
 * would imply the user had run nothing.
 */
export function UsageScreen(props: UsageScreenProps): JSX.Element {
  return (
    <>
      <PageHeader title="Usage" subtitle={`Credits and sessions for ${props.period}.`} />

      <PageBody width="usage">
        <Show
          when={props.capabilities.usageReporting}
          fallback={
            <Gate
              title="Usage is reported for Cortex accounts"
              body="Sessions you run with your own provider keys are billed by that provider, so Cortex has no meter to read. Sign in to see credits, session counts and per-model breakdowns."
              actionLabel="Sign in to Cortex"
              onAction={props.onSignIn}
            />
          }
        >
          <div class="cx-settings">
            <StatRow stats={props.stats} />

            <Section title="By model" note={props.period}>
              <Table
                caption={`Usage by model for ${props.period}`}
                emptyMessage="No sessions ran in this period."
                columns={[
                  { key: 'model', label: 'Model' },
                  { key: 'sessions', label: 'Sessions', numeric: true },
                  { key: 'credits', label: 'Credits', numeric: true },
                  { key: 'share', label: 'Share', numeric: true, muted: true },
                ]}
                rows={props.rows.map((row) => ({
                  model: <>{row.model}</>,
                  sessions: <>{row.sessions}</>,
                  credits: <>{row.credits}</>,
                  share: <>{row.share}</>,
                }))}
              />
            </Section>
          </div>
        </Show>
      </PageBody>
    </>
  );
}
