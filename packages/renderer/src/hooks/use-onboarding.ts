/**
 * Onboarding hook - Manage first-time user experience
 */

import * as React from 'react';

interface OnboardingState {
  hasSeenWelcome: boolean;
  hasCompletedTutorial: boolean;
  hasConfiguredProvider: boolean;
}

export function useOnboarding() {
  const [state, setState] = React.useState<OnboardingState>({
    hasSeenWelcome: false,
    hasCompletedTutorial: false,
    hasConfiguredProvider: false,
  });

  React.useEffect(() => {
    // Load state from localStorage
    const saved = localStorage.getItem('cortex:onboarding');
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse onboarding state:', error);
      }
    }
  }, []);

  const markWelcomeSeen = React.useCallback(() => {
    const newState = { ...state, hasSeenWelcome: true };
    setState(newState);
    localStorage.setItem('cortex:onboarding', JSON.stringify(newState));
  }, [state]);

  const markTutorialCompleted = React.useCallback(() => {
    const newState = { ...state, hasCompletedTutorial: true };
    setState(newState);
    localStorage.setItem('cortex:onboarding', JSON.stringify(newState));
  }, [state]);

  const markProviderConfigured = React.useCallback(() => {
    const newState = { ...state, hasConfiguredProvider: true };
    setState(newState);
    localStorage.setItem('cortex:onboarding', JSON.stringify(newState));
  }, [state]);

  const shouldShowWelcome = React.useMemo(() => {
    // Don't show if user has explicitly skipped it
    const skipWelcome = localStorage.getItem('cortex:skip-welcome') === 'true';
    return !state.hasSeenWelcome && !skipWelcome;
  }, [state.hasSeenWelcome]);

  const resetOnboarding = React.useCallback(() => {
    const newState = {
      hasSeenWelcome: false,
      hasCompletedTutorial: false,
      hasConfiguredProvider: false,
    };
    setState(newState);
    localStorage.removeItem('cortex:onboarding');
    localStorage.removeItem('cortex:skip-welcome');
  }, []);

  return {
    ...state,
    shouldShowWelcome,
    markWelcomeSeen,
    markTutorialCompleted,
    markProviderConfigured,
    resetOnboarding,
  };
}
