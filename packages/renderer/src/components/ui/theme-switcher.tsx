import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '../../hooks/use-theme';
import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Hint, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface ThemeSwitcherProps {
  variant?: 'dropdown' | 'buttons';
}

/**
 * ThemeToggle - single button that flips between light and dark.
 *
 * The three-way ThemeSwitcher below is right for a settings page, but a
 * toolbar wants one predictable control. This always inverts the theme that is
 * currently on screen, so 'system' resolves to a concrete choice on first use.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Hint content={`Switch to ${nextTheme} theme`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(nextTheme)}
        aria-label={`Switch to ${nextTheme} theme`}
        data-testid="theme-switcher"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </Hint>
  );
}

export function ThemeSwitcher({ variant = 'buttons' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  if (variant === 'dropdown') {
    return (
      <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>System</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-sm bg-wash p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={theme === 'light' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setTheme('light')}
              className="h-7 w-7"
            >
              <Sun className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Light</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={theme === 'dark' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setTheme('dark')}
              className="h-7 w-7"
            >
              <Moon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dark</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={theme === 'system' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setTheme('system')}
              className="h-7 w-7"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>System</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
