import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { BrowserWindowMock, resetElectronMock } from '../../../../../../test/electron-mock';

const service = new EventEmitter();

vi.mock('../../../services/mcp-service', () => ({
  getMCPService: () => service,
}));

import { setupMCPEvents } from '../mcp-handlers';

describe('setupMCPEvents', () => {
  beforeEach(() => {
    resetElectronMock();
    service.removeAllListeners();
    BrowserWindowMock.getAllWindows.mockReset();
  });

  it('forwards every MCP service event onto the matching renderer channel', () => {
    const send = vi.fn();
    BrowserWindowMock.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send } },
    ]);

    const stop = setupMCPEvents();

    service.emit('server:started', 'srv-1');
    service.emit('server:stopped', 'srv-1');
    service.emit('server:error', { serverId: 'srv-1', error: new Error('boom') });
    service.emit('tool:invoked', {
      serverId: 'srv-1',
      toolName: 'read',
      result: { content: [{ type: 'text', text: 'ok' }] },
    });
    service.emit('permission:granted', { serverId: 'srv-1', toolName: 'read', granted: true });
    service.emit('permission:revoked', { serverId: 'srv-1', toolName: 'read' });

    expect(send).toHaveBeenCalledWith('event:mcp-server-started', {
      type: 'mcp-server-started',
      serverId: 'srv-1',
    });
    expect(send).toHaveBeenCalledWith('event:mcp-server-stopped', {
      type: 'mcp-server-stopped',
      serverId: 'srv-1',
    });
    expect(send).toHaveBeenCalledWith('event:mcp-server-error', {
      type: 'mcp-server-error',
      serverId: 'srv-1',
      error: 'boom',
    });
    expect(send).toHaveBeenCalledWith('event:mcp-tool-invoked', {
      type: 'mcp-tool-invoked',
      serverId: 'srv-1',
      toolName: 'read',
      result: { content: [{ type: 'text', text: 'ok' }] },
    });
    expect(send).toHaveBeenCalledWith('event:mcp-permission-granted', {
      type: 'mcp-permission-granted',
      permission: { serverId: 'srv-1', toolName: 'read', granted: true },
    });
    expect(send).toHaveBeenCalledWith('event:mcp-permission-revoked', {
      type: 'mcp-permission-revoked',
      serverId: 'srv-1',
      toolName: 'read',
    });

    stop();
    send.mockClear();
    service.emit('server:started', 'srv-2');
    expect(send).not.toHaveBeenCalled();
  });
});
