/**
 * TerminalGrid - Multi-terminaux avec splits et gestion des tabs
 *
 * ## Terminal sessions survive a view switch
 *
 * Terminal is a document view: opening Explorer unmounts this component. The
 * PTY processes do not live here — `TerminalService` owns them in the main
 * process — but the *list* of them used to, in local `useState` with no
 * rehydration and no cleanup. So switching views:
 *
 *   1. lost every terminal the user had opened, and
 *   2. leaked its PTY: `terminal:kill` is only sent from the close button, so a
 *      shell process stayed alive with nobody reading it. Measured at 6 orphaned
 *      processes for 6 terminals over 3 view switches
 *      (`scripts/measure-pty-leak.ts`).
 *
 * The fix reattaches instead of killing. On mount, `terminal:list` asks main
 * what is actually running and the tab list is rebuilt from that answer; the
 * PTYs are never touched by mount/unmount. A terminal is killed only when the
 * user closes it.
 *
 * Killing on unmount was the simpler option and is the wrong one: a terminal
 * running a long build would be destroyed by a glance at the Git panel. Main
 * already tears every PTY down on app quit (`unregisterTerminalHandlers` ->
 * `TerminalService.cleanup()`), which is the point where "no longer needed" is
 * actually true.
 *
 * Output listeners are per-terminal and live in `TerminalTab`, whose effect
 * subscribes on mount and unsubscribes on unmount. Reattaching therefore
 * re-wires output rather than accumulating listeners — the failure mode that
 * would trade a process leak for a listener leak.
 */

import { useState, useCallback, useEffect } from 'react';
import { TerminalTab } from './TerminalTab';
import { Plus, LayoutGrid, Maximize2 } from 'lucide-react';

export interface Terminal {
  id: string;
  cwd?: string;
  title?: string;
}

export interface TerminalGridProps {
  className?: string;
}

/** Réponse de `terminal:create`. */
interface CreateTerminalResult {
  success: boolean;
  data?: { terminalId: string; pid: number };
}

/** Réponse de `terminal:list`. */
interface ListTerminalsResult {
  success: boolean;
  data?: { terminals: Array<{ id: string; pid: number; cwd: string; shell: string }> };
}

/** Payload de `event:terminal-exit`. */
interface TerminalExitPayload {
  terminalId: string;
  exitCode: number;
}

export function TerminalGrid({ className = '' }: TerminalGridProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'single' | 'horizontal' | 'vertical' | 'grid'>('single');

  // Rattachement au montage : main est la source de vérité sur les PTY vivants.
  //
  // Pas de dépendances : cet effet est le point de reprise du composant, il doit
  // s'exécuter une fois par montage. Une session tuée entre-temps n'est pas
  // renvoyée par `terminal:list`, donc la liste reconstruite ne contient jamais
  // d'onglet mort.
  useEffect(() => {
    let cancelled = false;

    const reattach = async () => {
      try {
        const response = (await window.ipc.invoke('terminal:list')) as ListTerminalsResult;

        // Le composant a pu être démonté pendant l'attente : écrire l'état
        // ensuite déclencherait un avertissement React et écraserait l'état d'un
        // montage plus récent.
        if (cancelled || !response?.success) return;

        // `Array.isArray` plutôt qu'une simple vérification de présence : une
        // réponse sans `terminals` (handler absent, forme inattendue) ferait
        // sinon échouer `.length` et la vue s'ouvrirait sur une exception au
        // lieu de son état vide.
        const running = response.data?.terminals;
        if (!Array.isArray(running) || running.length === 0) return;

        setTerminals(
          running.map((terminal, index) => ({
            id: terminal.id,
            cwd: terminal.cwd,
            title: `Terminal ${index + 1}`,
          }))
        );
        setActiveTerminalId(running[0].id);
      } catch (error) {
        // Échec du rattachement : la vue s'ouvre vide plutôt que de casser. Les
        // PTY restent joignables au prochain montage.
        console.error('Failed to list terminals:', error);
      }
    };

    void reattach();

    return () => {
      cancelled = true;
    };
  }, []);

  // Un terminal qui se termine de lui-même (`exit`, processus tué) disparaît de
  // la liste. Sans ça, l'onglet restait affiché après le rattachement alors que
  // le PTY n'existe plus : un onglet qui ne peut plus rien produire.
  useEffect(() => {
    const unsubscribe = window.ipc.on('event:terminal-exit', (payload) => {
      const event = payload as TerminalExitPayload;

      setTerminals((prev) => {
        const filtered = prev.filter((t) => t.id !== event.terminalId);
        if (filtered.length === prev.length) return prev;

        setActiveTerminalId((current) =>
          current === event.terminalId
            ? filtered.length > 0
              ? filtered[filtered.length - 1].id
              : null
            : current
        );

        return filtered;
      });
    });

    return unsubscribe;
  }, []);

  // Créer un nouveau terminal
  const createTerminal = useCallback(async (cwd?: string) => {
    try {
      const response = (await window.ipc.invoke('terminal:create', { cwd })) as CreateTerminalResult;

      if (response?.success && response.data) {
        const terminalId = response.data.terminalId;

        setTerminals((prev) => {
          const newTerminal: Terminal = {
            id: terminalId,
            cwd,
            // Numéroté depuis `prev` et non depuis `terminals` : deux créations
            // rapprochées lisaient la même valeur capturée et produisaient deux
            // onglets « Terminal 1 ».
            title: `Terminal ${prev.length + 1}`,
          };

          return [...prev, newTerminal];
        });
        setActiveTerminalId(terminalId);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  }, []);

  // Fermer un terminal
  const closeTerminal = useCallback(async (terminalId: string) => {
    try {
      await window.ipc.invoke('terminal:kill', terminalId);
      
      setTerminals((prev) => {
        const filtered = prev.filter((t) => t.id !== terminalId);
        
        // Si le terminal actif est fermé, sélectionner le suivant
        if (activeTerminalId === terminalId && filtered.length > 0) {
          setActiveTerminalId(filtered[filtered.length - 1].id);
        } else if (filtered.length === 0) {
          setActiveTerminalId(null);
        }
        
        return filtered;
      });
    } catch (error) {
      console.error('Failed to close terminal:', error);
    }
  }, [activeTerminalId]);

  // Split horizontal
  const splitHorizontal = useCallback(() => {
    if (layout === 'single') {
      setLayout('horizontal');
    }
    createTerminal();
  }, [layout, createTerminal]);

  // Split vertical
  const splitVertical = useCallback(() => {
    if (layout === 'single') {
      setLayout('vertical');
    }
    createTerminal();
  }, [layout, createTerminal]);

  // Toggle layout
  const toggleLayout = useCallback(() => {
    const layouts: Array<typeof layout> = ['single', 'horizontal', 'vertical', 'grid'];
    const currentIndex = layouts.indexOf(layout);
    const nextIndex = (currentIndex + 1) % layouts.length;
    setLayout(layouts[nextIndex]);
  }, [layout]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+` : Toggle terminal
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        if (terminals.length === 0) {
          createTerminal();
        }
      }
      // Ctrl+Shift+5 : Split horizontal
      else if (e.ctrlKey && e.shiftKey && e.key === '%') {
        e.preventDefault();
        splitHorizontal();
      }
      // Ctrl+Shift+\ : Split vertical
      else if (e.ctrlKey && e.shiftKey && e.key === '|') {
        e.preventDefault();
        splitVertical();
      }
      // Ctrl+Shift+W : Close active terminal
      else if (e.ctrlKey && e.shiftKey && e.key === 'W' && activeTerminalId) {
        e.preventDefault();
        closeTerminal(activeTerminalId);
      }
    },
    [terminals.length, activeTerminalId, createTerminal, splitHorizontal, splitVertical, closeTerminal]
  );

  // Render layout
  const renderTerminals = () => {
    if (terminals.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-secondary" data-testid="terminal-empty">
          <div className="text-6xl mb-4">$_</div>
          <p className="text-sm mb-2">No terminal open</p>
          <p className="text-sm mb-4 text-text-tertiary">Start a shell in this workspace.</p>
          <button
            onClick={() => createTerminal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Terminal
          </button>
          <p className="text-xs mt-4 text-neutral-600">Press Ctrl+` to open a terminal</p>
        </div>
      );
    }

    const visibleTerminals = terminals.slice(0, layout === 'grid' ? 4 : layout === 'single' ? 1 : 2);

    if (layout === 'single') {
      const terminal = terminals.find((t) => t.id === activeTerminalId) || terminals[0];
      return (
        <TerminalTab
          key={terminal.id}
          terminalId={terminal.id}
          cwd={terminal.cwd}
          onClose={() => closeTerminal(terminal.id)}
          className="h-full"
        />
      );
    }

    if (layout === 'horizontal') {
      return (
        <div className="flex h-full gap-0.5">
          {visibleTerminals.map((terminal) => (
            <div key={terminal.id} className="flex-1 min-w-0">
              <TerminalTab
                terminalId={terminal.id}
                cwd={terminal.cwd}
                onClose={() => closeTerminal(terminal.id)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      );
    }

    if (layout === 'vertical') {
      return (
        <div className="flex flex-col h-full gap-0.5">
          {visibleTerminals.map((terminal) => (
            <div key={terminal.id} className="flex-1 min-h-0">
              <TerminalTab
                terminalId={terminal.id}
                cwd={terminal.cwd}
                onClose={() => closeTerminal(terminal.id)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      );
    }

    if (layout === 'grid') {
      return (
        <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
          {visibleTerminals.map((terminal) => (
            <div key={terminal.id} className="min-w-0 min-h-0">
              <TerminalTab
                terminalId={terminal.id}
                cwd={terminal.cwd}
                onClose={() => closeTerminal(terminal.id)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#0a0a0a] ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="terminal-grid"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-neutral-200">Terminal</h2>
          {terminals.length > 0 && (
            <span className="text-xs text-neutral-500">
              {terminals.length} {terminals.length === 1 ? 'terminal' : 'terminals'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => createTerminal()}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="New terminal (Ctrl+`)"
            data-testid="new-terminal"
          >
            <Plus className="w-4 h-4 text-neutral-400" />
          </button>
          <button
            onClick={toggleLayout}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="Toggle layout"
            data-testid="split-terminal"
          >
            {layout === 'single' && <Maximize2 className="w-4 h-4 text-neutral-400" />}
            {layout !== 'single' && <LayoutGrid className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>
      </div>

      {/* Terminal tabs.
          Shown as soon as a terminal exists. The `single` layout renders only
          the active terminal, so with the old `> 2` threshold a second terminal
          was running but unreachable: no tab bar, no way to switch back to it.
          Always showing the bar also matches how every other IDE behaves. */}
      {terminals.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1a] border-b border-neutral-800 overflow-x-auto">
          {terminals.map((terminal, index) => (
            <button
              key={terminal.id}
              onClick={() => setActiveTerminalId(terminal.id)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                terminal.id === activeTerminalId
                  ? 'bg-[#0a0a0a] text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
              data-testid="terminal-tab"
              data-terminal-id={terminal.id}
            >
              {terminal.title || `Terminal ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0">{renderTerminals()}</div>

      {/* Keyboard shortcuts hint */}
      {terminals.length > 0 && (
        <div className="px-4 py-1.5 bg-[#141414] border-t border-neutral-800 text-xs text-neutral-600 flex items-center gap-4">
          <span>Ctrl+` New</span>
          <span>Ctrl+Shift+% Split H</span>
          <span>Ctrl+Shift+| Split V</span>
          <span>Ctrl+Shift+W Close</span>
        </div>
      )}
    </div>
  );
}
