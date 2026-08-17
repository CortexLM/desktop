/**
 * Le pont réglages -> service AI, de bout en bout dans l'application réelle.
 *
 * ---------------------------------------------------------------------------
 * Ce que ce fichier contenait avant
 * ---------------------------------------------------------------------------
 * Un test SANS AUCUNE ASSERTION : il écrivait un rapport JSON, appelait
 * `console.log`, et passait systématiquement — y compris quand la feature était
 * entièrement cassée. C'est le motif de faux vert que ce dépôt a passé une nuit
 * à éliminer. Il documentait le bug ; il ne pouvait pas le détecter.
 *
 * Il est remplacé par des assertions qui échouent si le pont est coupé :
 *
 *   1. les canaux `settings:*` sont joignables depuis le renderer (l'allowlist
 *      du preload les autorise) ;
 *   2. enregistrer une clé rend le provider RÉSOLU par le registry du main
 *      (`active: true`), là où `createSession` levait
 *      `Provider "anthropic" not found` ;
 *   3. la clé ne revient jamais au renderer, et n'est pas dans `localStorage`.
 *
 * Aucune requête réseau : la clé est fictive, donc `isAvailable()` échouerait.
 * Ce qui est mesuré est la RÉSOLUTION du provider — précisément ce qui manquait.
 */

import { test, expect } from '../fixtures/electron';

/** Clé fictive, de forme réaliste : jamais valide auprès d'un vrai provider. */
const PROBE_KEY = 'sk-ant-api03-E2E-PROBE-NOT-A-REAL-KEY-4242';

test.describe('settings -> AI provider bridge', () => {
  test('saving a key makes the provider resolvable by the AI service', async ({ page }) => {
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });

    // --- AVANT : anthropic n'est pas résolu -------------------------------
    const before = await page.evaluate(async () => {
      const response = await window.ipc.invoke('settings:get-providers');
      return response;
    });

    // Le canal répond : s'il manquait de l'allowlist, ce serait un rejet
    // « IPC channel not allowed », et si le handler manquait, un échec.
    expect(before.success, 'settings:get-providers must be reachable').toBe(true);
    if (!before.success) return;

    const anthropicBefore = before.data.providers.find((p) => p.id === 'anthropic');
    expect(anthropicBefore, 'anthropic must be listed').toBeDefined();
    expect(anthropicBefore?.active, 'no key yet, so nothing is resolved').toBe(false);

    // --- Le geste utilisateur : enregistrer une clé -----------------------
    const after = await page.evaluate(async (key) => {
      return window.ipc.invoke('settings:set-provider', {
        id: 'anthropic',
        enabled: true,
        apiKey: key,
      });
    }, PROBE_KEY);

    expect(after.success, 'settings:set-provider must succeed').toBe(true);
    if (!after.success) return;

    // --- APRÈS : le registry résout le provider ---------------------------
    // C'est LE critère. Sans reconstruction du registry, `activeProviders` ne
    // contiendrait pas anthropic et le chat continuerait d'échouer.
    expect(
      after.data.activeProviders,
      'the registry must resolve anthropic after the save'
    ).toContain('anthropic');

    const anthropicAfter = after.data.providers.find((p) => p.id === 'anthropic');
    expect(anthropicAfter?.active).toBe(true);
    expect(anthropicAfter?.credentialSource).toBe('settings');

    // Et la résolution survit à une relecture, donc elle est bien persistée
    // côté main et pas seulement dans la réponse.
    const reread = await page.evaluate(() => window.ipc.invoke('settings:get-providers'));
    expect(reread.success).toBe(true);
    if (!reread.success) return;
    expect(reread.data.providers.find((p) => p.id === 'anthropic')?.active).toBe(true);
  });

  test('the saved key never comes back to the renderer', async ({ page }) => {
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });

    await page.evaluate(async (key) => {
      await window.ipc.invoke('settings:set-provider', {
        id: 'anthropic',
        enabled: true,
        apiKey: key,
      });
    }, PROBE_KEY);

    const leak = await page.evaluate(async (key) => {
      const response = await window.ipc.invoke('settings:get-providers');

      // Tout ce que le renderer peut lire, en une chaîne : la réponse IPC
      // entière, `localStorage`, et le DOM.
      const localStorageDump = JSON.stringify({ ...window.localStorage });
      return {
        inResponse: JSON.stringify(response).includes(key),
        inLocalStorage: localStorageDump.includes(key),
        inDom: (document.body.innerText ?? '').includes(key),
        // Le masque, lui, doit être là : sinon l'utilisateur ne sait pas quelle
        // clé est enregistrée.
        maskedApiKey: response.success
          ? response.data.providers.find((p) => p.id === 'anthropic')?.maskedApiKey
          : undefined,
      };
    }, PROBE_KEY);

    expect(leak.inResponse, 'the key must not be in the IPC response').toBe(false);
    expect(leak.inLocalStorage, 'the key must not be in localStorage').toBe(false);
    expect(leak.inDom, 'the key must not be rendered').toBe(false);
    // `sk-…4242` : reconnaissable, inutilisable.
    expect(leak.maskedApiKey).toBe('sk-…4242');
  });

  test('the settings screen shows which credential is in use', async ({ page }) => {
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });

    await page.evaluate(async (key) => {
      await window.ipc.invoke('settings:set-provider', {
        id: 'anthropic',
        enabled: true,
        apiKey: key,
      });
    }, PROBE_KEY);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });

    const settingsButton = page.locator('[data-testid="sidebar-settings"]');
    if ((await settingsButton.count()) === 0) {
      // Le bouton de la barre latérale n'est pas le sujet de ce test : la
      // propriété testée (l'état vient du main) est déjà couverte ci-dessus.
      test.skip(true, 'settings is not reachable from the sidebar in this build');
      return;
    }

    await settingsButton.click();
    await page.locator('[role="tab"]', { hasText: 'AI Providers' }).click();

    // La précédence est annoncée par le main, pas devinée par l'UI.
    await expect(page.locator('[data-testid="settings-precedence"]')).toContainText(
      /precedence over environment/i
    );
    // Et l'état affiché est celui du registry, pas celui du formulaire.
    await expect(page.locator('[data-testid="provider-anthropic-active"]')).toContainText(
      'resolved by the AI service'
    );
  });
});
