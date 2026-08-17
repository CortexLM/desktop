/**
 * Trigger Configuration Component
 * Configuration des triggers d'automation
 */

import React from 'react';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import type { Trigger, FileTrigger, GitTrigger, ScheduleTrigger } from '@cortex-ide/shared';

interface TriggerConfigProps {
  trigger: Trigger;
  onChange: (trigger: Trigger) => void;
  workspaceId: string;
}

export const TriggerConfig: React.FC<TriggerConfigProps> = ({
  trigger,
  onChange,
  // Part of the props contract; the trigger forms don't need it yet.
  workspaceId: _workspaceId,
}) => {
  const handleTypeChange = (type: Trigger['type']) => {
    switch (type) {
      case 'file_watch':
        onChange({
          type: 'file_watch',
          patterns: ['**/*.ts'],
          events: ['change'],
          workspacePath: '/path/to/workspace',
        });
        break;
      case 'git_hook':
        onChange({
          type: 'git_hook',
          hook: 'pre-commit',
          repoPath: '/path/to/repo',
        });
        break;
      case 'schedule':
        onChange({
          type: 'schedule',
          cron: '0 0 * * *',
        });
        break;
      case 'manual':
        onChange({
          type: 'manual',
        });
        break;
    }
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-md">
      {/* Type Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Trigger Type</label>
        <select
          value={trigger.type}
          onChange={(e) => handleTypeChange(e.target.value as Trigger['type'])}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          data-testid="trigger-type"
        >
          <option value="manual">Manual</option>
          <option value="file_watch">File Watch</option>
          <option value="git_hook">Git Hook</option>
          <option value="schedule">Schedule (Cron)</option>
        </select>
      </div>

      {/* File Watch Config */}
      {trigger.type === 'file_watch' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">
              Patterns (one per line)
            </label>
            <Textarea
              data-testid="trigger-patterns"
              value={(trigger as FileTrigger).patterns.join('\n')}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  patterns: e.target.value.split('\n').filter((p) => p.trim()),
                } as FileTrigger)
              }
              placeholder="**/*.ts&#10;**/*.tsx&#10;src/**/*.js"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Glob patterns to watch
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Events</label>
            <div className="space-y-2">
              {(['add', 'change', 'unlink'] as const).map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(trigger as FileTrigger).events.includes(event)}
                    onChange={(e) => {
                      const events = (trigger as FileTrigger).events;
                      onChange({
                        ...trigger,
                        events: e.target.checked
                          ? [...events, event]
                          : events.filter((ev) => ev !== event),
                      } as FileTrigger);
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm capitalize">{event}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Workspace Path
            </label>
            <Input
              value={(trigger as FileTrigger).workspacePath}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  workspacePath: e.target.value,
                } as FileTrigger)
              }
              placeholder="/path/to/workspace"
            />
          </div>
        </>
      )}

      {/* Git Hook Config */}
      {trigger.type === 'git_hook' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Hook Type</label>
            <select
              value={(trigger as GitTrigger).hook}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  hook: e.target.value as GitTrigger['hook'],
                } as GitTrigger)
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="pre-commit">Pre-commit</option>
              <option value="post-commit">Post-commit</option>
              <option value="pre-push">Pre-push</option>
              <option value="post-merge">Post-merge</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Repository Path
            </label>
            <Input
              value={(trigger as GitTrigger).repoPath}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  repoPath: e.target.value,
                } as GitTrigger)
              }
              placeholder="/path/to/repo"
            />
          </div>
        </>
      )}

      {/* Schedule Config */}
      {trigger.type === 'schedule' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">
              Cron Expression
            </label>
            <Input
              value={(trigger as ScheduleTrigger).cron}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  cron: e.target.value,
                } as ScheduleTrigger)
              }
              placeholder="0 0 * * *"
              data-testid="trigger-cron"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Examples: "0 0 * * *" (daily at midnight), "*/15 * * * *" (every
              15 min)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Timezone (optional)
            </label>
            <Input
              value={(trigger as ScheduleTrigger).timezone || ''}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  timezone: e.target.value || undefined,
                } as ScheduleTrigger)
              }
              placeholder="America/New_York"
            />
          </div>
        </>
      )}

      {/* Manual Config */}
      {trigger.type === 'manual' && (
        <p className="text-sm text-muted-foreground">
          This automation will only run when triggered manually.
        </p>
      )}
    </div>
  );
};
