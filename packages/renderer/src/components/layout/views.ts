/**
 * View registry - the single source of truth for the workbench's views.
 *
 * The activity bar, the keyboard shortcuts and the command palette all need the
 * same list of views with the same labels and shortcuts. Declaring it once here
 * keeps them from drifting apart as views are added.
 */

import * as React from 'react';
import {
  BookOpen,
  Bot,
  Boxes,
  CreditCard,
  FileText,
  Files,
  GitBranch,
  Globe,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  ScanSearch,
  Search,
  Settings,
  Shield,
  SquareTerminal,
  Zap,
} from 'lucide-react';
import type { WorkbenchView } from '../../contexts/WorkbenchContext';

export interface ViewDefinition {
  id: WorkbenchView;
  label: string;
  icon: LucideIcon;
  /** Human-readable accelerator, shown in tooltips and the command palette. */
  shortcut?: string;
  /** Matches the E2E page objects: `[data-testid="sidebar-<id>"]`. */
  testId: string;
  /** Wrapper testid for the rendered panel, asserted by the workspace E2E suite. */
  panelTestId: string;
  /** Where the view appears in the activity bar. */
  group: 'primary' | 'secondary';
}

export const VIEWS: ViewDefinition[] = [
  {
    id: 'session',
    label: 'Session',
    icon: MessageSquare,
    shortcut: 'Cmd+N',
    testId: 'sidebar-session',
    panelTestId: 'session-center',
    group: 'primary',
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: Files,
    shortcut: 'Cmd+Shift+E',
    testId: 'sidebar-explorer',
    panelTestId: 'file-explorer',
    group: 'primary',
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    shortcut: 'Cmd+Shift+F',
    testId: 'sidebar-search',
    panelTestId: 'search-panel',
    group: 'primary',
  },
  {
    id: 'git',
    label: 'Source Control',
    icon: GitBranch,
    shortcut: 'Cmd+Shift+G',
    testId: 'sidebar-git',
    panelTestId: 'git-panel',
    group: 'primary',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: SquareTerminal,
    shortcut: 'Ctrl+`',
    testId: 'sidebar-terminal',
    panelTestId: 'terminal-panel',
    group: 'primary',
  },
  {
    id: 'ai-chat',
    label: 'AI Chat',
    icon: MessageSquare,
    shortcut: 'Cmd+L',
    testId: 'sidebar-ai-chat',
    panelTestId: 'ai-chat-panel',
    group: 'primary',
  },
  {
    id: 'extensions',
    label: 'Extensions',
    icon: Boxes,
    shortcut: 'Cmd+Shift+X',
    testId: 'sidebar-extensions',
    panelTestId: 'extensions-panel',
    group: 'primary',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: FileText,
    testId: 'sidebar-notes',
    panelTestId: 'notes-view',
    group: 'secondary',
  },
  {
    id: 'plans',
    label: 'Plans',
    icon: ListChecks,
    testId: 'sidebar-plans',
    panelTestId: 'plans-view',
    group: 'secondary',
  },
  {
    id: 'browser',
    label: 'Browser',
    icon: Globe,
    testId: 'sidebar-browser',
    panelTestId: 'browser-view',
    group: 'secondary',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Zap,
    testId: 'sidebar-automations',
    panelTestId: 'automation-panel',
    group: 'secondary',
  },
  {
    id: 'account',
    label: 'Account',
    icon: CreditCard,
    testId: 'sidebar-account',
    panelTestId: 'account-panel',
    group: 'secondary',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    shortcut: 'Cmd+,',
    testId: 'sidebar-settings',
    panelTestId: 'settings-panel',
    group: 'secondary',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    testId: 'sidebar-security',
    panelTestId: 'security-panel',
    group: 'secondary',
  },
  {
    id: 'review',
    label: 'Review',
    icon: ScanSearch,
    testId: 'sidebar-review',
    panelTestId: 'review-panel',
    group: 'secondary',
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    testId: 'sidebar-knowledge',
    panelTestId: 'knowledge-panel',
    group: 'secondary',
  },
];

export const VIEW_BY_ID: Record<WorkbenchView, ViewDefinition> = VIEWS.reduce(
  (acc, view) => {
    acc[view.id] = view;
    return acc;
  },
  {} as Record<WorkbenchView, ViewDefinition>
);

/** Icon used for AI/agent affordances outside the activity bar. */
export const AgentIcon = Bot;

/**
 * Formats a shortcut for the current platform. Definitions are written with
 * `Cmd`, which would be wrong on the Linux and Windows builds.
 */
export function formatShortcut(shortcut: string | undefined): string | undefined {
  if (!shortcut) return undefined;
  return isMac() ? shortcut.replace(/Cmd/g, '⌘').replace(/Shift/g, '⇧') : shortcut.replace(/Cmd/g, 'Ctrl');
}

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
}

/**
 * Convenience for `React.lazy` default-export interop with named exports.
 *
 * `loader` renvoie le module tel qu'`import()` le produit, et `name` est
 * contraint aux clés de ce module : `T` est donc *inféré* depuis l'export réel
 * au lieu d'être choisi par l'appelant.
 *
 * La signature précédente prenait `loader: () => Promise<Record<string, unknown>>`
 * avec `T extends React.ComponentType<any>` libre. Rien ne liant `T` aux
 * arguments, TS le résolvait à sa contrainte, `ComponentType<any>` — les props
 * du composant devenaient `any`, et chaque callback passée en JSX partait en
 * TS7006 « implicitly has an 'any' type » côté appelant (`onEdit={(automation)
 * => ...}` dans `Workbench.tsx`). Le type `Automation` était donc effacé au
 * passage de `lazyNamed`, pas absent du package partagé.
 */
export function lazyNamed<
  TModule extends Record<string, unknown>,
  TName extends keyof TModule & string,
>(
  loader: () => Promise<TModule>,
  name: TName
): TModule[TName] extends React.ComponentType<infer TProps>
  ? React.LazyExoticComponent<React.ComponentType<TProps>>
  : never {
  return React.lazy(async () => {
    const module = await loader();
    return { default: module[name] as React.ComponentType<unknown> };
  }) as TModule[TName] extends React.ComponentType<infer TProps>
    ? React.LazyExoticComponent<React.ComponentType<TProps>>
    : never;
}
