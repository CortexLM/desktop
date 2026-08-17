/**
 * MCP Extensions - Main container for MCP-related views
 */

import React, { useState } from 'react';
import { Package, ShoppingBag, Settings, Wrench } from 'lucide-react';
import { MCPExtensionList } from './MCPExtensionList';
import { MCPMarketplace } from './MCPMarketplace';
import { MCPConfig } from './MCPConfig';
import { MCPToolsView } from './MCPToolsView';

type MCPView = 'list' | 'marketplace' | 'config' | 'tools';

export const MCPExtensions: React.FC = () => {
  const [activeView, setActiveView] = useState<MCPView>('list');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const handleConfigureServer = (serverId: string) => {
    setSelectedServerId(serverId);
    setActiveView('config');
  };

  const handleViewTools = (serverId: string) => {
    setSelectedServerId(serverId);
    setActiveView('tools');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="flex items-center space-x-1 p-4 border-b border-border">
        <button
          onClick={() => setActiveView('list')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === 'list'
              ? 'bg-primary text-white'
              : 'text-foreground hover:bg-secondary'
          }`}
          data-testid="extensions-installed-tab"
        >
          <Package className="w-4 h-4" />
          <span>Installed</span>
        </button>

        <button
          onClick={() => setActiveView('marketplace')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === 'marketplace'
              ? 'bg-primary text-white'
              : 'text-foreground hover:bg-secondary'
          }`}
          data-testid="extensions-marketplace-tab"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Marketplace</span>
        </button>

        {activeView === 'config' && selectedServerId && (
          <button
            onClick={() => setActiveView('list')}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-secondary text-foreground rounded-md"
          >
            <Settings className="w-4 h-4" />
            <span>Configuration</span>
          </button>
        )}

        {activeView === 'tools' && selectedServerId && (
          <button
            onClick={() => setActiveView('list')}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-secondary text-foreground rounded-md"
          >
            <Wrench className="w-4 h-4" />
            <span>Tools</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeView === 'list' && (
          <MCPExtensionList
            onConfigureServer={handleConfigureServer}
            onViewTools={handleViewTools}
          />
        )}

        {activeView === 'marketplace' && <MCPMarketplace />}

        {activeView === 'config' && selectedServerId && (
          <MCPConfig
            serverId={selectedServerId}
            onClose={() => setActiveView('list')}
          />
        )}

        {activeView === 'tools' && selectedServerId && (
          <MCPToolsView serverId={selectedServerId} />
        )}
      </div>
    </div>
  );
};

export default MCPExtensions;
