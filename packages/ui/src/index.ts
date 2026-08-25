/**
 * Cortex Code design system.
 *
 * Every component is a transcription of a section of the Paper UI kit. The reference export
 * for each lives in `design/paper/jsx/`, and the CSS header names the Paper node it came
 * from so a value can be traced back without opening the canvas.
 */

export { Badge, StatusBadge, SESSION_STATUS_TONES } from './components/badge.tsx';
export type { BadgeProps, BadgeTone, SessionStatus, StatusBadgeProps } from './components/badge.tsx';

export { Button } from './components/button.tsx';
export type { ButtonProps, ButtonVariant } from './components/button.tsx';

export { Chip } from './components/chip.tsx';
export type { ChipProps, ChipVariant } from './components/chip.tsx';

export { Composer } from './components/composer.tsx';
export type {
  ComposerAttachment,
  ComposerControl,
  ComposerProps,
} from './components/composer.tsx';

export { Menu, MenuItem, MenuSeparator } from './components/menu.tsx';
export type { MenuItemProps, MenuProps } from './components/menu.tsx';

export { NavItem } from './components/nav-item.tsx';
export type { NavItemProps } from './components/nav-item.tsx';

export { SessionCard } from './components/session-card.tsx';
export type { DiffStat, SessionCardProps } from './components/session-card.tsx';

export { TabPanel, Tabs } from './components/tabs.tsx';
export type { TabDefinition, TabPanelProps, TabsProps } from './components/tabs.tsx';

export { TextField } from './components/text-field.tsx';
export type { TextFieldProps } from './components/text-field.tsx';

export { Toast } from './components/toast.tsx';
export type { ToastProps, ToastTone } from './components/toast.tsx';

export { Icon, icons, resolveIcon } from './icons/index.tsx';
export type { IconDefinition, IconKey, IconName, IconProps } from './icons/index.tsx';

export {
  THEME_ATTRIBUTE,
  ThemeProvider,
  useTheme,
  type Theme,
  type ThemeContextValue,
  type ThemePreference,
  type ThemeProviderProps,
} from './theme/index.ts';
