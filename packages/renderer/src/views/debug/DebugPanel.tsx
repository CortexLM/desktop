/**
 * Debug Panel - Main debug interface
 */

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ConsolePanel } from './ConsolePanel';
import { IPCInspector } from './IPCInspector';
import { PerformancePanel } from './PerformancePanel';
import { MemoryPanel } from './MemoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { Button } from '../../components/ui/button';
import { FiX, FiDownload, FiSettings } from 'react-icons/fi';

interface DebugPanelProps {
  onClose?: () => void;
}

export function DebugPanel({ onClose }: DebugPanelProps) {
  const [activeTab, setActiveTab] = React.useState('console');

  const handleExportLogs = async () => {
    try {
      const result = await window.electron.invoke<{ success: boolean; path?: string }>('debug:export-logs');
      if (result.success) {
        console.log('Logs exported to:', result.path);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface border-t border-border">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-background">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-medium">Debug Panel</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportLogs}
            className="h-7 px-2"
          >
            <FiDownload className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 px-2"
            >
              <FiX className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-surface px-3">
          <TabsTrigger value="console" className="data-[state=active]:bg-background">
            Console
          </TabsTrigger>
          <TabsTrigger value="ipc" className="data-[state=active]:bg-background">
            IPC Inspector
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-background">
            Performance
          </TabsTrigger>
          <TabsTrigger value="memory" className="data-[state=active]:bg-background">
            Memory
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-background">
            <FiSettings className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="console" className="h-full m-0">
            <ConsolePanel />
          </TabsContent>
          <TabsContent value="ipc" className="h-full m-0">
            <IPCInspector />
          </TabsContent>
          <TabsContent value="performance" className="h-full m-0">
            <PerformancePanel />
          </TabsContent>
          <TabsContent value="memory" className="h-full m-0">
            <MemoryPanel />
          </TabsContent>
          <TabsContent value="settings" className="h-full m-0">
            <SettingsPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
