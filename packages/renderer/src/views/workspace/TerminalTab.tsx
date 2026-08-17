/**
 * TerminalTab - Single terminal avec xterm.js
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { X, Search, Copy, Trash2 } from 'lucide-react';

/** Payload de `event:terminal-data`. */
interface TerminalDataPayload {
  terminalId: string;
  data: string;
}

/** Payload de `event:terminal-exit`. */
interface TerminalExitPayload {
  terminalId: string;
  exitCode: number;
}

export interface TerminalTabProps {
  terminalId: string;
  cwd?: string;
  onClose?: () => void;
  onData?: (data: string) => void;
  className?: string;
}

export function TerminalTab({
  terminalId,
  cwd,
  onClose,
  onData,
  className = '',
}: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Création du terminal
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#404040',
        black: '#1a1a1a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#525252',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
      allowProposedApi: true,
    });

    // Addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Gestion des inputs utilisateur
    terminal.onData((data) => {
      onData?.(data);
      // Envoi au backend via IPC
      window.ipc.invoke('terminal:input', { terminalId, data });
    });

    // Écoute des données du backend. `window.ipc.on` livre un payload `unknown`
    // (le pont ne connaît pas les canaux), donc chaque abonné déclare sa forme.
    const unsubscribeData = window.ipc.on('event:terminal-data', (payload) => {
      const event = payload as TerminalDataPayload;
      if (event.terminalId === terminalId) {
        terminal.write(event.data);
      }
    });

    // Écoute de la sortie du terminal
    const unsubscribeExit = window.ipc.on('event:terminal-exit', (payload) => {
      const event = payload as TerminalExitPayload;
      if (event.terminalId === terminalId) {
        terminal.write(`\r\n\x1b[1;31m[Process exited with code ${event.exitCode}]\x1b[0m\r\n`);
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      // Notifie le backend du nouveau size
      window.ipc.invoke('terminal:resize', {
        terminalId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    });

    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      unsubscribeData();
      unsubscribeExit();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [terminalId, onData]);

  // Search functionality
  const handleSearch = (direction: 'next' | 'prev') => {
    if (!searchAddonRef.current || !searchQuery) return;

    if (direction === 'next') {
      searchAddonRef.current.findNext(searchQuery);
    } else {
      searchAddonRef.current.findPrevious(searchQuery);
    }
  };

  // Copy selection
  const handleCopy = async () => {
    if (!terminalRef.current) return;
    const selection = terminalRef.current.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  };

  // Clear terminal
  const handleClear = () => {
    terminalRef.current?.clear();
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#0a0a0a] ${className}`}
      data-testid="terminal-instance"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#141414] border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-mono">
            {cwd || '~'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5 text-neutral-400" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="Copy selection (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5 text-neutral-400" />
          </button>
          {/* handleClear existed but no control invoked it, so the terminal
              buffer could never be reset from the UI. */}
          <button
            onClick={handleClear}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="Clear terminal"
            data-testid="clear-terminal"
          >
            <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
              title="Close terminal"
              data-testid="close-terminal"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border-b border-neutral-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.shiftKey ? 'prev' : 'next');
              } else if (e.key === 'Escape') {
                setShowSearch(false);
              }
            }}
            placeholder="Search in terminal..."
            className="flex-1 px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={() => handleSearch('prev')}
            className="px-2 py-1 text-xs hover:bg-neutral-700 rounded"
          >
            ↑
          </button>
          <button
            onClick={() => handleSearch('next')}
            className="px-2 py-1 text-xs hover:bg-neutral-700 rounded"
          >
            ↓
          </button>
        </div>
      )}

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
