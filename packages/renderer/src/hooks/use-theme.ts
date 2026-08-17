import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Read from localStorage or default to system
    const stored = localStorage.getItem('cortex-theme') as Theme;
    return stored || 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = window.document.documentElement;

    // Function to apply theme
    const applyTheme = (newTheme: Theme) => {
      let effectiveTheme: 'light' | 'dark';

      if (newTheme === 'system') {
        // Use system preference
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else {
        effectiveTheme = newTheme;
      }

      // Update DOM
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
      setResolvedTheme(effectiveTheme);

      // Store preference
      localStorage.setItem('cortex-theme', newTheme);
    };

    // Apply initial theme
    applyTheme(theme);

    // Listen for system theme changes when in system mode
    if (theme !== 'system') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
