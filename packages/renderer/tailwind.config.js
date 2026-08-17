/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page)',
        wash: 'var(--color-wash)',
        elevated: 'var(--color-elevated)',
        
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
        },
        
        border: {
          DEFAULT: 'var(--color-border)',
          soft: 'var(--color-border-soft)',
          strong: 'var(--color-border-strong)',
        },
        
        tint: {
          DEFAULT: 'var(--color-tint)',
          strong: 'var(--color-tint-strong)',
        },
        
        accent: {
          DEFAULT: 'var(--color-accent)',
          text: 'var(--color-accent-text)',
          soft: 'var(--color-accent-soft)',
          strong: 'var(--color-accent-strong)',
        },
        
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        
        secondary: 'var(--color-secondary)',
        ring: 'var(--color-ring)',

        // Aliases. A lot of components were written against shadcn-style names
        // (bg-background, text-muted-foreground, bg-surface) that were never
        // defined here, so those utilities silently emitted nothing. Mapping
        // them onto the real tokens makes the existing markup render.
        background: 'var(--color-page)',
        foreground: 'var(--color-text)',
        surface: 'var(--color-elevated)',
        muted: {
          DEFAULT: 'var(--color-wash)',
          foreground: 'var(--color-text-secondary)',
        },
        purple: 'var(--color-purple)',
        
        green: {
          DEFAULT: 'var(--color-green)',
          soft: 'var(--color-green-soft)',
        },
        
        red: {
          DEFAULT: 'var(--color-red)',
          soft: 'var(--color-red-soft)',
        },
        
        amber: {
          DEFAULT: 'var(--color-amber)',
          soft: 'var(--color-amber-soft)',
        },

        orange: 'var(--color-orange)',
        git: {
          add: 'var(--color-git-add)',
          del: 'var(--color-git-del)',
          mod: 'var(--color-git-mod)',
        },
      },
      
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
      
      fontWeight: {
        regular: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
      },
      
      letterSpacing: {
        normal: 'var(--tracking-normal)',
        tight: 'var(--tracking-tight)',
      },
      
      lineHeight: {
        xs: 'var(--leading-xs)',
        sm: 'var(--leading-sm)',
        base: 'var(--leading-base)',
      },
      
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        overlay: 'var(--shadow-overlay)',
      },
      
      // 200ms is the single default for every `transition-*` utility, so
      // interactions feel uniform without each component picking a duration.
      transitionDuration: {
        DEFAULT: 'var(--duration-base)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },

      transitionTimingFunction: {
        DEFAULT: 'var(--ease-standard)',
        standard: 'var(--ease-standard)',
      },
      
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
      },
      
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-out-to-top': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-8px)', opacity: '0' },
        },
        'slide-out-to-bottom': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(8px)', opacity: '0' },
        },
      },
      
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-in-from-top': 'slide-in-from-top 200ms ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 200ms ease-out',
        'slide-out-to-top': 'slide-out-to-top 150ms ease-in',
        'slide-out-to-bottom': 'slide-out-to-bottom 150ms ease-in',
      },
    },
  },
  plugins: [],
}
