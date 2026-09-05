import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cortex-account-service', () => ({
  getCortexAccountService: () => service,
}));

const service = {
  state: vi.fn(),
  getApiClient: vi.fn(),
};

const createCodeSession = vi.fn();
const isCortexApiError = vi.fn((_error?: unknown) => false);

vi.mock('@cortex-ide/cortex-api', () => ({
  createCodeSession: (...args: unknown[]) => createCodeSession(...args),
  followUpCodeSession: vi.fn(),
  isCortexApiError: (error: unknown) => isCortexApiError(error),
}));

const { startRemoteCodeSession } = await import('../session-remote-start');

describe('startRemoteCodeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.state.mockReturnValue({ user: { id: 'u' } });
    service.getApiClient.mockReturnValue({ baseUrl: 'https://api.cortex.foundation' });
    isCortexApiError.mockReturnValue(false);
  });

  it('refuses Cloud without an account', async () => {
    service.state.mockReturnValue({ user: null });
    await expect(
      startRemoteCodeSession({ prompt: 'fix lint', runtime: 'cloud' }),
    ).rejects.toThrow(/need a Cortex account/);
    expect(createCodeSession).not.toHaveBeenCalled();
  });

  it('uses the service session id and does not invent a local one', async () => {
    createCodeSession.mockResolvedValue({ id: 'ses_live', title: 'fix lint', runtime: 'cloud' });
    const summary = await startRemoteCodeSession({ prompt: 'fix lint', runtime: 'cloud' });
    expect(summary.id).toBe('ses_live');
    expect(summary.runtime).toBe('cloud');
  });

  it('fails closed when the control-plane route is missing', async () => {
    const error = Object.assign(new Error('not found'), { code: 'not_found', status: 404 });
    createCodeSession.mockRejectedValue(error);
    isCortexApiError.mockReturnValue(true);
    await expect(
      startRemoteCodeSession({ prompt: 'fix lint', runtime: 'ssh' }),
    ).rejects.toThrow(/not available on this workspace yet/);
  });
});
