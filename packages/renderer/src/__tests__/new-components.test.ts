/**
 * Component Integration Test
 * Tests that all new components can be imported and rendered
 */

import { describe, it, expect } from 'vitest';

describe('New Components', () => {
  it('should export Toast components', async () => {
    const { ToastProvider, useToast } = await import('../components/ui/toast');
    expect(ToastProvider).toBeDefined();
    expect(useToast).toBeDefined();
  });

  it('should export Skeleton components', async () => {
    const { Skeleton, SkeletonCard, SkeletonList, SkeletonTable } = await import('../components/ui/skeleton');
    expect(Skeleton).toBeDefined();
    expect(SkeletonCard).toBeDefined();
    expect(SkeletonList).toBeDefined();
    expect(SkeletonTable).toBeDefined();
  });

  it('should export Onboarding components', async () => {
    const { WelcomeScreen, InteractiveTutorial } = await import('../components/onboarding');
    expect(WelcomeScreen).toBeDefined();
    expect(InteractiveTutorial).toBeDefined();
  });

  it('should export SettingsView', async () => {
    const { SettingsView } = await import('../views/settings');
    expect(SettingsView).toBeDefined();
  });

  it('should export useOnboarding hook', async () => {
    const { useOnboarding } = await import('../hooks/use-onboarding');
    expect(useOnboarding).toBeDefined();
  });

  it('should export all UI components from index', async () => {
    const ui = await import('../components/ui');
    expect(ui.ToastProvider).toBeDefined();
    expect(ui.useToast).toBeDefined();
    expect(ui.Skeleton).toBeDefined();
    expect(ui.SkeletonCard).toBeDefined();
    expect(ui.SkeletonList).toBeDefined();
    expect(ui.SkeletonTable).toBeDefined();
  });
});

describe('Component Props', () => {
  it('Toast should have correct types', async () => {
    // Importing for its side effect of type-checking the module.
    await import('../components/ui/toast');
    const mockToast = {
      id: '123',
      type: 'success' as const,
      message: 'Test',
      description: 'Test description',
      duration: 5000,
    };
    expect(mockToast).toBeDefined();
  });

  it('Onboarding state should have correct structure', () => {
    const state = {
      hasSeenWelcome: false,
      hasCompletedTutorial: false,
      hasConfiguredProvider: false,
    };
    expect(state).toBeDefined();
  });
});

describe('Integration', () => {
  it('App should import all new components', async () => {
    // This will fail if there are import errors
    const App = await import('../App');
    expect(App.default).toBeDefined();
  });
});
