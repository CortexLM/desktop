import type { Capabilities } from '@cortex-ide/cortex-api';

import type { Product } from '../routes.ts';

export interface RecentRun {
  id: string;
  title: string;
  repo: string;
  age: string;
  running?: boolean;
}

export interface RecentChat {
  id: string;
  title: string;
}

export interface SidebarPlan {
  label: string;
  progress: number;
}

export interface SidebarUser {
  name: string;
  plan: string;
  initials: string;
}

export interface SidebarProps {
  product: Product;
  onSwitchProduct: (product: Product) => void;
  capabilities: Capabilities;
  activeSlug: string;
  recentRuns: readonly RecentRun[];
  recentChats: readonly RecentChat[];
  plan?: SidebarPlan;
  user?: SidebarUser;
  unread?: Partial<Record<string, boolean>>;
  onNavigate: (slug: string) => void;
  onOpenRun: (id: string) => void;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onNewSession: () => void;
  onNewMascot: () => void;
  onOpenSearch?: () => void;
  onOpenAccount?: () => void;
  onSignIn?: () => void;
  onUpgrade?: () => void;
  onToggleSidebar?: () => void;
}
