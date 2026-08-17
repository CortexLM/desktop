/**
 * WorkspaceSwitcher - UI pour switcher entre workspaces
 */

import { useState, useEffect } from 'react';
import { Folder, FolderOpen, Plus, X, ChevronDown } from 'lucide-react';
import type { Workspace } from '@cortex-ide/shared';

export interface WorkspaceSwitcherProps {
  className?: string;
}

export function WorkspaceSwitcher({ className = '' }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isOpen, setIsOpen] = useState(false);


  useEffect(() => {
    loadWorkspaces();

    // Écoute les changements de workspace
    const unsubscribe = window.ipc.on('event:workspace-switched', () => {
      loadWorkspaces();
    });

    return () => unsubscribe();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await window.ipc.invoke('workspace:list');
      if (response.success) {
        const { workspaces: loaded, activeId } = response.data;
        setWorkspaces(loaded);
        // The handler returns the active *id*; the UI renders `.name`/`.id`, so
        // resolve it to the entity instead of storing the bare string.
        setActiveWorkspace(loaded.find((workspace) => workspace.id === activeId) ?? null);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const handleSwitch = async (workspaceId: string) => {
    try {
      const response = await window.ipc.invoke('workspace:switch', { workspaceId });
      if (response.success) {
        setIsOpen(false);
        loadWorkspaces();
      }
    } catch (error) {
      console.error('Failed to switch workspace:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const response = await window.ipc.invoke('workspace:open-dialog');
      if (response.success && response.data.path) {
        const addResponse = await window.ipc.invoke('workspace:add', {
          path: response.data.path,
        });
        
        if (addResponse.success) {
          loadWorkspaces();
        }
      }
    } catch (error) {
      console.error('Failed to add workspace:', error);
    }
  };

  const handleRemove = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Remove this workspace? (Files will not be deleted)')) {
      return;
    }

    try {
      const response = await window.ipc.invoke('workspace:remove', { workspaceId });
      if (response.success) {
        loadWorkspaces();
      }
    } catch (error) {
      console.error('Failed to remove workspace:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Current workspace button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-md transition-colors w-full text-left"
      >
        <FolderOpen className="w-4 h-4 text-blue-400" />
        <span className="flex-1 text-sm font-medium truncate">
          {activeWorkspace?.name || 'No workspace'}
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-20 overflow-hidden">
            {/* Workspace list */}
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => handleSwitch(workspace.id)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    workspace.id === activeWorkspace?.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-neutral-800'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{workspace.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{workspace.path}</div>
                  </div>
                  {workspace.id !== activeWorkspace?.id && (
                    <button
                      onClick={(e) => handleRemove(workspace.id, e)}
                      className="p-1 hover:bg-neutral-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove workspace"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {workspaces.length === 0 && (
                <div className="px-3 py-8 text-center text-neutral-500 text-sm">
                  No workspaces yet
                </div>
              )}
            </div>

            {/* Add workspace button */}
            <button
              onClick={handleAdd}
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-neutral-800 hover:bg-neutral-800 transition-colors text-sm text-blue-400"
            >
              <Plus className="w-4 h-4" />
              Add Workspace
            </button>
          </div>
        </>
      )}
    </div>
  );
}
