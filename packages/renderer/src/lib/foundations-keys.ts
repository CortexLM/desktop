import { SESSION_SURFACES, type SessionSurface } from '../components/cortex/session-surfaces';

export const FOUNDATIONS_SHORTCUTS = [
  ['⌘K', 'Command palette'],
  ['⌘P', 'Quick open'],
  ['⌘J', 'Terminal'],
  ['⌘B', 'Toggle sidebar'],
  ['⌘1–9', 'Surfaces'],
  ['⌘M', 'Propose model switch'],
  ['⌘D', 'Changes'],
  ['⌘⇧R', 'Rewind checkpoint'],
  ['⌘↵', 'Queue follow-up'],
  ['⌘[ / ⌘]', 'Previous / next session'],
  ['⌘/', 'Shortcuts'],
  ['⌘,', 'Settings'],
  ['⌘L', 'Add selection to chat'],
  ['⌘Y / ⌘N', 'Accept / reject hunk'],
  ['⌘⇧Y', 'Accept file'],
  ['F7 / F8', 'Next hunk / next conflict'],
] as const;

export function surfaceForDigit(digit: string): SessionSurface | undefined {
  const index = Number(digit) - 1;
  return SESSION_SURFACES[index];
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function isEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('.monaco-editor') || target.closest('[data-testid="editor-area"]'));
}
