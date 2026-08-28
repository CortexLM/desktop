/**
 * Cortex IPC handlers — le contrat de canal, et ce qui ne le traverse pas.
 *
 * Trois choses que ni TypeScript ni un test de service ne peuvent voir :
 *
 *   1. Les cinq canaux acceptent `undefined` comme payload. Le preload les
 *      invoque sans argument (`ipcRenderer.invoke(channel)`), donc main reçoit
 *      `undefined` — un schéma d'objet strict rejetterait chaque appel, à
 *      l'exécution seulement. C'est exactement le piège que
 *      `GetProviderSettingsRequestSchema` avait déjà eu à corriger.
 *   2. Les noms de canaux sont écrits en littéral ici, pas importés de
 *      `IPC_CHANNELS`. Les importer rendrait le test tautologique : renommer la
 *      constante déplacerait les deux côtés ensemble et le test resterait vert
 *      pendant que le preload — qui utilise la valeur — cesserait de
 *      correspondre. Ces chaînes sont le contrat de fil.
 *   3. Aucune réponse ne porte de jeton.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

const service = {
  state: vi.fn(),
  listModels: vi.fn(),
  startDeviceFlow: vi.fn(),
  cancelDeviceFlow: vi.fn(),
  openVerificationPage: vi.fn(),
  signOut: vi.fn(),
  onDeviceStatus: vi.fn(() => () => {}),
  onAccountChanged: vi.fn(() => () => {}),
};

const proxyProductRequest = vi.fn();

vi.mock('../../../services/cortex-account-service', () => ({
  getCortexAccountService: () => service,
}));

vi.mock('../../../services/cortex-product-proxy', () => ({
  proxyProductRequest: (...args: unknown[]) => proxyProductRequest(...args),
}));

const { registerCortexHandlers, unregisterCortexHandlers } = await import('../cortex-handlers');

const ANONYMOUS = { user: null, reachable: true, credentialsEncrypted: true };

/** Invoque un canal comme le preload le fait : sans payload. */
async function invoke(channel: string): Promise<unknown> {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`no handler registered for ${channel}`);
  return handler({}, undefined);
}

beforeEach(() => {
  resetElectronMock();
  proxyProductRequest.mockReset();
  service.state.mockReturnValue(ANONYMOUS);
  service.listModels.mockResolvedValue({ models: [] });
  service.startDeviceFlow.mockResolvedValue({
    userCode: 'WDJB-MJHT',
    verificationUri: 'https://auth.cortex.foundation/device',
    expiresIn: 900,
  });
  service.openVerificationPage.mockResolvedValue({ opened: true });
  service.signOut.mockResolvedValue(ANONYMOUS);
  registerCortexHandlers();
});

afterEach(() => {
  unregisterCortexHandlers();
  vi.clearAllMocks();
});

const CHANNELS = [
  'cortex:get-state',
  'cortex:list-models',
  'cortex:device-start',
  'cortex:device-cancel',
  'cortex:open-verification',
  'cortex:sign-out',
] as const;

describe('channel registration', () => {
  it.each(CHANNELS)('registers %s', (channel) => {
    expect(registeredHandlers.has(channel)).toBe(true);
  });

  it('removes every channel on unregister', () => {
    unregisterCortexHandlers();

    for (const channel of CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(false);
    }

    registerCortexHandlers();
  });
});

describe('every channel accepts an absent payload', () => {
  it.each(CHANNELS)('%s succeeds when invoked with no argument', async (channel) => {
    // La propriété qui compte : le preload n'envoie rien, donc un rejet de
    // validation ici casserait la fonctionnalité sans erreur de compilation.
    await expect(invoke(channel)).resolves.toMatchObject({ success: true });
  });
});

describe('responses', () => {
  it('reports the account state', async () => {
    service.state.mockReturnValue({
      user: { id: 'u', email: 'ada@example.com' },
      reachable: true,
      credentialsEncrypted: true,
    });

    await expect(invoke('cortex:get-state')).resolves.toEqual({
      success: true,
      data: {
        user: { id: 'u', email: 'ada@example.com' },
        reachable: true,
        credentialsEncrypted: true,
      },
    });
  });

  it('passes a catalogue failure through instead of pretending it is empty', async () => {
    service.listModels.mockResolvedValue({ models: [], error: 'offline' });

    // Un catalogue vide et un catalogue qui n'a pas pu charger demandent deux
    // messages différents dans l'UI.
    await expect(invoke('cortex:list-models')).resolves.toEqual({
      success: true,
      data: { models: [], error: 'offline' },
    });
  });

  it('turns a thrown device-flow start into a failure envelope', async () => {
    service.startDeviceFlow.mockRejectedValue(new Error('service unreachable'));

    const response = (await invoke('cortex:device-start')) as {
      success: boolean;
      error: { message: string };
    };

    // Aucune exception ne doit traverser la frontière IPC : le renderer verrait
    // un rejet opaque au lieu du motif.
    expect(response.success).toBe(false);
    expect(response.error.message).toBe('service unreachable');
  });

  it('carries no token in any response', async () => {
    service.state.mockReturnValue({
      user: { id: 'u', email: 'ada@example.com' },
      reachable: true,
      credentialsEncrypted: true,
    });

    const responses = await Promise.all(CHANNELS.map((channel) => invoke(channel)));

    for (const response of responses) {
      const serialized = JSON.stringify(response);
      expect(serialized).not.toMatch(/accessToken|access_token|deviceCode|device_code/);
    }
  });
});

describe('events', () => {
  it('subscribes to the service on registration', () => {
    // Le renderer apprend l'issue d'un flux par un événement — il n'y a pas de
    // canal de sondage. Sans ces abonnements, l'écran attendrait indéfiniment.
    expect(service.onDeviceStatus).toHaveBeenCalled();
    expect(service.onAccountChanged).toHaveBeenCalled();
  });

  it('registers the product-request proxy', async () => {
    proxyProductRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: '{"id":"mst_1"}',
    });
    const handler = registeredHandlers.get('cortex:product-request');
    expect(handler).toBeDefined();
    const response = await handler?.({}, { method: 'GET', path: '/v1/mascots' });
    expect(proxyProductRequest).toHaveBeenCalledWith({ method: 'GET', path: '/v1/mascots' });
    expect(response).toEqual({
      success: true,
      data: { status: 200, headers: { 'content-type': 'application/json' }, bodyText: '{"id":"mst_1"}' },
    });
  });

  it('unsubscribes on unregister', () => {
    const offDevice = vi.fn();
    service.onDeviceStatus.mockReturnValue(offDevice);
    unregisterCortexHandlers();
    registerCortexHandlers();

    unregisterCortexHandlers();

    expect(offDevice).toHaveBeenCalled();

    registerCortexHandlers();
  });
});
