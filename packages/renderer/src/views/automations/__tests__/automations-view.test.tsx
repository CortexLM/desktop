/**
 * Automations views: data shapes crossing IPC, and empty states that say why.
 *
 * Baseline: `packages/renderer/src/views/automations/` was at 0% line coverage
 * (0/230, read from lcov.info — the text reporter listed no row for the
 * directory at all).
 *
 * Two bugs were found and fixed while writing these tests; both are guarded
 * below and named on the test:
 *
 * 1. `AutomationList` swallowed its load error. A failed `automation:list`
 *    rendered "No automations yet" — the same screen as a genuinely empty
 *    workspace. That invites a user to recreate automations that already exist.
 * 2. `LogsViewer` had the same defect, and additionally printed
 *    "0 execution(s)" in its header: a false statement about the history rather
 *    than an admission that it could not be read.
 *
 * `formatTimestamp` is exercised through the rendered output rather than
 * directly: the relative-time thresholds are what a user reads, and a unit test
 * on a non-exported helper would not have caught the shape mismatch that makes
 * `startedAt` arrive as something other than a number.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Automation, AutomationLog } from '@cortex-ide/shared';

// ---------------------------------------------------------------------------
// Mocks that must be in place before the components import
// ---------------------------------------------------------------------------

/**
 * Monaco is mocked to a textarea. `ActionConfig` imports `@monaco-editor/react`
 * plus `lib/monaco-setup`, neither of which works under jsdom (no workers, no
 * canvas). The textarea keeps the `onChange` contract, which is the part
 * `ActionConfig` actually depends on.
 */
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <textarea
      data-testid="monaco-stub"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../../../lib/monaco-setup', () => ({}));

/**
 * `ModelSelector` fetches the provider's model list over IPC. The automation
 * editor only needs it to render and report a chosen model.
 */
vi.mock('../../../components/ai/ModelSelector', () => ({
  ModelSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (model: string) => void;
  }) => (
    <input
      data-testid="model-selector-stub"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const automationApi = {
  list: vi.fn(),
  getLogs: vi.fn(),
  toggle: vi.fn(),
  run: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  onStarted: vi.fn(),
  onCompleted: vi.fn(),
  onFailed: vi.fn(),
  onNotification: vi.fn(),
};

vi.mock('../../../lib/api', () => ({
  ipc: { automation: automationApi },
}));

const { AutomationList } = await import('../AutomationList');
const { LogsViewer } = await import('../LogsViewer');
const { AutomationEditor } = await import('../AutomationEditor');
const { TriggerConfig } = await import('../TriggerConfig');
const { ActionConfig } = await import('../ActionConfig');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const automation = (overrides: Partial<Automation> = {}): Automation => ({
  id: 'auto-1',
  workspaceId: 'ws-1',
  name: 'Lint on save',
  enabled: true,
  trigger: { type: 'manual' },
  actions: [{ type: 'run_script', script: 'echo hi' }],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

const log = (overrides: Partial<AutomationLog> = {}): AutomationLog => ({
  id: 'log-1',
  automationId: 'auto-1',
  status: 'success',
  startedAt: 1_700_000_000_000,
  completedAt: 1_700_000_003_000,
  actionResults: [
    { action: { type: 'run_script', script: 'echo hi' }, status: 'success', duration: 12 },
  ],
  ...overrides,
});

/** Event subscriptions the list registers, so tests can fire them. */
let subscriptions: {
  started: Array<(event: { automation: Automation; log: AutomationLog }) => void>;
  completed: Array<(event: { automation: Automation; log: AutomationLog }) => void>;
  failed: Array<(event: { automation: Automation; log: AutomationLog }) => void>;
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const noop = () => undefined;

beforeEach(() => {
  subscriptions = { started: [], completed: [], failed: [] };

  automationApi.list.mockReset().mockResolvedValue([]);
  automationApi.getLogs.mockReset().mockResolvedValue([]);
  automationApi.toggle.mockReset();
  automationApi.run.mockReset().mockResolvedValue(log());
  automationApi.delete.mockReset().mockResolvedValue(undefined);

  automationApi.onStarted.mockReset().mockImplementation((cb) => {
    subscriptions.started.push(cb);
    return () => undefined;
  });
  automationApi.onCompleted.mockReset().mockImplementation((cb) => {
    subscriptions.completed.push(cb);
    return () => undefined;
  });
  automationApi.onFailed.mockReset().mockImplementation((cb) => {
    subscriptions.failed.push(cb);
    return () => undefined;
  });

  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
});

function renderList(props: Partial<Parameters<typeof AutomationList>[0]> = {}) {
  return render(
    <AutomationList
      workspaceId="ws-1"
      onEdit={props.onEdit ?? noop}
      onCreate={props.onCreate ?? noop}
      onViewLogs={props.onViewLogs ?? noop}
    />
  );
}

// ===========================================================================
// Empty vs. broken — the bug found here
// ===========================================================================

describe('the automation list says why it is empty', () => {
  /**
   * Regression: a failed `automation:list` rendering "No automations yet".
   *
   * Found while writing this suite. The catch block logged to the console and
   * left `automations` as `[]`, so a broken IPC call and an empty workspace
   * produced the same screen — and the same call to action ("Create your first
   * automation") for a user whose automations were merely unreadable.
   */
  it('reports a load failure rather than claiming there are no automations', async () => {
    automationApi.list.mockRejectedValueOnce(new Error('database is locked'));

    renderList();

    await waitFor(() => expect(screen.getByTestId('automation-list-error')).toBeTruthy());
    expect(screen.getByText('database is locked')).toBeTruthy();
    expect(screen.queryByText('No automations yet')).toBeNull();
    expect(screen.queryByText('Create your first automation')).toBeNull();
  });

  it('claims there are no automations only when the load succeeded', async () => {
    automationApi.list.mockResolvedValueOnce([]);

    renderList();

    await waitFor(() => expect(screen.getByText('No automations yet')).toBeTruthy());
    expect(screen.queryByTestId('automation-list-error')).toBeNull();
  });

  it('clears the error once a retry succeeds', async () => {
    automationApi.list
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce([automation({ name: 'Format on commit' })]);

    renderList();
    await waitFor(() => expect(screen.getByTestId('automation-list-error')).toBeTruthy());

    await userEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('Format on commit')).toBeTruthy());
    expect(screen.queryByTestId('automation-list-error')).toBeNull();
  });

  /**
   * Regression: one unreadable log history hiding the whole list.
   *
   * `getLogs` is called per automation after the list loads. Before the fix a
   * rejection there propagated to the list's own catch block, so the automations
   * — already fetched successfully — were replaced by an error screen.
   */
  it('still shows the automations when only their last-run lookup fails', async () => {
    automationApi.list.mockResolvedValueOnce([automation({ name: 'Lint on save' })]);
    automationApi.getLogs.mockRejectedValueOnce(new Error('logs table missing'));

    renderList();

    await waitFor(() => expect(screen.getByText('Lint on save')).toBeTruthy());
    expect(screen.queryByTestId('automation-list-error')).toBeNull();
  });
});

// ===========================================================================
// Shapes crossing the IPC boundary
// ===========================================================================

describe('the list renders the fields the IPC contract promises', () => {
  it('passes the workspace id through to the list call', async () => {
    renderList();

    await waitFor(() => expect(automationApi.list).toHaveBeenCalledWith('ws-1'));
  });

  /**
   * Regression: `startedAt` arriving as something other than a number.
   *
   * The DB stores snake_case, nullable columns; the shared type declares
   * `startedAt: number`. When the mapping is missed, `new Date(undefined)`
   * produces an Invalid Date and the relative-time helper prints "NaNm ago".
   */
  it('renders a relative last-run time, not NaN or Invalid Date', async () => {
    automationApi.list.mockResolvedValueOnce([automation()]);
    automationApi.getLogs.mockResolvedValueOnce([
      log({ startedAt: Date.now() - 120_000, completedAt: Date.now() - 118_000 }),
    ]);

    renderList();

    await waitFor(() => expect(screen.getByText(/Last run: 2m ago/)).toBeTruthy());
    const item = screen.getByTestId('automation-item');
    expect(item.textContent).not.toContain('NaN');
    expect(item.textContent).not.toContain('Invalid Date');
  });

  it('labels a schedule trigger with its cron expression', async () => {
    automationApi.list.mockResolvedValueOnce([
      automation({ trigger: { type: 'schedule', cron: '*/15 * * * *' } }),
    ]);

    renderList();

    // `getTriggerLabel` switches on `trigger.type`; a shape the switch does not
    // know renders `undefined` into the row.
    await waitFor(() => expect(screen.getByText('Schedule: */15 * * * *')).toBeTruthy());
    expect(screen.getByTestId('automation-item').textContent).not.toContain('undefined');
  });

  it('labels a file-watch trigger with its patterns', async () => {
    automationApi.list.mockResolvedValueOnce([
      automation({
        trigger: {
          type: 'file_watch',
          patterns: ['**/*.ts', '**/*.tsx'],
          events: ['change'],
          workspacePath: '/ws',
        },
      }),
    ]);

    renderList();

    await waitFor(() => expect(screen.getByText('File: **/*.ts, **/*.tsx')).toBeTruthy());
  });

  it('labels a git-hook trigger with its hook', async () => {
    automationApi.list.mockResolvedValueOnce([
      automation({ trigger: { type: 'git_hook', hook: 'pre-push', repoPath: '/r' } }),
    ]);

    renderList();

    await waitFor(() => expect(screen.getByText('Git: pre-push')).toBeTruthy());
  });

  it('pluralises the action count correctly at one and at two', async () => {
    automationApi.list.mockResolvedValueOnce([
      automation({ id: 'a', name: 'One', actions: [{ type: 'run_script', script: 'x' }] }),
      automation({
        id: 'b',
        name: 'Two',
        actions: [
          { type: 'run_script', script: 'x' },
          { type: 'notification', title: 't', message: 'm', level: 'info' },
        ],
      }),
    ]);

    renderList();

    await waitFor(() => expect(screen.getByText('1 action')).toBeTruthy());
    expect(screen.getByText('2 actions')).toBeTruthy();
  });

  it('shows Disabled for a disabled automation and Never run for one without history', async () => {
    automationApi.list.mockResolvedValueOnce([
      automation({ id: 'a', name: 'Off', enabled: false }),
      automation({ id: 'b', name: 'Fresh', enabled: true }),
    ]);

    renderList();

    await waitFor(() => expect(screen.getByText('Disabled')).toBeTruthy());
    expect(screen.getByText('Never run')).toBeTruthy();
  });
});

// ===========================================================================
// Live events
// ===========================================================================

describe('the list reacts to automation events', () => {
  it('marks an automation Running when its started event arrives', async () => {
    const target = automation();
    automationApi.list.mockResolvedValueOnce([target]);

    renderList();
    await waitFor(() => expect(screen.getByText('Never run')).toBeTruthy());

    subscriptions.started.forEach((cb) => cb({ automation: target, log: log({ status: 'running' }) }));

    await waitFor(() => expect(screen.getByText('Running')).toBeTruthy());
    // The Run button must be disabled while a run is in flight, or a second
    // click launches a concurrent execution.
    expect((screen.getByTestId('run-automation') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Error after a failed event, with the run button usable again', async () => {
    const target = automation();
    automationApi.list.mockResolvedValueOnce([target]);

    renderList();
    await waitFor(() => expect(screen.getByText('Never run')).toBeTruthy());

    subscriptions.started.forEach((cb) => cb({ automation: target, log: log({ status: 'running' }) }));
    await waitFor(() => expect(screen.getByText('Running')).toBeTruthy());

    subscriptions.failed.forEach((cb) =>
      cb({ automation: target, log: log({ status: 'error', error: 'exit 1' }) })
    );

    await waitFor(() => expect(screen.getByText('Error')).toBeTruthy());
    expect((screen.getByTestId('run-automation') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows Success after a completed event', async () => {
    const target = automation();
    automationApi.list.mockResolvedValueOnce([target]);

    renderList();
    await waitFor(() => expect(screen.getByText('Never run')).toBeTruthy());

    subscriptions.completed.forEach((cb) =>
      cb({ automation: target, log: log({ status: 'success' }) })
    );

    await waitFor(() => expect(screen.getByText('Success')).toBeTruthy());
  });
});

// ===========================================================================
// Mutating actions
// ===========================================================================

describe('the list mutates through the API, not locally', () => {
  it('toggles with the inverted value and adopts the returned record', async () => {
    automationApi.list.mockResolvedValueOnce([automation({ enabled: true })]);
    automationApi.toggle.mockResolvedValueOnce(automation({ enabled: false }));

    renderList();
    await waitFor(() => expect(screen.getByTestId('enable-automation')).toBeTruthy());

    await userEvent.click(screen.getByTestId('enable-automation'));

    // Sending the *current* value instead of its inverse is the classic
    // off-by-negation here: the toggle would appear inert.
    await waitFor(() => expect(automationApi.toggle).toHaveBeenCalledWith('auto-1', false));
    await waitFor(() => expect(screen.getByText('Disabled')).toBeTruthy());
  });

  it('asks before deleting and leaves the row alone when refused', async () => {
    automationApi.list.mockResolvedValueOnce([automation()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderList();
    await waitFor(() => expect(screen.getByTestId('delete-automation')).toBeTruthy());

    await userEvent.click(screen.getByTestId('delete-automation'));

    expect(automationApi.delete).not.toHaveBeenCalled();
    expect(screen.getByTestId('automation-item')).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it('removes the row after a confirmed delete', async () => {
    automationApi.list.mockResolvedValueOnce([automation()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderList();
    await waitFor(() => expect(screen.getByTestId('delete-automation')).toBeTruthy());

    await userEvent.click(screen.getByTestId('delete-automation'));

    await waitFor(() => expect(automationApi.delete).toHaveBeenCalledWith('auto-1'));
    await waitFor(() => expect(screen.queryByTestId('automation-item')).toBeNull());
    confirmSpy.mockRestore();
  });

  it('keeps the row when the delete call fails', async () => {
    automationApi.list.mockResolvedValueOnce([automation()]);
    automationApi.delete.mockRejectedValueOnce(new Error('foreign key constraint'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderList();
    await waitFor(() => expect(screen.getByTestId('delete-automation')).toBeTruthy());

    await userEvent.click(screen.getByTestId('delete-automation'));

    // Optimistic removal on a failed delete would tell the user the automation
    // is gone while it still runs on schedule.
    await waitFor(() => expect(automationApi.delete).toHaveBeenCalled());
    expect(screen.getByTestId('automation-item')).toBeTruthy();
    confirmSpy.mockRestore();
  });
});

// ===========================================================================
// Logs viewer — the second bug found here
// ===========================================================================

describe('the logs viewer says why it is empty', () => {
  /**
   * Regression: a failed `automation:get-logs` rendering "No logs yet".
   *
   * Found while writing this suite. Worse than the list's version, because the
   * header also asserted "0 execution(s)" — a specific and false claim about the
   * automation's history.
   */
  it('reports a load failure rather than claiming there are no logs', async () => {
    automationApi.getLogs.mockRejectedValueOnce(new Error('logs table missing'));

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByTestId('logs-viewer-error')).toBeTruthy());
    expect(screen.getByText('logs table missing')).toBeTruthy();
    expect(screen.queryByText('No logs yet')).toBeNull();
  });

  it('does not claim a count of executions it could not read', async () => {
    automationApi.getLogs.mockRejectedValueOnce(new Error('logs table missing'));

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByTestId('logs-viewer-error')).toBeTruthy());
    expect(screen.queryByText(/0 execution\(s\)/)).toBeNull();
    expect(screen.getByText(/executions unknown/)).toBeTruthy();
  });

  it('claims no logs only when the read succeeded', async () => {
    automationApi.getLogs.mockResolvedValueOnce([]);

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByText('No logs yet')).toBeTruthy());
    expect(screen.getByText(/0 execution\(s\)/)).toBeTruthy();
  });
});

describe('the logs viewer renders execution detail', () => {
  it('shows a duration in seconds for a completed run', async () => {
    automationApi.getLogs.mockResolvedValueOnce([
      log({ startedAt: 1_000_000, completedAt: 1_003_000 }),
    ]);

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByText('Duration: 3s')).toBeTruthy());
  });

  /**
   * Regression: a running log has no `completedAt`. Subtracting `undefined`
   * yields NaN, so the row would read "Duration: NaNs".
   */
  it('shows Running rather than a NaN duration for an in-flight run', async () => {
    automationApi.getLogs.mockResolvedValueOnce([
      log({ status: 'running', completedAt: undefined }),
    ]);

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByText('Duration: Running...')).toBeTruthy());
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('surfaces the failure reason on an errored run', async () => {
    automationApi.getLogs.mockResolvedValueOnce([
      log({ status: 'error', error: 'script exited with code 2' }),
    ]);

    render(<LogsViewer automation={automation()} />);

    await waitFor(() => expect(screen.getByText(/script exited with code 2/)).toBeTruthy());
  });

  it('reveals per-action results only once a row is expanded', async () => {
    automationApi.getLogs.mockResolvedValueOnce([
      log({
        actionResults: [
          {
            action: { type: 'run_script', script: 'echo hi' },
            status: 'success',
            output: 'hi',
            duration: 12,
          },
        ],
      }),
    ]);

    render(<LogsViewer automation={automation()} />);
    await waitFor(() => expect(screen.getByText('Duration: 3s')).toBeTruthy());

    expect(screen.queryByText('Action 1: run_script')).toBeNull();

    await userEvent.click(screen.getByText('Duration: 3s'));

    expect(screen.getByText('Action Results (1)')).toBeTruthy();
    expect(screen.getByText('Action 1: run_script')).toBeTruthy();
    expect(screen.getByText('12ms')).toBeTruthy();
  });

  it('reloads when a different automation is shown', async () => {
    automationApi.getLogs.mockResolvedValue([]);

    const { rerender } = render(<LogsViewer automation={automation({ id: 'auto-1' })} />);
    await waitFor(() => expect(automationApi.getLogs).toHaveBeenCalledWith('auto-1', 50));

    rerender(<LogsViewer automation={automation({ id: 'auto-2' })} />);

    // Keyed on `automation.id`: without it, switching automations would show the
    // previous one's history.
    await waitFor(() => expect(automationApi.getLogs).toHaveBeenCalledWith('auto-2', 50));
  });
});

// ===========================================================================
// Editor: validation before the payload leaves
// ===========================================================================

describe('the automation editor validates before saving', () => {
  const editorProps = () => ({
    workspaceId: 'ws-1',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  });

  it('refuses to save without a name', async () => {
    const props = editorProps();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<AutomationEditor {...props} />);
    await userEvent.click(screen.getByTestId('save-automation'));

    expect(alertSpy).toHaveBeenCalledWith('Name is required');
    expect(props.onSave).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('refuses to save a whitespace-only name', async () => {
    const props = editorProps();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<AutomationEditor {...props} />);
    await userEvent.type(screen.getByTestId('automation-name'), '   ');
    await userEvent.click(screen.getByTestId('save-automation'));

    // `name.trim()` is the guard; a bare truthiness check would let "   "
    // through and create an unnameable automation.
    expect(alertSpy).toHaveBeenCalledWith('Name is required');
    expect(props.onSave).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('refuses to save with no actions', async () => {
    const props = editorProps();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<AutomationEditor {...props} />);
    await userEvent.type(screen.getByTestId('automation-name'), 'My automation');
    await userEvent.click(screen.getByTestId('save-automation'));

    // An automation with no actions is a scheduled no-op that still consumes a
    // watcher or cron slot.
    expect(alertSpy).toHaveBeenCalledWith('At least one action is required');
    expect(props.onSave).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('saves a trimmed name with the workspace id and the default action', async () => {
    const props = editorProps();

    render(<AutomationEditor {...props} />);
    await userEvent.type(screen.getByTestId('automation-name'), '  Lint on save  ');
    await userEvent.click(screen.getByTestId('add-action'));
    await userEvent.click(screen.getByTestId('save-automation'));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave.mock.calls[0][0]).toEqual({
      workspaceId: 'ws-1',
      name: 'Lint on save',
      enabled: true,
      trigger: { type: 'manual' },
      actions: [{ type: 'run_script', script: '#!/bin/bash\necho "Hello World"' }],
    });
  });

  it('pre-fills from an existing automation instead of starting blank', async () => {
    const props = editorProps();
    const existing = automation({
      name: 'Existing',
      enabled: false,
      trigger: { type: 'schedule', cron: '0 9 * * *' },
    });

    render(<AutomationEditor {...props} automation={existing} />);

    expect(screen.getByText('Edit Automation')).toBeTruthy();
    expect((screen.getByTestId('automation-name') as HTMLInputElement).value).toBe('Existing');
    expect((screen.getByTestId('trigger-type') as HTMLSelectElement).value).toBe('schedule');
    expect((screen.getByTestId('trigger-cron') as HTMLInputElement).value).toBe('0 9 * * *');
  });

  /**
   * Regression: removing an action while a later one is selected.
   *
   * `selectedActionIndex` is a positional index into the array. Removing an
   * earlier element shifts everything down, so an unadjusted index points at the
   * wrong action — the editor would show the wrong form and edits would land on
   * a different action than the one clicked.
   */
  it('keeps the selection on the same action after an earlier one is removed', async () => {
    const props = editorProps();
    const existing = automation({
      actions: [
        { type: 'run_script', script: 'first' },
        { type: 'notification', title: 'second', message: 'm', level: 'info' },
      ],
    });

    render(<AutomationEditor {...props} automation={existing} />);

    // Select the second action; its form (Notification) opens.
    await userEvent.click(screen.getByText('Action 2: Notification'));
    expect(screen.getByDisplayValue('second')).toBeTruthy();

    // Remove the first action. The notification is now index 0.
    const firstHeader = screen.getByText('Action 1: Run Script').closest('div');
    const removeButton = within(firstHeader?.parentElement as HTMLElement).getAllByRole(
      'button'
    )[0];
    await userEvent.click(removeButton);

    // Still the notification, now labelled Action 1, and still expanded.
    expect(screen.getByText('Action 1: Notification')).toBeTruthy();
    expect(screen.getByDisplayValue('second')).toBeTruthy();
  });
});

// ===========================================================================
// Trigger + action config: switching type must produce a complete shape
// ===========================================================================

describe('switching trigger type yields a complete trigger', () => {
  /**
   * Regression: a partially-formed trigger crossing IPC.
   *
   * Each branch of `handleTypeChange` must emit every field the corresponding
   * shared type declares. A `file_watch` without `patterns` reaches the main
   * process and the watcher silently matches nothing.
   */
  it('emits patterns, events and workspacePath for file_watch', async () => {
    const onChange = vi.fn();

    render(<TriggerConfig trigger={{ type: 'manual' }} onChange={onChange} workspaceId="ws-1" />);
    await userEvent.selectOptions(screen.getByTestId('trigger-type'), 'file_watch');

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0];
    expect(emitted.type).toBe('file_watch');
    expect(Array.isArray(emitted.patterns)).toBe(true);
    expect(emitted.patterns.length).toBeGreaterThan(0);
    expect(Array.isArray(emitted.events)).toBe(true);
    expect(emitted.events.length).toBeGreaterThan(0);
    expect(typeof emitted.workspacePath).toBe('string');
  });

  it('emits hook and repoPath for git_hook', async () => {
    const onChange = vi.fn();

    render(<TriggerConfig trigger={{ type: 'manual' }} onChange={onChange} workspaceId="ws-1" />);
    await userEvent.selectOptions(screen.getByTestId('trigger-type'), 'git_hook');

    expect(onChange.mock.calls[0][0]).toEqual({
      type: 'git_hook',
      hook: 'pre-commit',
      repoPath: '/path/to/repo',
    });
  });

  it('emits a cron expression for schedule', async () => {
    const onChange = vi.fn();

    render(<TriggerConfig trigger={{ type: 'manual' }} onChange={onChange} workspaceId="ws-1" />);
    await userEvent.selectOptions(screen.getByTestId('trigger-type'), 'schedule');

    const emitted = onChange.mock.calls[0][0];
    expect(emitted.type).toBe('schedule');
    // node-cron rejects an empty expression; the default must be valid.
    expect(emitted.cron.trim().split(/\s+/)).toHaveLength(5);
  });

  it('drops file-watch fields when switching back to manual', async () => {
    const onChange = vi.fn();

    render(
      <TriggerConfig
        trigger={{
          type: 'file_watch',
          patterns: ['**/*.ts'],
          events: ['change'],
          workspacePath: '/ws',
        }}
        onChange={onChange}
        workspaceId="ws-1"
      />
    );
    await userEvent.selectOptions(screen.getByTestId('trigger-type'), 'manual');

    // A leftover `patterns` on a manual trigger would register a file watcher
    // for an automation the user asked to run only by hand.
    expect(onChange.mock.calls[0][0]).toEqual({ type: 'manual' });
  });

  it('parses the pattern textarea into a list, dropping blank lines', () => {
    const onChange = vi.fn();

    render(
      <TriggerConfig
        trigger={{ type: 'file_watch', patterns: [], events: ['change'], workspacePath: '/ws' }}
        onChange={onChange}
        workspaceId="ws-1"
      />
    );

    // `fireEvent.change` with the whole value, not `userEvent.type`: the
    // textarea is controlled by the `trigger` prop, and `onChange` here is a
    // mock that never feeds a new prop back. Typing would therefore deliver one
    // character per event and the multi-line parse would never be exercised —
    // the assertion would pass without testing anything.
    fireEvent.change(screen.getByTestId('trigger-patterns'), {
      target: { value: 'src/**/*.ts\n\n   \nlib/**/*.tsx\n' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    // Blank and whitespace-only lines must not become watch patterns: an empty
    // glob matches everything, so one stray newline turns a scoped watcher into
    // a whole-tree one.
    expect(onChange.mock.calls[0][0].patterns).toEqual(['src/**/*.ts', 'lib/**/*.tsx']);
  });

  it('toggles a file-watch event on and off', () => {
    const onChange = vi.fn();

    render(
      <TriggerConfig
        trigger={{
          type: 'file_watch',
          patterns: ['**/*.ts'],
          events: ['change'],
          workspacePath: '/ws',
        }}
        onChange={onChange}
        workspaceId="ws-1"
      />
    );

    // The visible labels are lowercase in the DOM ("add"/"change"/"unlink") and
    // only capitalised by CSS, so they are located by their own text rather than
    // by the rendered appearance.
    const checkboxFor = (event: string): HTMLElement => {
      const label = screen.getByText(event).closest('label');
      const box = label?.querySelector('input[type="checkbox"]');
      if (!box) throw new Error(`no checkbox for ${event}`);
      return box as HTMLElement;
    };

    expect((checkboxFor('change') as HTMLInputElement).checked).toBe(true);
    expect((checkboxFor('add') as HTMLInputElement).checked).toBe(false);

    // Unchecking the only selected event must remove it, not leave the array
    // untouched — a file trigger with an empty `events` list never fires.
    fireEvent.click(checkboxFor('change'));
    expect(onChange.mock.calls[0][0].events).toEqual([]);

    onChange.mockClear();
    fireEvent.click(checkboxFor('add'));
    expect(onChange.mock.calls[0][0].events).toEqual(['change', 'add']);
  });
});

describe('switching action type yields a complete action', () => {
  const actionProps = (action: Parameters<typeof ActionConfig>[0]['action']) => ({
    action,
    index: 0,
    selected: true,
    onSelect: noop,
    onChange: vi.fn(),
    onRemove: noop,
  });

  it('emits prompt, model and provider for ai_task', async () => {
    const props = actionProps({ type: 'run_script', script: 'x' });

    render(<ActionConfig {...props} />);
    await userEvent.selectOptions(screen.getByTestId('action-type'), 'ai_task');

    const emitted = props.onChange.mock.calls[0][0];
    expect(emitted.type).toBe('ai_task');
    // An ai_task without a provider cannot be routed to any client.
    expect(emitted.provider).toBeTruthy();
    expect(emitted.model).toBeTruthy();
    expect(emitted.prompt).toBeTruthy();
  });

  it('emits operation, repoPath and params for git_operation', async () => {
    const props = actionProps({ type: 'run_script', script: 'x' });

    render(<ActionConfig {...props} />);
    await userEvent.selectOptions(screen.getByTestId('action-type'), 'git_operation');

    const emitted = props.onChange.mock.calls[0][0];
    expect(emitted.type).toBe('git_operation');
    expect(emitted.operation).toBe('commit');
    expect(emitted.repoPath).toBeTruthy();
    // A commit with no message fails at the git layer, after the automation has
    // already reported itself as started.
    expect(emitted.params.message).toBeTruthy();
  });

  it('emits title, message and level for notification', async () => {
    const props = actionProps({ type: 'run_script', script: 'x' });

    render(<ActionConfig {...props} />);
    await userEvent.selectOptions(screen.getByTestId('action-type'), 'notification');

    expect(props.onChange.mock.calls[0][0]).toEqual({
      type: 'notification',
      title: 'Automation completed',
      message: 'The automation has finished running',
      level: 'info',
    });
  });

  it('shows the commit-message field only for the commit operation', async () => {
    const props = actionProps({
      type: 'git_operation',
      operation: 'commit',
      repoPath: '/r',
      params: { message: 'msg' },
    });

    const { rerender } = render(<ActionConfig {...props} />);
    expect(screen.getByText('Commit Message')).toBeTruthy();

    rerender(
      <ActionConfig
        {...props}
        action={{ type: 'git_operation', operation: 'push', repoPath: '/r' }}
      />
    );

    expect(screen.queryByText('Commit Message')).toBeNull();
  });

  it('keeps the collapsed body hidden until the header is selected', () => {
    const props = actionProps({ type: 'run_script', script: 'echo hi' });

    render(<ActionConfig {...props} selected={false} />);

    expect(screen.queryByTestId('action-type')).toBeNull();
    expect(screen.getByText('Action 1: Run Script')).toBeTruthy();
  });

  it('does not select the action when the remove button is pressed', async () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const props = {
      ...actionProps({ type: 'run_script', script: 'x' }),
      selected: false,
      onSelect,
      onRemove,
    };

    render(<ActionConfig {...props} />);
    await userEvent.click(screen.getByRole('button'));

    // `e.stopPropagation()` in the remove handler: without it the click also
    // hits the header's onSelect and the panel expands as it is deleted.
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
