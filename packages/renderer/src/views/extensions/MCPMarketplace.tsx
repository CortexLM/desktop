/**
 * MCPMarketplace.tsx
 * Marketplace pour découvrir et installer de nouveaux serveurs MCP
 */

import React, { useState } from 'react';
import { Download, ExternalLink, Search, Filter } from 'lucide-react';

// Serveurs MCP populaires (catalogue hardcodé pour démo)
const MARKETPLACE_SERVERS = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and manage files and directories on the local filesystem',
    author: 'ModelContext Protocol',
    version: '1.0.0',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    // `.` rather than process.cwd(): `process` doesn't exist in the renderer,
    // and this array is built at module scope, so referencing it threw a
    // ReferenceError on import and took the whole Extensions view down. The
    // main process resolves the path relative to its own working directory.
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    category: 'System',
    popular: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Search repositories, manage issues, and interact with GitHub API',
    author: 'ModelContext Protocol',
    version: '1.0.0',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    category: 'Development',
    popular: true,
    requiresAuth: true,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    author: 'ModelContext Protocol',
    version: '1.0.0',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    category: 'Database',
    requiresAuth: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and interact with Slack workspaces',
    author: 'ModelContext Protocol',
    version: '1.0.0',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    category: 'Communication',
    requiresAuth: true,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Access and manage files in Google Drive',
    author: 'Community',
    version: '0.9.0',
    homepage: 'https://github.com/mcp-community/google-drive',
    command: 'npx',
    args: ['-y', '@mcp/server-google-drive'],
    category: 'Storage',
    requiresAuth: true,
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web using various search engines',
    author: 'Community',
    version: '1.0.0',
    homepage: 'https://github.com/mcp-community/web-search',
    command: 'npx',
    args: ['-y', '@mcp/server-web-search'],
    category: 'Utilities',
  },
];

const CATEGORIES = ['All', 'System', 'Development', 'Database', 'Communication', 'Storage', 'Utilities'];

export const MCPMarketplace: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const filteredServers = MARKETPLACE_SERVERS.filter((server) => {
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || server.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (server: typeof MARKETPLACE_SERVERS[0]) => {
    setInstalling(server.id);
    
    try {
      await window.cortex.mcp.installServer({
        id: server.id,
        name: server.name,
        description: server.description,
        command: server.command,
        args: server.args,
        version: server.version,
        author: server.author,
        homepage: server.homepage,
      });

      alert(`${server.name} installed successfully!`);
    } catch (err) {
      alert(`Failed to install ${server.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="mcp-marketplace">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">MCP Marketplace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover and install Model Context Protocol servers to extend AI capabilities
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="search-extensions"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="filter-category"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Server Grid */}
      {filteredServers.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-muted-foreground">No extensions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              data-testid="extension-card"
              data-name={server.name}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-foreground">{server.name}</h3>
                    {server.popular && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by {server.author} • v{server.version}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {server.description}
              </p>

              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs font-medium bg-secondary text-foreground rounded">
                  {server.category}
                </span>
                {server.requiresAuth && (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded">
                    Auth Required
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center space-x-2">
                <button
                  onClick={() => handleInstall(server)}
                  disabled={installing === server.id}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="install-extension"
                >
                  <Download className="w-4 h-4" />
                  <span>{installing === server.id ? 'Installing...' : 'Install'}</span>
                </button>

                {server.homepage && (
                  <a
                    href={server.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="View documentation"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
