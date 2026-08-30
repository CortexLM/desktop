import type { Capabilities } from '@cortex-ide/cortex-api';

import type { Product } from '../routes.ts';
import type { MascotFace, MascotLook } from '../state/bot-map.ts';

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

export interface SidebarMascot {
  id: string;
  name: string;
  look: MascotLook;
  face: MascotFace;
  unread?: boolean;
  computerLabel: string;
  running?: boolean;
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
  mascots: readonly SidebarMascot[];
  plan?: SidebarPlan;
  user?: SidebarUser;
  unread?: Partial<Record<string, boolean>>;
  onNavigate: (slug: string) => void;
  onOpenRun: (id: string) => void;
  onOpenChat: (id: string) => void;
  onOpenMascot: (id: string) => void;
  onNewChat: () => void;
  onNewSession: () => void;
  onNewMascot: () => void;
  onOpenSearch?: () => void;
  onOpenAccount?: () => void;
  onSignIn?: () => void;
  onUpgrade?: () => void;
  onToggleSidebar?: () => void;
}
