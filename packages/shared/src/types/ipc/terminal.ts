/**
 * Types IPC - Terminal
 */

export interface CreateTerminalRequest {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export interface CreateTerminalResponse {
  terminalId: string;
  pid: number;
}

export interface TerminalInputRequest {
  terminalId: string;
  data: string;
}

export interface TerminalResizeRequest {
  terminalId: string;
  cols: number;
  rows: number;
}

export interface TerminalDataEvent {
  type: 'terminal-data';
  terminalId: string;
  data: string;
}

export interface TerminalExitEvent {
  type: 'terminal-exit';
  terminalId: string;
  exitCode: number;
}
