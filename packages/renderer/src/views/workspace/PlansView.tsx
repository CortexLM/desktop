/**
 * PlansView - Todo lists et planning
 * 
 * Features:
 * - Liste tâches avec checkboxes
 * - Create, edit, delete tasks
 * - Drag & drop reordering
 * - Status filters (pending, in_progress, completed)
 * - Persistence dans database
 */

import * as React from 'react';
import { ipc } from '../../lib/ipc';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Checkbox } from '../../components/ui/checkbox';
import { cn } from '../../lib/utils';

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  order: number;
  created_at: number;
  updated_at: number;
  workspace_id: string;
}

interface PlansViewProps {
  workspaceId: string;
  className?: string;
}

export function PlansView({ workspaceId, className }: PlansViewProps) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Task['status'] | 'all'>('all');
  const [newTaskContent, setNewTaskContent] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState('');
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  // Charger les tâches
  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // `ipc.db`, not `ipc.database`, and the request is an object.
      // `"order"` is quoted: it is a SQL reserved word, and unquoted it made
      // SQLite reject the statement (the INSERT/UPDATE below already quote it).
      const result = await ipc.db.query<Task>({
        query:
          'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY "order" ASC, created_at DESC',
        params: [workspaceId],
      });
      // Defaulted because a response without `rows` would otherwise leave
      // `tasks` undefined, and the render path calls `.length` / `.map` on it -
      // crashing the whole view instead of showing an empty list.
      setTasks(result?.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Créer une tâche
  const handleCreateTask = async () => {
    const content = newTaskContent.trim();
    if (!content) return;

    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const maxOrder = Math.max(0, ...tasks.map(t => t.order));

    try {
      // `ipc.db.execute` takes `{ statements }`, not a bare array.
      await ipc.db.execute({
        statements: [
          {
            query: 'INSERT INTO tasks (id, workspace_id, content, status, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            params: [id, workspaceId, content, 'pending', maxOrder + 1, now, now],
          },
        ],
      });

      setNewTaskContent('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  // Mettre à jour une tâche
  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const now = Date.now();

    try {
      const updateFields = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ');
      const updateValues = [...Object.values(updates), now, id];

      await ipc.db.execute({
        statements: [
          {
            query: `UPDATE tasks SET ${updateFields}, updated_at = ? WHERE id = ?`,
            params: updateValues,
          },
        ],
      });

      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  // Supprimer une tâche
  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      await ipc.db.execute({
        statements: [
          {
            query: 'DELETE FROM tasks WHERE id = ?',
            params: [id],
          },
        ],
      });

      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  // Toggle status
  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await handleUpdateTask(task.id, { status: newStatus });
  };

  // Commencer l'édition
  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditingContent(task.content);
  };

  // Sauvegarder l'édition
  const saveEditing = async () => {
    if (!editingId) return;

    const content = editingContent.trim();
    if (!content) {
      await handleDeleteTask(editingId);
    } else {
      await handleUpdateTask(editingId, { content });
    }

    setEditingId(null);
    setEditingContent('');
  };

  // Annuler l'édition
  const cancelEditing = () => {
    setEditingId(null);
    setEditingContent('');
  };

  // Drag & Drop
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedTask = tasks.find(t => t.id === draggedId);
    const targetTask = tasks.find(t => t.id === targetId);

    if (!draggedTask || !targetTask) {
      setDraggedId(null);
      return;
    }

    // Réordonner localement
    const newTasks = [...tasks];
    const draggedIndex = newTasks.findIndex(t => t.id === draggedId);
    const targetIndex = newTasks.findIndex(t => t.id === targetId);

    newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedTask);

    // Mettre à jour les orders
    const updates = newTasks.map((task, index) => ({
      query: 'UPDATE tasks SET "order" = ?, updated_at = ? WHERE id = ?',
      params: [index, Date.now(), task.id],
    }));

    try {
      await ipc.db.execute({ statements: updates });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder tasks');
    }

    setDraggedId(null);
  };

  // Filtrer les tâches
  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text">Plans</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {stats.total} total
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {stats.completed} done
            </Badge>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={loadTasks} disabled={loading}>
          {loading ? <Spinner className="w-3 h-3" /> : '↻'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-wash">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          count={stats.total}
        >
          All
        </FilterButton>
        <FilterButton
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          count={stats.pending}
        >
          Pending
        </FilterButton>
        <FilterButton
          active={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
          count={stats.in_progress}
        >
          In Progress
        </FilterButton>
        <FilterButton
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
          count={stats.completed}
        >
          Completed
        </FilterButton>
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-2 bg-red-soft text-red text-xs border-b border-red/20"
          data-testid="plans-error"
        >
          {error}
        </div>
      )}

      {/* New Task Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Input
          value={newTaskContent}
          onChange={(e) => setNewTaskContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateTask();
          }}
          placeholder="Add a new task..."
          className="flex-1"
          data-testid="new-task-input"
        />
        <Button
          onClick={handleCreateTask}
          size="sm"
          disabled={!newTaskContent.trim()}
          data-testid="add-task"
        >
          Add
        </Button>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-text-secondary">
            {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isEditing={editingId === task.id}
                editingContent={editingContent}
                onEditingContentChange={setEditingContent}
                onToggle={handleToggleStatus}
                onStartEdit={startEditing}
                onSaveEdit={saveEditing}
                onCancelEdit={cancelEditing}
                onDelete={handleDeleteTask}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedId === task.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Filter Button
// ============================================================================

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, count, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded transition-colors',
        active
          ? 'bg-tint text-text'
          : 'text-text-secondary hover:text-text hover:bg-tint/50'
      )}
    >
      {children} <span className="opacity-60">({count})</span>
    </button>
  );
}

// ============================================================================
// Task Item
// ============================================================================

interface TaskItemProps {
  task: Task;
  isEditing: boolean;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  onToggle: (task: Task) => void;
  onStartEdit: (task: Task) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (id: string) => void;
  isDragging: boolean;
}

function TaskItem({
  task,
  isEditing,
  editingContent,
  onEditingContentChange,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: TaskItemProps) {
  const statusColor = {
    pending: 'text-text-secondary',
    in_progress: 'text-accent',
    completed: 'text-green',
    cancelled: 'text-text-tertiary',
  }[task.status];

  const statusLabel = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[task.status];

  return (
    <div
      draggable={!isEditing}
      onDragStart={() => onDragStart(task.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(task.id)}
      data-testid="plan-task"
      data-task-status={task.status}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 hover:bg-tint transition-colors',
        isDragging && 'opacity-50',
        task.status === 'completed' && 'opacity-60'
      )}
    >
      {/* Drag Handle */}
      <div className="pt-0.5 cursor-move text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
          <circle cx="9" cy="3" r="1.5" fill="currentColor" />
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="9" cy="8" r="1.5" fill="currentColor" />
          <circle cx="3" cy="13" r="1.5" fill="currentColor" />
          <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={() => onToggle(task)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editingContent}
            onChange={(e) => onEditingContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onBlur={onSaveEdit}
            autoFocus
            className="h-7 text-sm"
          />
        ) : (
          <button
            onClick={() => onStartEdit(task)}
            className={cn(
              'w-full text-left text-sm text-text hover:text-accent transition-colors',
              task.status === 'completed' && 'line-through'
            )}
          >
            {task.content}
          </button>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs font-medium', statusColor)}>
            {statusLabel}
          </span>
          <span className="text-xs text-text-tertiary">
            {new Date(task.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
          <button
            onClick={() => onStartEdit(task)}
            className="p-1 text-text-secondary hover:text-text hover:bg-tint-strong rounded transition-colors"
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M10.5 1.5l2 2-7 7H3.5v-2l7-7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-text-secondary hover:text-red hover:bg-red-soft rounded transition-colors"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6.5v3M8.5 6.5v3M4.5 4l.5 7a1 1 0 001 1h2a1 1 0 001-1l.5-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
