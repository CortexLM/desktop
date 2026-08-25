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

export { NavItem } from './components/nav-item.tsx';
export type { NavItemProps } from './components/nav-item.tsx';

export { TextField } from './components/text-field.tsx';
export type { TextFieldProps } from './components/text-field.tsx';

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
