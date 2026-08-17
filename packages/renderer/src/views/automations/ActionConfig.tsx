/**
 * Action Configuration Component
 * Configuration des actions d'automation
 */

import React from 'react';
// Side-effect import: binds Monaco to the bundled copy instead of the CDN.
import '../../lib/monaco-setup';
import Editor from '@monaco-editor/react';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { ModelSelector } from '../../components/ai/ModelSelector';
import type {
  Action,
  ScriptAction,
  AITaskAction,
  GitOperationAction,
  NotificationAction,
} from '@cortex-ide/shared';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface ActionConfigProps {
  action: Action;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (action: Action) => void;
  onRemove: () => void;
}

export const ActionConfig: React.FC<ActionConfigProps> = ({
  action,
  index,
  selected,
  onSelect,
  onChange,
  onRemove,
}) => {
  const getActionLabel = (action: Action): string => {
    switch (action.type) {
      case 'run_script':
        return 'Run Script';
      case 'ai_task':
        return 'AI Task';
      case 'git_operation':
        return 'Git Operation';
      case 'notification':
        return 'Notification';
    }
  };

  const handleTypeChange = (type: Action['type']) => {
    switch (type) {
      case 'run_script':
        onChange({
          type: 'run_script',
          script: '#!/bin/bash\necho "Hello World"',
        });
        break;
      case 'ai_task':
        onChange({
          type: 'ai_task',
          prompt: 'Analyze the changes',
          model: 'gpt-4.5-turbo',
          provider: 'openai',
        });
        break;
      case 'git_operation':
        onChange({
          type: 'git_operation',
          operation: 'commit',
          repoPath: '/path/to/repo',
          params: { message: 'Automated commit' },
        });
        break;
      case 'notification':
        onChange({
          type: 'notification',
          title: 'Automation completed',
          message: 'The automation has finished running',
          level: 'info',
        });
        break;
    }
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-accent/50 cursor-pointer hover:bg-accent"
        onClick={onSelect}
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span className="font-medium">
            Action {index + 1}: {getActionLabel(action)}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      {selected && (
        <div className="p-4 space-y-4">
          {/* Type Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Action Type</label>
            <select
              value={action.type}
              onChange={(e) => handleTypeChange(e.target.value as Action['type'])}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              data-testid="action-type"
            >
              <option value="run_script">Run Script</option>
              <option value="ai_task">AI Task</option>
              <option value="git_operation">Git Operation</option>
              <option value="notification">Notification</option>
            </select>
          </div>

          {/* Script Action */}
          {action.type === 'run_script' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Script</label>
                <div className="border border-border rounded-md overflow-hidden">
                  <Editor
                    height="200px"
                    language="shell"
                    value={(action as ScriptAction).script}
                    onChange={(value) =>
                      onChange({
                        ...action,
                        script: value || '',
                      } as ScriptAction)
                    }
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Shell (optional)
                  </label>
                  <Input
                    value={(action as ScriptAction).shell || ''}
                    onChange={(e) =>
                      onChange({
                        ...action,
                        shell: e.target.value || undefined,
                      } as ScriptAction)
                    }
                    placeholder="/bin/bash"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Working Directory (optional)
                  </label>
                  <Input
                    value={(action as ScriptAction).cwd || ''}
                    onChange={(e) =>
                      onChange({
                        ...action,
                        cwd: e.target.value || undefined,
                      } as ScriptAction)
                    }
                    placeholder="/path/to/dir"
                  />
                </div>
              </div>
            </>
          )}

          {/* AI Task Action */}
          {action.type === 'ai_task' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Prompt</label>
                <Textarea
                  value={(action as AITaskAction).prompt}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      prompt: e.target.value,
                    } as AITaskAction)
                  }
                  placeholder="Describe the AI task..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Provider</label>
                  <select
                    value={(action as AITaskAction).provider}
                    onChange={(e) =>
                      onChange({
                        ...action,
                        provider: e.target.value as AITaskAction['provider'],
                      } as AITaskAction)
                    }
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="ollama">Ollama</option>
                    <option value="grok">Grok</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <ModelSelector
                    provider={(action as AITaskAction).provider}
                    value={(action as AITaskAction).model}
                    onChange={(model) =>
                      onChange({
                        ...action,
                        model,
                      } as AITaskAction)
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Git Operation Action */}
          {action.type === 'git_operation' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Operation</label>
                <select
                  value={(action as GitOperationAction).operation}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      operation: e.target.value as GitOperationAction['operation'],
                    } as GitOperationAction)
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="commit">Commit</option>
                  <option value="push">Push</option>
                  <option value="pull">Pull</option>
                  <option value="branch">Create Branch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Repository Path
                </label>
                <Input
                  value={(action as GitOperationAction).repoPath}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      repoPath: e.target.value,
                    } as GitOperationAction)
                  }
                  placeholder="/path/to/repo"
                />
              </div>

              {/* Operation-specific params */}
              {(action as GitOperationAction).operation === 'commit' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Commit Message
                  </label>
                  <Input
                    value={
                      ((action as GitOperationAction).params?.message as string) || ''
                    }
                    onChange={(e) =>
                      onChange({
                        ...action,
                        params: {
                          ...(action as GitOperationAction).params,
                          message: e.target.value,
                        },
                      } as GitOperationAction)
                    }
                    placeholder="Automated commit"
                  />
                </div>
              )}

              {(action as GitOperationAction).operation === 'branch' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Branch Name
                  </label>
                  <Input
                    value={
                      ((action as GitOperationAction).params?.branchName as string) ||
                      ''
                    }
                    onChange={(e) =>
                      onChange({
                        ...action,
                        params: {
                          ...(action as GitOperationAction).params,
                          branchName: e.target.value,
                        },
                      } as GitOperationAction)
                    }
                    placeholder="feature/new-branch"
                  />
                </div>
              )}
            </>
          )}

          {/* Notification Action */}
          {action.type === 'notification' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  value={(action as NotificationAction).title}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      title: e.target.value,
                    } as NotificationAction)
                  }
                  placeholder="Notification title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <Textarea
                  value={(action as NotificationAction).message}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      message: e.target.value,
                    } as NotificationAction)
                  }
                  placeholder="Notification message"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Level</label>
                <select
                  value={(action as NotificationAction).level}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      level: e.target.value as NotificationAction['level'],
                    } as NotificationAction)
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
