/**
 * Automation Editor View
 * Éditeur d'automation avec Monaco pour scripts
 */

import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { TriggerConfig } from './TriggerConfig';
import { ActionConfig } from './ActionConfig';
import type { Automation, Trigger, Action } from '@cortex-ide/shared';
import { Save, X, Plus } from 'lucide-react';

interface AutomationEditorProps {
  automation?: Automation;
  workspaceId: string;
  onSave: (data: Partial<Automation>) => void;
  onCancel: () => void;
}

export const AutomationEditor: React.FC<AutomationEditorProps> = ({
  automation,
  workspaceId,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(automation?.name || '');
  const [enabled, setEnabled] = useState(automation?.enabled ?? true);
  const [trigger, setTrigger] = useState<Trigger>(
    automation?.trigger || {
      type: 'manual',
    }
  );
  const [actions, setActions] = useState<Action[]>(
    automation?.actions || []
  );
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    if (actions.length === 0) {
      alert('At least one action is required');
      return;
    }

    onSave({
      workspaceId,
      name: name.trim(),
      enabled,
      trigger,
      actions,
    });
  };

  const addAction = () => {
    const newAction: Action = {
      type: 'run_script',
      script: '#!/bin/bash\necho "Hello World"',
    };
    setActions([...actions, newAction]);
    setSelectedActionIndex(actions.length);
  };

  const updateAction = (index: number, action: Action) => {
    const updated = [...actions];
    updated[index] = action;
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
    if (selectedActionIndex === index) {
      setSelectedActionIndex(null);
    } else if (selectedActionIndex !== null && selectedActionIndex > index) {
      setSelectedActionIndex(selectedActionIndex - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">
          {automation ? 'Edit Automation' : 'New Automation'}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} data-testid="save-automation">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Automation"
              data-testid="automation-name"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="enabled" className="text-sm">
              Enabled
            </label>
          </div>
        </div>

        {/* Trigger Configuration */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Trigger</h3>
          <TriggerConfig
            trigger={trigger}
            onChange={setTrigger}
            workspaceId={workspaceId}
          />
        </div>

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Actions</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={addAction}
              data-testid="add-action"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Action
            </Button>
          </div>

          {actions.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-border rounded-md">
              <p className="text-sm text-muted-foreground mb-3">
                No actions configured
              </p>
              <Button size="sm" onClick={addAction}>
                Add your first action
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action, index) => (
                <ActionConfig
                  key={index}
                  action={action}
                  index={index}
                  selected={selectedActionIndex === index}
                  onSelect={() => setSelectedActionIndex(index)}
                  onChange={(updated) => updateAction(index, updated)}
                  onRemove={() => removeAction(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
