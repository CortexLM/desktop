/**
 * Debug context provider - Manage debug mode state
 */

import * as React from 'react';
import type { DebugSettings } from '@cortex-ide/shared/types/debug';

interface DebugContextValue {
  enabled: boolean;
  settings: DebugSettings | null;
  toggleDebugMode: () => void;
  updateSettings: (settings: Partial<DebugSettings>) => Promise<void>;
  showDebugPanel: boolean;
  setShowDebugPanel: (show: boolean) => void;
}

const DebugContext = React.createContext<DebugContextValue | null>(null);

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<DebugSettings | null>(null);
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);

  // Load initial settings
  React.useEffect(() => {
    loadSettings();
  }, []);

  // Persist debug panel state
  React.useEffect(() => {
    const stored = localStorage.getItem('debug:panel-visible');
    if (stored) {
      setShowDebugPanel(stored === 'true');
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem('debug:panel-visible', String(showDebugPanel));
  }, [showDebugPanel]);

  const loadSettings = async () => {
    try {
      const result = await window.electron.invoke<DebugSettings>('debug:get-settings');
      setSettings(result);
    } catch (error) {
      console.error('Failed to load debug settings:', error);
    }
  };

  const toggleDebugMode = async () => {
    if (!settings) return;
    
    const newEnabled = !settings.enabled;
    await updateSettings({ enabled: newEnabled });
  };

  const updateSettings = async (partial: Partial<DebugSettings>) => {
    if (!settings) return;
    
    try {
      await window.electron.invoke('debug:update-settings', partial);
      setSettings({ ...settings, ...partial });
    } catch (error) {
      console.error('Failed to update debug settings:', error);
      throw error;
    }
  };

  const value: DebugContextValue = {
    enabled: settings?.enabled || false,
    settings,
    toggleDebugMode,
    updateSettings,
    showDebugPanel,
    setShowDebugPanel
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug(): DebugContextValue {
  const context = React.useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
}
