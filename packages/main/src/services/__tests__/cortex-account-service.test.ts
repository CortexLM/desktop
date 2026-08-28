/**
 * `CortexAccountService` — le jeton, sa persistance, et ce qui n'en sort pas.
 *
 * Quatre propriétés, dans l'ordre de ce qui casse le plus silencieusement :
 *
 *   1. Le jeton ne sort jamais vers le renderer. `state()` est le seul chemin
 *      main -> renderer et aucun de ses champs ne doit le contenir — pas plus
 *      que le `device_code`, qui est échangeable contre un jeton.
 *   2. « Jeton refusé » et « API injoignable » sont distingués à la restauration.
 *      Les confondre dans un sens déconnecte à chaque coupure réseau ; dans
 *      l'autre, ça laisse une UI connectée dont chaque appel échoue.
 *   3. Le jeton est vérifié contre `/v1/me` au démarrage, pas présumé valide.
 *   4. Le flux d'appareil est mené ici : le renderer reçoit ce qui s'affiche et
 *      apprend l'issue par un événement.
 *
 * Le service écrit dans un fichier temporaire, jamais dans `userData` : le test
 * doit pouvoir relire l'octet posé sur disque pour vérifier ce qu'il contient.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { resetElectronMock, safeStorageMock, shellMock } from '../../../../../test/electron-mock';
import {
  CortexAccountService,
  toModelView,
  toUserView,
} from '../cortex-account-service';

/**
 * Jeton de forme réaliste, et assez distinctif pour qu'une recherche de
 * sous-chaîne ne puisse pas réussir par hasard.
 */
const TOKEN = 'wos-sealed-REAL-LOOKING-SESSION-VALUE-4242';
const DEVICE_CODE = 'a'.repeat(64);

let dir: string;
let filePath: string;

/** Réponses successives que le faux `fetch` doit servir. */
type Reply = { status: number; body: unknown };

function jsonResponse({ status, body }: Reply): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Un `fetch` piloté par route.
 *
 * Par route et non par ordre d'appel : `restore()` appelle `/v1/me`, un flux
 * d'appareil appelle deux autres routes, et une file ordonnée rendrait chaque
 * test dépendant du nombre d'appels internes du service.
 */
function stubFetch(routes: Record<string, Reply | Reply[]>): {
  fetch: typeof globalThis.fetch;
  calls: { url: string; headers: Record<string, string> }[];
} {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const queues = new Map<string, Reply[]>(
    Object.entries(routes).map(([route, reply]) => [
      route,
      Array.isArray(reply) ? [...reply] : [reply],
    ]),
  );

  // Typed off `globalThis.fetch` rather than with `RequestInfo`: the `main` package
  // compiles without the DOM lib, where that name does not exist.
  type FetchArgs = Parameters<typeof globalThis.fetch>;

  const fetch = vi.fn(async (input: FetchArgs[0], init?: FetchArgs[1]) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({ url, headers });

    const match = [...queues.keys()].find((route) => url.includes(route));
    if (!match) throw new Error(`stubFetch: no reply configured for ${url}`);

    const queue = queues.get(match)!;
    // La dernière réponse est répétée : un flux d'appareil sonde en boucle et
    // n'a pas de nombre d'appels prévisible.
    const reply = queue.length > 1 ? queue.shift()! : queue[0];
    return jsonResponse(reply);
  });

  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

function makeService(fetch: typeof globalThis.fetch): CortexAccountService {
  return new CortexAccountService({
    filePath,
    client: new CortexApiClient({ fetch }),
  });
}

/**
 * Écrit une session déjà persistée, comme après une connexion précédente.
 *
 * Le blob est produit par `safeStorage.encryptString` du mock plutôt que forgé à
 * la main : un base64 nu ne porte pas le marqueur que `decryptString` attend, et
 * le service le rejetterait comme venant d'un autre keyring — ce qui ferait
 * échouer les tests pour une raison qui n'a rien à voir avec ce qu'ils mesurent.
 */
function seedStoredSession(): void {
  writeFileSync(
    filePath,
    JSON.stringify({
      version: 1,
      accessTokenEnc: safeStorageMock.encryptString(TOKEN).toString('base64'),
    }),
    { encoding: 'utf8', mode: 0o600 },
  );
}

const ME_OK = {
  status: 200,
  body: { id: 'user_1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace' },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cortex-account-'));
  filePath = join(dir, 'cortex-session.json');
  // Rétablit `isEncryptionAvailable` à `true` : le test du stockage en clair la
  // force à `false`, et sans ce reset la valeur fuirait vers les suivants — qui
  // vérifieraient alors « pas de jeton en clair » sur un chemin qui en écrit un.
  resetElectronMock();
  shellMock.openExternal.mockClear();
  shellMock.openExternal.mockResolvedValue(undefined);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Le jeton ne traverse pas
// ---------------------------------------------------------------------------

describe('the token never reaches the renderer', () => {
  it('omits it from the state, signed in', async () => {
    seedStoredSession();
    const { fetch } = stubFetch({ '/v1/me': ME_OK });
    const service = makeService(fetch);

    const state = await service.restore();

    expect(state.user?.email).toBe('ada@example.com');
    // Sur le JSON entier, pas champ par champ : un futur champ ajouté à l'état
    // serait couvert sans que ce test ait à être modifié.
    expect(JSON.stringify(state)).not.toContain(TOKEN);
  });

  it('omits the device code from what a device flow hands back', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': {
        status: 200,
        body: {
          user_code: 'WDJB-MJHT',
          device_code: DEVICE_CODE,
          verification_uri: 'https://auth.cortex.foundation/device',
          expires_in: 900,
          interval: 5,
        },
      },
      '/auth/device/token': {
        status: 400,
        body: { error: 'authorization_pending', error_description: 'not yet' },
      },
    });
    const service = makeService(fetch);

    const started = await service.startDeviceFlow();
    service.cancelDeviceFlow();

    expect(started.userCode).toBe('WDJB-MJHT');
    // Le `device_code` s'échange contre un jeton : l'exposer, c'est exposer le
    // jeton avec une étape de plus.
    expect(JSON.stringify(started)).not.toContain(DEVICE_CODE);
  });
});

// ---------------------------------------------------------------------------
// 2. et 3. Restauration
// ---------------------------------------------------------------------------

describe('restoring a stored session', () => {
  it('verifies the token against the API rather than trusting it', async () => {
    seedStoredSession();
    const { fetch, calls } = stubFetch({ '/v1/me': ME_OK });

    await makeService(fetch).restore();

    expect(calls.some((call) => call.url.includes('/v1/me'))).toBe(true);
  });

  it('sends the token as the wos-session cookie, not as a bearer', async () => {
    seedStoredSession();
    const { fetch, calls } = stubFetch({ '/v1/me': ME_OK });

    await makeService(fetch).restore();

    const me = calls.find((call) => call.url.includes('/v1/me'))!;
    // Le service refuse explicitement le Bearer JWT : « Bearer JWT session auth
    // is disabled; use WorkOS sealed session cookie or API key ». Un jeton envoyé
    // en `Authorization` serait rejeté à chaque appel.
    expect(me.headers.authorization).toBeUndefined();
    expect(me.headers.cookie).toBe(`wos-session=${TOKEN}`);
  });

  it('drops a token the API rejects', async () => {
    seedStoredSession();
    const { fetch } = stubFetch({
      '/v1/me': { status: 401, body: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
    });
    const service = makeService(fetch);

    const state = await service.restore();

    expect(state.user).toBeNull();
    // Signé out ET nettoyé : garder le fichier ferait retenter le même jeton mort
    // à chaque lancement.
    expect(state.reachable).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  it('keeps the token when the API is merely unreachable', async () => {
    seedStoredSession();
    const fetch = vi.fn(() =>
      Promise.reject(new TypeError('fetch failed')),
    ) as unknown as typeof globalThis.fetch;
    const service = makeService(fetch);

    const state = await service.restore();

    // La distinction qui compte : sans elle, chaque perte de réseau déconnecte
    // l'utilisateur et lui fait refaire un flux d'appareil complet.
    expect(state.reachable).toBe(false);
    expect(existsSync(filePath)).toBe(true);
  });

  it('starts anonymous when nothing is stored', async () => {
    const { fetch } = stubFetch({});

    const state = await makeService(fetch).restore();

    expect(state.user).toBeNull();
  });

  it('recovers from a stored file it cannot decrypt', async () => {
    seedStoredSession();
    safeStorageMock.decryptString.mockImplementationOnce(() => {
      // Cas réel : le keyring a changé (autre machine, session recréée).
      throw new Error('not encrypted by this keyring');
    });
    const { fetch } = stubFetch({});

    const state = await makeService(fetch).restore();

    expect(state.user).toBeNull();
    expect(existsSync(filePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Persistance
// ---------------------------------------------------------------------------

describe('persistence', () => {
  /** Mène un flux jusqu'au jeton, ce qui est le seul chemin où le service écrit. */
  async function signInViaDeviceFlow(): Promise<CortexAccountService> {
    const { fetch } = stubFetch({
      '/auth/device/code': {
        status: 200,
        body: {
          user_code: 'WDJB-MJHT',
          device_code: DEVICE_CODE,
          verification_uri: 'https://auth.cortex.foundation/device',
          expires_in: 900,
          interval: 0,
        },
      },
      '/auth/device/token': { status: 200, body: { access_token: TOKEN } },
      '/v1/me': ME_OK,
    });
    const service = makeService(fetch);

    const changed: unknown[] = [];
    service.onAccountChanged((state) => changed.push(state));
    await service.startDeviceFlow();
    await vi.waitFor(() => expect(changed.length).toBeGreaterThan(0));

    return service;
  }

  it('writes the session file readable by its owner only', async () => {
    await signInViaDeviceFlow();

    // Le fichier peut porter le jeton en clair quand `safeStorage` est
    // indisponible, donc les permissions sont la dernière barrière.
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('stores the token encrypted when the keyring is available', async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);

    const service = await signInViaDeviceFlow();

    expect(service.state().credentialsEncrypted).toBe(true);
    expect(readFileSync(filePath, 'utf8')).not.toContain(TOKEN);
  });

  it('falls back to plaintext without hiding that it did', async () => {
    // Un Linux sans keyring renvoie légitimement false. Le recul par rapport au
    // chiffrement est assumé, mais il doit être visible — pas silencieux.
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const service = await signInViaDeviceFlow();

    expect(service.state().credentialsEncrypted).toBe(false);
    expect(readFileSync(filePath, 'utf8')).toContain(TOKEN);
    // Le repli reste hors de portée du renderer et des autres utilisateurs.
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('reads back a session it wrote itself', async () => {
    await signInViaDeviceFlow();

    // Le tour aller-retour compte autant que le chiffrement : un blob que le
    // service ne sait pas relire redemanderait un flux d'appareil à chaque
    // lancement, et c'est le genre de régression qu'un test d'écriture seul
    // laisse passer.
    const { fetch } = stubFetch({ '/v1/me': ME_OK });
    const restored = await makeService(fetch).restore();

    expect(restored.user?.email).toBe('ada@example.com');
  });
});

// ---------------------------------------------------------------------------
// 4. Flux d'appareil
// ---------------------------------------------------------------------------

describe('the device flow', () => {
  const CODE_REPLY = {
    status: 200,
    body: {
      user_code: 'WDJB-MJHT',
      device_code: DEVICE_CODE,
      verification_uri: 'https://auth.cortex.foundation/device',
      expires_in: 900,
      interval: 5,
    },
  };

  it('reports what the screen displays', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': CODE_REPLY,
      '/auth/device/token': {
        status: 400,
        body: { error: 'authorization_pending', error_description: 'not yet' },
      },
    });
    const service = makeService(fetch);

    const started = await service.startDeviceFlow();
    service.cancelDeviceFlow();

    expect(started).toMatchObject({
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://auth.cortex.foundation/device',
      expiresIn: 900,
    });
  });

  it('opens the approval page without being handed a URL', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': CODE_REPLY,
      '/auth/device/token': {
        status: 400,
        body: { error: 'authorization_pending', error_description: 'not yet' },
      },
    });
    const service = makeService(fetch);
    await service.startDeviceFlow();

    const result = await service.openVerificationPage();
    service.cancelDeviceFlow();

    expect(result.opened).toBe(true);
    expect(shellMock.openExternal).toHaveBeenCalledWith(
      'https://auth.cortex.foundation/device',
    );
  });

  it('opens nothing when no flow is in progress', async () => {
    const { fetch } = stubFetch({});
    const service = makeService(fetch);

    const result = await service.openVerificationPage();

    expect(result.opened).toBe(false);
    expect(shellMock.openExternal).not.toHaveBeenCalled();
  });

  it('reports a declined request as denied', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': { ...CODE_REPLY, body: { ...CODE_REPLY.body, interval: 0 } },
      '/auth/device/token': {
        status: 400,
        body: { error: 'access_denied', error_description: 'User declined' },
      },
    });
    const service = makeService(fetch);

    const seen: string[] = [];
    service.onDeviceStatus((status) => seen.push(status.kind));

    await service.startDeviceFlow();
    await vi.waitFor(() => expect(seen).toContain('denied'));
  });

  it('reports an unknown code as an error rather than as expiry', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': { ...CODE_REPLY, body: { ...CODE_REPLY.body, interval: 0 } },
      // Observé en direct sur le service : un code inconnu répond `invalid_grant`.
      // Le signaler comme « expiré » dirait à l'utilisateur d'attendre quelque
      // chose qui a déjà échoué.
      '/auth/device/token': {
        status: 400,
        body: { error: 'invalid_grant', error_description: 'Invalid device code' },
      },
    });
    const service = makeService(fetch);

    const seen: { kind: string }[] = [];
    service.onDeviceStatus((status) => seen.push(status));

    await service.startDeviceFlow();
    await vi.waitFor(() => expect(seen.some((s) => s.kind === 'error')).toBe(true));
    expect(seen.some((s) => s.kind === 'expired')).toBe(false);
  });

  it('signs in and persists when the user approves', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': { ...CODE_REPLY, body: { ...CODE_REPLY.body, interval: 0 } },
      '/auth/device/token': { status: 200, body: { access_token: TOKEN } },
      '/v1/me': ME_OK,
    });
    const service = makeService(fetch);

    const changed: unknown[] = [];
    service.onAccountChanged((state) => changed.push(state));

    await service.startDeviceFlow();
    await vi.waitFor(() => expect(changed.length).toBeGreaterThan(0));

    expect(service.state().user?.email).toBe('ada@example.com');
    // Persisté, donc le lancement suivant n'exige pas un nouveau flux.
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf8')).not.toContain(TOKEN);
  });

  it('stays silent once cancelled', async () => {
    const { fetch } = stubFetch({
      '/auth/device/code': { ...CODE_REPLY, body: { ...CODE_REPLY.body, interval: 0 } },
      '/auth/device/token': {
        status: 400,
        body: { error: 'access_denied', error_description: 'User declined' },
      },
    });
    const service = makeService(fetch);

    const seen: string[] = [];
    service.onDeviceStatus((status) => seen.push(status.kind));

    await service.startDeviceFlow();
    service.cancelDeviceFlow();

    // Une annulation est un geste de l'utilisateur : elle ne doit pas produire
    // un message d'échec sur un écran qu'il vient de quitter.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen).not.toContain('denied');
  });
});

// ---------------------------------------------------------------------------
// Déconnexion
// ---------------------------------------------------------------------------

describe('signing out', () => {
  it('clears the local session even when the server call fails', async () => {
    seedStoredSession();
    const { fetch } = stubFetch({
      '/v1/me': ME_OK,
      '/auth/logout': { status: 500, body: { code: 'SERVER_ERROR', message: 'boom' } },
    });
    const service = makeService(fetch);
    await service.restore();

    const state = await service.signOut();

    // Cliquer « se déconnecter » hors ligne doit déconnecter, pas coincer
    // l'utilisateur dans un état connecté.
    expect(state.user).toBeNull();
    expect(existsSync(filePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

describe('projections to the renderer', () => {
  it('builds a display name from whichever fields the identity provider filled in', () => {
    expect(toUserView({ id: 'u', first_name: 'Ada', last_name: 'Lovelace' }).displayName).toBe(
      'Ada Lovelace',
    );
    expect(toUserView({ id: 'u', name: 'Ada L.' }).displayName).toBe('Ada L.');
    // Ni nom ni prénom : `displayName` est absent plutôt que vide, pour que l'UI
    // puisse retomber sur l'email au lieu d'afficher une chaîne vide.
    expect(toUserView({ id: 'u', email: 'ada@example.com' }).displayName).toBeUndefined();
  });

  it('identifies a user with no id by email rather than losing it', () => {
    expect(toUserView({ email: 'ada@example.com' }).id).toBe('ada@example.com');
  });

  it('carries the server-side lock through to the picker', () => {
    // `locked` est l'expression côté serveur du gating par plan : le serveur est
    // la seule autorité sur ce qu'un appelant peut réellement utiliser.
    expect(toModelView({ id: 'm', object: 'model', locked: true }).requiresAccount).toBe(true);
    expect(toModelView({ id: 'm', object: 'model', is_premium: true }).requiresAccount).toBe(true);
    expect(toModelView({ id: 'm', object: 'model' }).requiresAccount).toBe(false);
  });

  it('reads the provider from an identifier that carries one', () => {
    expect(toModelView({ id: 'anthropic/claude-x', object: 'model' }).provider).toBe('anthropic');
    // Pas de préfixe : le champ est absent plutôt que deviné.
    expect(toModelView({ id: 'cortex-opus', object: 'model' }).provider).toBeUndefined();
  });
});
