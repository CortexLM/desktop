import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalService } from '../terminal-service';

// Mock node-pty
//
// `vi.mock` is hoisted above the imports, so the spies its factory closes over
// must be created inside `vi.hoisted` — a plain `const` above would still be
// in its temporal dead zone when the factory runs.
const { mockPtySpawn, mockPtyInstance } = vi.hoisted(() => ({
  mockPtySpawn: vi.fn(),
  mockPtyInstance: {
    pid: 12345,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  },
}));

vi.mock('node-pty', () => ({
  spawn: mockPtySpawn,
}));

describe('TerminalService', () => {
  let service: TerminalService;

  beforeEach(() => {
    service = new TerminalService(mockPtySpawn);
    mockPtySpawn.mockClear();
    mockPtyInstance.onData.mockClear();
    mockPtyInstance.onExit.mockClear();
    mockPtyInstance.write.mockClear();
    mockPtyInstance.resize.mockClear();
    mockPtyInstance.kill.mockClear();
    
    mockPtySpawn.mockReturnValue(mockPtyInstance);
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('createTerminal', () => {
    it('should create terminal with default options', () => {
      const terminal = service.createTerminal('term-1');

      expect(terminal.id).toBe('term-1');
      expect(terminal.pid).toBe(12345);
      expect(mockPtySpawn).toHaveBeenCalled();
      
      const spawnArgs = mockPtySpawn.mock.calls[0];
      expect(spawnArgs[1]).toEqual([]); // No args
      expect(spawnArgs[2].name).toBe('xterm-256color');
      expect(spawnArgs[2].cols).toBe(80);
      expect(spawnArgs[2].rows).toBe(30);
    });

    it('should use custom shell', () => {
      service.createTerminal('term-2', { shell: '/bin/zsh' });

      const spawnArgs = mockPtySpawn.mock.calls[0];
      expect(spawnArgs[0]).toBe('/bin/zsh');
    });

    it('should use custom cwd', () => {
      service.createTerminal('term-3', { cwd: '/custom/path' });

      const spawnArgs = mockPtySpawn.mock.calls[0];
      expect(spawnArgs[2].cwd).toBe('/custom/path');
    });

    it('should merge custom environment variables', () => {
      service.createTerminal('term-4', { 
        env: { CUSTOM_VAR: 'value' } 
      });

      const spawnArgs = mockPtySpawn.mock.calls[0];
      expect(spawnArgs[2].env.CUSTOM_VAR).toBe('value');
      expect(spawnArgs[2].env.TERM).toBe('xterm-256color');
      expect(spawnArgs[2].env.COLORTERM).toBe('truecolor');
    });

    it('should emit data events', () => {
      const dataHandler = vi.fn();
      service.on('data', dataHandler);

      service.createTerminal('term-5');

      // Simulate data callback
      const onDataCallback = mockPtyInstance.onData.mock.calls[0][0];
      onDataCallback('output data');

      expect(dataHandler).toHaveBeenCalledWith('term-5', 'output data');
    });

    it('should emit exit events and cleanup', () => {
      const exitHandler = vi.fn();
      service.on('exit', exitHandler);

      service.createTerminal('term-6');

      // Simulate exit callback
      const onExitCallback = mockPtyInstance.onExit.mock.calls[0][0];
      onExitCallback({ exitCode: 0, signal: undefined });

      expect(exitHandler).toHaveBeenCalledWith('term-6', 0, undefined);
      expect(service.getTerminal('term-6')).toBeUndefined();
    });

    it('should store terminal instance', () => {
      service.createTerminal('term-7');

      const retrieved = service.getTerminal('term-7');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('term-7');
    });
  });

  describe('writeToTerminal', () => {
    it('should write data to terminal', () => {
      service.createTerminal('term-1');

      service.writeToTerminal('term-1', 'echo hello\n');

      expect(mockPtyInstance.write).toHaveBeenCalledWith('echo hello\n');
    });

    it('should throw error for non-existent terminal', () => {
      expect(() => {
        service.writeToTerminal('non-existent', 'data');
      }).toThrow('Terminal non-existent not found');
    });
  });

  describe('resizeTerminal', () => {
    it('should resize terminal', () => {
      service.createTerminal('term-1');

      service.resizeTerminal('term-1', 120, 40);

      expect(mockPtyInstance.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should throw error for non-existent terminal', () => {
      expect(() => {
        service.resizeTerminal('non-existent', 80, 30);
      }).toThrow('Terminal non-existent not found');
    });
  });

  describe('killTerminal', () => {
    it('should kill terminal and remove from map', () => {
      service.createTerminal('term-1');

      service.killTerminal('term-1');

      expect(mockPtyInstance.kill).toHaveBeenCalled();
      expect(service.getTerminal('term-1')).toBeUndefined();
    });

    it('should handle non-existent terminal gracefully', () => {
      service.killTerminal('non-existent');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle kill errors gracefully', () => {
      service.createTerminal('term-1');
      // Scoped to this call only: a persistent throwing implementation also
      // fires during afterEach cleanup, which surfaced as a spurious failure.
      mockPtyInstance.kill.mockImplementationOnce(() => {
        throw new Error('Kill failed');
      });

      service.killTerminal('term-1');

      // Should still remove from map
      expect(service.getTerminal('term-1')).toBeUndefined();
    });
  });

  describe('listTerminals', () => {
    it('should list all terminals', () => {
      service.createTerminal('term-1', { cwd: '/path1', shell: '/bin/bash' });
      service.createTerminal('term-2', { cwd: '/path2', shell: '/bin/zsh' });

      const list = service.listTerminals();

      expect(list.length).toBe(2);
      expect(list[0].id).toBe('term-1');
      expect(list[0].pid).toBe(12345);
      expect(list[0].cwd).toBe('/path1');
      expect(list[0].shell).toBe('/bin/bash');
    });

    it('should return empty array when no terminals', () => {
      const list = service.listTerminals();
      expect(list).toEqual([]);
    });
  });

  describe('getTerminal', () => {
    it('should get terminal by id', () => {
      service.createTerminal('term-1');

      const terminal = service.getTerminal('term-1');

      expect(terminal).toBeDefined();
      expect(terminal?.id).toBe('term-1');
    });

    it('should return undefined for non-existent terminal', () => {
      const terminal = service.getTerminal('non-existent');
      expect(terminal).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should kill all terminals and clear map', () => {
      service.createTerminal('term-1');
      service.createTerminal('term-2');
      service.createTerminal('term-3');

      service.cleanup();

      expect(mockPtyInstance.kill).toHaveBeenCalledTimes(3);
      expect(service.listTerminals()).toEqual([]);
    });

    it('should handle cleanup with no terminals', () => {
      service.cleanup();
      expect(service.listTerminals()).toEqual([]);
    });
  });

  describe('platform-specific shell detection', () => {
    it('should detect shell based on OS', () => {
      // This test is platform-dependent, so we just ensure it doesn't throw
      service.createTerminal('term-platform');
      
      const spawnArgs = mockPtySpawn.mock.calls[0];
      expect(spawnArgs[0]).toBeDefined();
      expect(typeof spawnArgs[0]).toBe('string');
    });
  });

  describe('native addon is deferred', () => {
    it('constructs without calling spawn', () => {
      const spawn = vi.fn();
      const idle = new TerminalService(spawn);

      expect(spawn).not.toHaveBeenCalled();
      expect(idle.listTerminals()).toEqual([]);
    });
  });
});
