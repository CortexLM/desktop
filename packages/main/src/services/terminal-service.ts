/**
 * Terminal Service - Gestion des terminaux PTY
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as os from 'os';

export interface TerminalInstance {
  id: string;
  pty: pty.IPty;
  pid: number;
  cwd: string;
  shell: string;
}

export interface TerminalOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export class TerminalService extends EventEmitter {
  private terminals: Map<string, TerminalInstance> = new Map();

  /**
   * Obtient le shell par défaut selon l'OS
   */
  private getDefaultShell(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: PowerShell ou cmd.exe
      return process.env.COMSPEC || 'powershell.exe';
    } else {
      // Unix: bash, zsh, ou sh
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Crée un nouveau terminal PTY
   */
  createTerminal(id: string, options: TerminalOptions = {}): TerminalInstance {
    // Configuration du shell
    const shell = options.shell || this.getDefaultShell();
    const cwd = options.cwd || process.env.HOME || process.cwd();
    
    // Environnement fusionné
    const env = {
      ...process.env,
      ...options.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    } as Record<string, string>;

    // Création du PTY
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env,
    });

    const terminal: TerminalInstance = {
      id,
      pty: ptyProcess,
      pid: ptyProcess.pid,
      cwd,
      shell,
    };

    // Écoute des données du PTY
    ptyProcess.onData((data) => {
      this.emit('data', id, data);
    });

    // Écoute de la sortie du PTY
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', id, exitCode, signal);
      this.terminals.delete(id);
    });

    this.terminals.set(id, terminal);
    return terminal;
  }

  /**
   * Envoie des données au terminal
   */
  writeToTerminal(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }
    terminal.pty.write(data);
  }

  /**
   * Redimensionne le terminal
   */
  resizeTerminal(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }
    terminal.pty.resize(cols, rows);
  }

  /**
   * Tue un terminal
   */
  killTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return;
    }
    
    try {
      terminal.pty.kill();
    } catch (error) {
      console.error(`Failed to kill terminal ${id}:`, error);
    }
    
    this.terminals.delete(id);
  }

  /**
   * Liste tous les terminaux actifs
   */
  listTerminals(): Array<{ id: string; pid: number; cwd: string; shell: string }> {
    return Array.from(this.terminals.values()).map((t) => ({
      id: t.id,
      pid: t.pid,
      cwd: t.cwd,
      shell: t.shell,
    }));
  }

  /**
   * Obtient un terminal par ID
   */
  getTerminal(id: string): TerminalInstance | undefined {
    return this.terminals.get(id);
  }

  /**
   * Nettoie tous les terminaux
   */
  cleanup(): void {
    for (const [id] of this.terminals) {
      this.killTerminal(id);
    }
    this.terminals.clear();
  }
}

// Instance singleton
let terminalService: TerminalService | null = null;

export function getTerminalService(): TerminalService {
  if (!terminalService) {
    terminalService = new TerminalService();
  }
  return terminalService;
}
