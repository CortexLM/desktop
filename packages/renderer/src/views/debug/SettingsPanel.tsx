/**
 * Settings Panel - Debug settings configuration
 */

import * as React from 'react';
import type { DebugSettings } from '@cortex-ide/shared/types/debug';
import { Button } from '../../components/ui/button';
import { FiSave, FiRefreshCw } from 'react-icons/fi';

/** Informations d'environnement remontées par le main process. */
interface SystemInfo {
  version: string;
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  v8: string;
  appPath: string;
  userData: string;
  logs: string;
}

export function SettingsPanel() {
  const [settings, setSettings] = React.useState<DebugSettings | null>(null);
  const [systemInfo, setSystemInfo] = React.useState<SystemInfo | null>(null);

  React.useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electron.invoke<DebugSettings>('debug:get-settings');
      setSettings(result);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadSystemInfo = async () => {
    try {
      // `invoke` returns `unknown`; this channel answers with SystemInfo.
      const result = (await window.electron.invoke('debug:get-system-info')) as SystemInfo;
      setSystemInfo(result);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      await window.electron.invoke('debug:update-settings', settings);
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleReset = () => {
    loadSettings();
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Debug Settings</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <FiRefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              <FiSave className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* General Settings */}
        <div className="p-4 bg-surface rounded border border-border space-y-4">
          <h3 className="text-sm font-medium text-accent">General</h3>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">Enable Debug Mode</div>
              <div className="text-xs text-text-secondary">
                Collect and display debug information
              </div>
            </div>
          </label>

          <div>
            <label className="text-sm font-medium block mb-2">Log Level</label>
            <select
              value={settings.logLevel}
              onChange={(e) =>
                setSettings({ ...settings, logLevel: e.target.value as DebugSettings['logLevel'] })
              }
              className="w-full h-9 px-3 text-sm bg-background border border-border rounded"
            >
              <option value="debug">Debug (All messages)</option>
              <option value="info">Info (Info and above)</option>
              <option value="warn">Warn (Warnings and errors)</option>
              <option value="error">Error (Errors only)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Max Log Size (MB)</label>
            <input
              type="number"
              value={settings.maxLogSize}
              onChange={(e) => setSettings({ ...settings, maxLogSize: parseInt(e.target.value) })}
              min={1}
              max={100}
              className="w-full h-9 px-3 text-sm bg-background border border-border rounded"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.logRotation}
              onChange={(e) => setSettings({ ...settings, logRotation: e.target.checked })}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">Log Rotation</div>
              <div className="text-xs text-text-secondary">
                Automatically rotate log files (keep last 10 files)
              </div>
            </div>
          </label>
        </div>

        {/* Categories */}
        <div className="p-4 bg-surface rounded border border-border space-y-4">
          <h3 className="text-sm font-medium text-accent">Log Categories</h3>
          
          {Object.entries(settings.categories).map(([key, enabled]) => (
            <label key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  categories: { ...settings.categories, [key]: e.target.checked }
                })}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="text-sm font-medium capitalize">{key}</div>
              </div>
            </label>
          ))}
        </div>

        {/* System Info */}
        {systemInfo && (
          <div className="p-4 bg-surface rounded border border-border space-y-3">
            <h3 className="text-sm font-medium text-accent">System Information</h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-text-secondary">Version</div>
                <div className="font-mono">{systemInfo.version}</div>
              </div>
              <div>
                <div className="text-text-secondary">Platform</div>
                <div className="font-mono">{systemInfo.platform} ({systemInfo.arch})</div>
              </div>
              <div>
                <div className="text-text-secondary">Electron</div>
                <div className="font-mono">{systemInfo.electron}</div>
              </div>
              <div>
                <div className="text-text-secondary">Chrome</div>
                <div className="font-mono">{systemInfo.chrome}</div>
              </div>
              <div>
                <div className="text-text-secondary">Node</div>
                <div className="font-mono">{systemInfo.node}</div>
              </div>
              <div>
                <div className="text-text-secondary">V8</div>
                <div className="font-mono">{systemInfo.v8}</div>
              </div>
              <div className="col-span-2">
                <div className="text-text-secondary">App Path</div>
                <div className="font-mono text-xs break-all">{systemInfo.appPath}</div>
              </div>
              <div className="col-span-2">
                <div className="text-text-secondary">User Data</div>
                <div className="font-mono text-xs break-all">{systemInfo.userData}</div>
              </div>
              <div className="col-span-2">
                <div className="text-text-secondary">Logs Directory</div>
                <div className="font-mono text-xs break-all">{systemInfo.logs}</div>
              </div>
            </div>
          </div>
        )}

        {/* DevTools */}
        <div className="p-4 bg-surface rounded border border-border space-y-3">
          <h3 className="text-sm font-medium text-accent">Developer Tools</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Open DevTools</span>
              <kbd className="px-2 py-1 text-xs bg-background border border-border rounded">
                F12 or Cmd+Option+I
              </kbd>
            </div>
            <div className="text-xs text-text-secondary">
              Press F12 to open Chrome DevTools for advanced debugging
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
