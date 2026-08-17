/**
 * SettingsView — persistance des préférences, et le pont des providers AI.
 *
 * ---------------------------------------------------------------------------
 * Ce qui a changé, et pourquoi les anciens tests ne pouvaient pas rester
 * ---------------------------------------------------------------------------
 * Cette suite affirmait que la clé d'API faisait l'aller-retour par
 * `localStorage` (« round-trips a nested provider field », sur
 * `providers.xai.apiKey`). C'était le comportement vulnérable *encodé comme
 * contrat* : `localStorage` est lisible par tout code du renderer, et
 * `AIService` ne l'a jamais lu — la clé y était donc à la fois exposée et
 * inutile.
 *
 * Les tests de providers sont réécrits autour de la nouvelle propriété : la clé
 * part vers main par `settings:set-provider` et n'atteint JAMAIS `localStorage`.
 * Deux tests ont été ajoutés pour verrouiller ce sens unique, et un troisième
 * pour la migration des blobs déjà écrits par les versions précédentes.
 *
 * Les tests qui ne touchent pas aux providers (thème, NaN, raccourcis, reset)
 * sont conservés à l'identique : ils décrivaient un comportement correct.
 *
 * ---------------------------------------------------------------------------
 * Ce qui est stubbé
 * ---------------------------------------------------------------------------
 * `window.ipc`, remplacé par un faux process main qui garde les clés dans une
 * `Map`. Le composant, les inputs Radix et le vrai `ToastProvider` sont réels,
 * donc un échec ici veut dire que l'écran de réglages est cassé.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { ProviderId, ProviderSettingsView } from '@cortex-ide/shared';

import { SettingsView } from '../SettingsView';
import { ToastProvider } from '../../../components/ui/toast';

const STORAGE_KEY = 'cortex:settings';

/** A key shaped like a real one, so a substring search can't accidentally pass. */
const SECRET_KEY = 'sk-live-51NxTESTONLY9q7Zc4WvbeefKEYdoNotLog';

const ALL_PROVIDER_IDS: ProviderId[] = [
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
  'grok',
];

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

// ---------------------------------------------------------------------------
// Faux process main
//
// Garde les clés de son côté, comme le vrai : `getProviders` ne renvoie qu'un
// masque. C'est ce qui permet d'affirmer que la vue n'a jamais accès à la clé,
// plutôt que de le supposer.
// ---------------------------------------------------------------------------

interface FakeStored {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
}

let mainKeys: Map<ProviderId, FakeStored>;
/** Payloads reçus par `settings:set-provider`, dans l'ordre. */
let setProviderCalls: Array<Record<string, unknown>>;
let ipcInvoke: ReturnType<typeof vi.fn>;
/** Providers que le faux registry résout. */
let activeIds: Set<string>;

function maskKey(key: string): string {
  if (key.length <= 8) return '…';
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

function viewFor(id: ProviderId): ProviderSettingsView {
  const stored = mainKeys.get(id);
  const view: ProviderSettingsView = {
    id,
    enabled: stored?.enabled ?? false,
    credentialSource: stored?.apiKey ? 'settings' : 'none',
    envKeyPresent: false,
    active: activeIds.has(id),
  };
  if (stored?.apiKey) view.maskedApiKey = maskKey(stored.apiKey);
  if (stored?.baseUrl !== undefined) view.baseUrl = stored.baseUrl;
  return view;
}

function providersPayload() {
  return { providers: ALL_PROVIDER_IDS.map(viewFor), precedence: 'settings-over-env' as const };
}

beforeEach(() => {
  window.localStorage.clear();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  mainKeys = new Map();
  setProviderCalls = [];
  activeIds = new Set();

  ipcInvoke = vi.fn(async (channel: string, payload?: unknown) => {
    if (channel === 'settings:get-providers') {
      return { success: true, data: providersPayload() };
    }

    if (channel === 'settings:set-provider') {
      const request = payload as {
        id: ProviderId;
        enabled: boolean;
        apiKey?: string;
        baseUrl?: string;
      };
      setProviderCalls.push({ ...request });

      const previous = mainKeys.get(request.id);
      const next: FakeStored = { enabled: request.enabled };

      // Même sémantique que le service : `apiKey` absent conserve la clé.
      if (request.apiKey === undefined) {
        if (previous?.apiKey !== undefined) next.apiKey = previous.apiKey;
      } else if (request.apiKey.length > 0) {
        next.apiKey = request.apiKey;
      }

      if (request.baseUrl !== undefined) next.baseUrl = request.baseUrl;
      else if (previous?.baseUrl !== undefined) next.baseUrl = previous.baseUrl;

      mainKeys.set(request.id, next);

      // Le registry résout un provider activé qui a une clé.
      if (next.enabled && next.apiKey) activeIds.add(request.id);
      else activeIds.delete(request.id);

      return {
        success: true,
        data: {
          providers: ALL_PROVIDER_IDS.map(viewFor),
          activeProviders: [...activeIds] as ProviderId[],
        },
      };
    }

    throw new Error(`unexpected channel: ${channel}`);
  });

  Object.defineProperty(window, 'ipc', {
    configurable: true,
    value: { invoke: ipcInvoke, on: vi.fn(() => () => {}) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'ipc');
});

/** Everything written to the console during the test, as one string. */
function consoleOutput(): string {
  return [consoleErrorSpy, consoleLogSpy, consoleWarnSpy]
    .flatMap((spy) => spy.mock.calls)
    .map((args: unknown[]) => args.map((arg) => safeStringify(arg)).join(' '))
    .join('\n');
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Makes the next `localStorage.setItem` throw, and returns a restore function.
 *
 * `vi.spyOn(window.localStorage, 'setItem')` does not work here: jsdom's Storage
 * proxies property access, so the spy is installed but the real method still
 * runs and nothing throws — a test relying on it would assert against a failure
 * path that was never taken. Redefining the whole `localStorage` property is the
 * seam that actually holds.
 */
function breakStorageWrites(error: Error): () => void {
  const real = window.localStorage;
  const stub: Storage = {
    get length() {
      return real.length;
    },
    clear: () => real.clear(),
    getItem: (key: string) => real.getItem(key),
    key: (index: number) => real.key(index),
    removeItem: (key: string) => real.removeItem(key),
    setItem: () => {
      throw error;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: stub,
  });

  return () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: real,
    });
  };
}

/** Renders the view and waits for the mount-time load to finish. */
async function renderSettings() {
  const result = render(
    <ToastProvider>
      <SettingsView />
    </ToastProvider>
  );

  // The view shows a spinner until loadSettings() resolves.
  await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
  return result;
}

/** Renders, then waits for the IPC-driven provider list to arrive. */
async function renderWithProviders() {
  const result = await renderSettings();
  openTab(/ai providers/i);
  await waitFor(() => expect(screen.getByText('OpenAI')).toBeInTheDocument());
  return result;
}

const stored = (): Record<string, unknown> | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
};

/**
 * Clicks the header Save button.
 *
 * Anchored on an exact name: the providers tab now renders its own
 * `Save <provider>` buttons, and a loose `/save/i` would match those too.
 */
const clickSave = () => fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

/**
 * Switches to a settings tab by its trigger label.
 *
 * Radix's TabsTrigger activates on `mousedown`, not `click`; a bare
 * `fireEvent.click` leaves the panel unchanged and every query inside it fails
 * to find its element.
 */
const openTab = (name: RegExp) => {
  const trigger = screen.getByRole('tab', { name });
  fireEvent.mouseDown(trigger);
  expect(trigger).toHaveAttribute('data-state', 'active');
};

describe('SettingsView', () => {
  describe('persistence round-trip', () => {
    it('writes an edited value on Save and reads it back on the next mount', async () => {
      const { unmount } = await renderSettings();

      openTab(/editor/i);
      const fontSize = screen.getByDisplayValue('14');
      fireEvent.change(fontSize, { target: { value: '18' } });
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      expect(stored()).toMatchObject({ fontSize: 18 });

      // Fresh mount reads from storage.
      unmount();
      await renderSettings();
      openTab(/editor/i);
      expect(screen.getByDisplayValue('18')).toBeInTheDocument();
    });

    it('reports a failure instead of throwing when the write is rejected', async () => {
      await renderSettings();

      // Real case: Safari private mode / quota exceeded.
      const restore = breakStorageWrites(new DOMException('QuotaExceededError'));

      try {
        clickSave();

        await waitFor(() =>
          expect(screen.getByText(/failed to save settings/i)).toBeInTheDocument()
        );
        expect(screen.queryByText(/saved successfully/i)).not.toBeInTheDocument();
      } finally {
        restore();
      }
    });
  });

  describe('Save does not mutate what it did not show', () => {
    it('writes back a loaded config unchanged when nothing is edited', async () => {
      // The debug-panel bug this guards against: Save recomputed a field from an
      // unshown default and silently disabled a feature that was on.
      //
      // `providers` is deliberately absent from this blob: it is no longer part
      // of what `localStorage` holds. A Save must not reintroduce the key.
      const saved = {
        theme: 'light' as const,
        fontSize: 17,
        fontFamily: 'Fira Code, monospace',
        tabSize: 4,
        autoSave: false,
        autoSaveDelay: 2500,
        shortcuts: {
          'toggle-sidebar': 'Ctrl+B',
          'toggle-terminal': 'Cmd+J',
          'new-chat': 'Cmd+N',
          'save-file': 'Cmd+S',
          'open-command-palette': 'Cmd+P',
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      await renderSettings();
      clickSave();

      await waitFor(() => expect(screen.getByText(/saved successfully/i)).toBeInTheDocument());

      // Every field survives the no-op Save, including the ones no tab showed:
      // theme, tabSize and fontFamily are on tabs that were never opened.
      expect(stored()).toEqual(saved);
    });

    it('fills in a missing key from defaults without touching the stored ones', async () => {
      // The migration path: an older settings file gains the new keys, and every
      // value it did carry is preserved verbatim.
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'light', fontSize: 19, shortcuts: { 'save-file': 'Ctrl+S' } })
      );

      await renderSettings();
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      const result = stored() as Record<string, unknown>;
      expect(result.theme).toBe('light');
      expect(result.fontSize).toBe(19);
      expect((result.shortcuts as Record<string, string>)['save-file']).toBe('Ctrl+S');
      expect((result.shortcuts as Record<string, string>)['toggle-sidebar']).toBe('Cmd+B');
      // `providers` is NOT filled in from defaults any more: it left this blob.
      expect(result.providers).toBeUndefined();
    });
  });

  describe('invalid stored settings', () => {
    it('falls back to defaults instead of crashing on a corrupt blob', async () => {
      window.localStorage.setItem(STORAGE_KEY, '{not valid json');

      await renderSettings();

      expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
      // The view is still usable, on defaults.
      openTab(/editor/i);
      expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    });

    it('renders a partial blob from an older version without crashing', async () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'light', fontSize: 16 }));

      await renderWithProviders();

      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      // The registry id is `grok`; the label still reads xAI for the user.
      expect(screen.getByText('xAI (Grok)')).toBeInTheDocument();

      // The stored value that *was* present is kept.
      openTab(/editor/i);
      expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    });

    it('survives a blob whose providers entry is the wrong shape', async () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'dark', providers: 'not-an-object', shortcuts: null })
      );

      await renderWithProviders();

      expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument();
      openTab(/keyboard shortcuts/i);
      expect(screen.getByText('Save File')).toBeInTheDocument();
    });

    it('survives a stored `null`', async () => {
      window.localStorage.setItem(STORAGE_KEY, 'null');

      await renderSettings();

      openTab(/editor/i);
      expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    });
  });

  describe('validation before write', () => {
    it('does not persist a NaN font size when the field is cleared', async () => {
      // `parseInt('')` is NaN and `JSON.stringify({fontSize: NaN})` is
      // `{"fontSize":null}`. Reloading then fed `null` into a number input,
      // which React rejects — the editor font size was silently destroyed by
      // clearing a field and hitting Save.
      await renderSettings();

      openTab(/editor/i);
      fireEvent.change(screen.getByDisplayValue('14'), { target: { value: '' } });
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      const fontSize = stored()?.fontSize;
      expect(fontSize).not.toBeNull();
      expect(Number.isFinite(fontSize)).toBe(true);
    });

    it('does not persist a NaN auto-save delay', async () => {
      await renderSettings();

      fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '' } });
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      expect(Number.isFinite(stored()?.autoSaveDelay)).toBe(true);
    });

    it('rejects a theme value outside the three it supports', async () => {
      // The theme drives a CSS class elsewhere in the app. An arbitrary string
      // from a hand-edited or downgraded settings file would be applied as-is
      // and silently render an unthemed app.
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'solarized-midnight', fontSize: 16 })
      );

      await renderSettings();
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      expect(stored()?.theme).toBe('dark');
      // The valid sibling value is still honoured.
      expect(stored()?.fontSize).toBe(16);
    });

    it('accepts each supported theme unchanged', async () => {
      for (const theme of ['light', 'dark', 'system'] as const) {
        window.localStorage.clear();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
        const { unmount } = await renderSettings();
        clickSave();
        await waitFor(() => expect(stored()).not.toBeNull());
        expect(stored()?.theme, `theme "${theme}" was not preserved`).toBe(theme);
        unmount();
      }
    });

    it('shows the corrected value in the form after a rejected value is saved', async () => {
      // Without syncing state to what was persisted, the field keeps displaying
      // the rejected input while storage holds the fallback: the user is looking
      // at a value that is not saved anywhere, and a later Save of an unrelated
      // field re-submits it.
      await renderSettings();

      openTab(/editor/i);
      fireEvent.change(screen.getByDisplayValue('14'), { target: { value: '' } });
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      const persisted = String(stored()?.fontSize);
      // The form now shows exactly what is in storage, without a remount.
      expect(screen.getByDisplayValue(persisted)).toBeInTheDocument();
    });

    it('what it writes is always loadable back into the form', async () => {
      // The round-trip property stated as an invariant: whatever Save produces
      // must be accepted by loadSettings on the next mount.
      const { unmount } = await renderSettings();
      openTab(/editor/i);
      fireEvent.change(screen.getByDisplayValue('14'), { target: { value: 'abc' } });
      clickSave();
      await waitFor(() => expect(stored()).not.toBeNull());
      unmount();

      await renderSettings();

      // No load failure, and the font size input holds a real number rather than
      // the `null` that a NaN write would have produced.
      expect(screen.queryByText(/failed to load settings/i)).not.toBeInTheDocument();
      openTab(/editor/i);
      expect(Number.isFinite(stored()?.fontSize)).toBe(true);
      expect(screen.getByDisplayValue(String(stored()?.fontSize))).toBeInTheDocument();
    });
  });

  describe('conditional fields', () => {
    it('hides the auto-save delay when auto-save is off and restores it when on', async () => {
      await renderSettings();

      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
      const autoSave = screen.getAllByRole('checkbox')[0];
      fireEvent.click(autoSave);
      expect(screen.queryByDisplayValue('1000')).not.toBeInTheDocument();

      fireEvent.click(autoSave);
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });
  });

  describe('reset', () => {
    it('restores defaults in the form only after the confirm is accepted', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await renderSettings();
      openTab(/editor/i);
      fireEvent.change(screen.getByDisplayValue('14'), { target: { value: '20' } });

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();

      confirmSpy.mockReturnValue(true);
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    });

    it('does not touch storage until Save is pressed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize: 22 }));
      await renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      // Reset is form-local; the stored file still holds the old value.
      expect(stored()).toMatchObject({ fontSize: 22 });
      confirmSpy.mockRestore();
    });

    it('does not reset provider credentials, which main owns', async () => {
      // Reset is form-local and `localStorage`-scoped. It must not silently
      // revoke keys held by main: the user asked to reset preferences, not to
      // lose their credentials.
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      await renderWithProviders();

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      clickSave();

      await waitFor(() => expect(stored()).not.toBeNull());
      // No `settings:set-provider` was issued by the reset+save path.
      expect(setProviderCalls).toHaveLength(0);
      confirmSpy.mockRestore();
    });
  });
});

/**
 * Le pont des providers, côté renderer.
 *
 * Remplace « round-trips a nested provider field », qui affirmait que la clé
 * revenait par `localStorage`. La propriété inverse est désormais testée : la
 * clé sort par l'IPC et n'entre jamais dans `localStorage`.
 */
describe('SettingsView — pont des providers AI', () => {
  describe('la clé va vers main, et pas dans localStorage', () => {
    it('sends a typed key to settings:set-provider', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable Anthropic (Claude)'));
      await waitFor(() =>
        expect(screen.getByLabelText('Anthropic (Claude) API key')).toBeInTheDocument()
      );

      fireEvent.change(screen.getByLabelText('Anthropic (Claude) API key'), {
        target: { value: SECRET_KEY },
      });
      fireEvent.click(screen.getByRole('button', { name: /save anthropic/i }));

      await waitFor(() =>
        expect(setProviderCalls.some((call) => call.apiKey === SECRET_KEY)).toBe(true)
      );

      const call = setProviderCalls.find((c) => c.apiKey === SECRET_KEY);
      // L'identifiant du registry, pas le libellé d'affichage.
      expect(call?.id).toBe('anthropic');
      expect(call?.enabled).toBe(true);
    });

    it('never writes the key into localStorage', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('OpenAI API key'), {
        target: { value: SECRET_KEY },
      });
      fireEvent.click(screen.getByRole('button', { name: /save openai/i }));
      await waitFor(() => expect(setProviderCalls.length).toBeGreaterThan(0));

      // Puis un Save des préférences, qui est ce qui écrit dans localStorage.
      clickSave();
      await waitFor(() => expect(stored()).not.toBeNull());

      // La propriété centrale : rien de la clé, nulle part dans le stockage du
      // renderer. `JSON.stringify` couvre tous les champs, pas seulement ceux
      // auxquels on aurait pensé.
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain(SECRET_KEY);
      expect(JSON.stringify(stored())).not.toContain(SECRET_KEY);
    });

    it('clears the typed key from the form once it has been saved', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());

      const input = screen.getByLabelText('OpenAI API key') as HTMLInputElement;
      fireEvent.change(input, { target: { value: SECRET_KEY } });
      fireEvent.click(screen.getByRole('button', { name: /save openai/i }));

      // La clé en clair ne survit pas au Save, même en mémoire du composant.
      await waitFor(() =>
        expect((screen.getByLabelText('OpenAI API key') as HTMLInputElement).value).toBe('')
      );
    });

    it('shows a mask, never the key, once main holds it', async () => {
      mainKeys.set('anthropic', { enabled: true, apiKey: SECRET_KEY });
      activeIds.add('anthropic');

      const { container } = await renderWithProviders();

      // Le masque est affiché…
      expect(container.textContent).toContain(`sk-…${SECRET_KEY.slice(-4)}`);
      // …et la clé ne l'est pas. `textContent` couvre labels, descriptions et
      // toasts : tout ce qu'une capture d'écran ou un rapport de bug montrerait.
      expect(container.textContent).not.toContain(SECRET_KEY);
      // Ni dans la valeur d'un input : le champ de saisie part vide.
      expect(screen.queryByDisplayValue(SECRET_KEY)).not.toBeInTheDocument();
    });

    it('does not resend the key when only toggling enabled', async () => {
      mainKeys.set('anthropic', { enabled: true, apiKey: SECRET_KEY });
      activeIds.add('anthropic');
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable Anthropic (Claude)'));
      await waitFor(() => expect(setProviderCalls.length).toBeGreaterThan(0));

      const call = setProviderCalls[setProviderCalls.length - 1];
      // `apiKey` absent = « garde la clé stockée ». L'envoyer vide l'effacerait,
      // et l'UI ne la connaît pas donc elle ne peut pas la renvoyer.
      expect(call.apiKey).toBeUndefined();
      expect(call.enabled).toBe(false);
      // Et la clé est toujours chez main.
      expect(mainKeys.get('anthropic')?.apiKey).toBe(SECRET_KEY);
    });
  });

  describe('la précédence est visible', () => {
    it('states that saved keys win over the environment', async () => {
      await renderWithProviders();
      expect(screen.getByTestId('settings-precedence')).toHaveTextContent(
        /take precedence over environment variables/i
      );
    });

    it('names the environment variable that is in use', async () => {
      ipcInvoke.mockImplementation(async (channel: string) => {
        if (channel !== 'settings:get-providers') throw new Error('unexpected');
        return {
          success: true,
          data: {
            precedence: 'settings-over-env' as const,
            providers: [
              {
                id: 'anthropic' as ProviderId,
                enabled: true,
                credentialSource: 'env' as const,
                envKeyPresent: true,
                envVar: 'ANTHROPIC_API_KEY',
                active: true,
              },
            ],
          },
        };
      });

      const { container } = await renderSettings();
      openTab(/ai providers/i);
      await waitFor(() => expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument());

      // Un champ qui paraît vide alors qu'une variable est active est un piège :
      // la vue doit le dire.
      expect(container.textContent).toContain('ANTHROPIC_API_KEY');
    });

    it('warns that a saved key overrides an environment variable', async () => {
      ipcInvoke.mockImplementation(async (channel: string) => {
        if (channel !== 'settings:get-providers') throw new Error('unexpected');
        return {
          success: true,
          data: {
            precedence: 'settings-over-env' as const,
            providers: [
              {
                id: 'anthropic' as ProviderId,
                enabled: true,
                maskedApiKey: 'sk-…4242',
                credentialSource: 'settings' as const,
                envKeyPresent: true,
                envVar: 'ANTHROPIC_API_KEY',
                active: true,
              },
            ],
          },
        };
      });

      const { container } = await renderSettings();
      openTab(/ai providers/i);
      await waitFor(() => expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument());

      expect(container.textContent).toMatch(/your setting takes precedence/i);
    });
  });

  describe('ce que le registry résout est affiché', () => {
    it('reports a provider as resolved once main confirms it', async () => {
      await renderWithProviders();

      expect(screen.getByTestId('provider-openai-active')).toHaveTextContent('not resolved');

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('OpenAI API key'), {
        target: { value: SECRET_KEY },
      });
      fireEvent.click(screen.getByRole('button', { name: /save openai/i }));

      // « resolved » vient de la réponse du main, pas de la requête : c'est ce
      // qui rend le succès vérifiable au lieu d'être annoncé.
      await waitFor(() =>
        expect(screen.getByTestId('provider-openai-active')).toHaveTextContent(
          'resolved by the AI service'
        )
      );
    });
  });

  describe('migration depuis localStorage', () => {
    it('moves a legacy key to main and deletes it from localStorage', async () => {
      // Un blob écrit par la version précédente, avec la clé en clair.
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          theme: 'dark',
          fontSize: 15,
          providers: {
            anthropic: { enabled: true, apiKey: SECRET_KEY, models: ['claude-3-opus'] },
          },
        })
      );

      await renderWithProviders();

      // La clé est partie vers main…
      await waitFor(() =>
        expect(setProviderCalls.some((call) => call.apiKey === SECRET_KEY)).toBe(true)
      );
      // …et ne se trouve plus dans localStorage. La laisser aurait été garder
      // exactement le stockage qu'on cherche à quitter.
      await waitFor(() =>
        expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain(SECRET_KEY)
      );
      expect((stored() as Record<string, unknown>).providers).toBeUndefined();
      // Les préférences non sensibles du même blob survivent.
      expect(stored()).toMatchObject({ theme: 'dark', fontSize: 15 });
    });

    it('maps the legacy `xai` id onto the registry id `grok`', async () => {
      // Le décalage d'identifiants : l'UI écrivait `xai`, le registry ne connaît
      // que `grok`. Migrer sans traduire n'aurait jamais résolu ce provider.
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          providers: { xai: { enabled: true, apiKey: SECRET_KEY, baseUrl: 'https://api.x.ai/v1' } },
        })
      );

      await renderWithProviders();

      await waitFor(() => expect(setProviderCalls.length).toBeGreaterThan(0));
      const call = setProviderCalls.find((c) => c.apiKey === SECRET_KEY);
      expect(call?.id).toBe('grok');
      expect(call?.baseUrl).toBe('https://api.x.ai/v1');
    });

    it('migrates nothing from a provider entry without a key', async () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ providers: { anthropic: { enabled: true, apiKey: '' } } })
      );

      await renderWithProviders();

      // Envoyer un `enabled` sans clé écraserait avec un blob périmé un réglage
      // déjà fait côté main.
      expect(setProviderCalls).toHaveLength(0);
    });
  });

  describe('la clé ne fuite pas par les journaux', () => {
    it('keeps the key out of the console on a successful save', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('OpenAI API key'), {
        target: { value: SECRET_KEY },
      });
      fireEvent.click(screen.getByRole('button', { name: /save openai/i }));

      await waitFor(() => expect(setProviderCalls.length).toBeGreaterThan(0));
      expect(consoleOutput()).not.toContain(SECRET_KEY);
    });

    it('keeps the key out of the console and the toast when the IPC call fails', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('OpenAI API key'), {
        target: { value: SECRET_KEY },
      });

      // Une erreur qui porte elle-même le payload — la forme exacte qu'un
      // `console.error('...', error)` naïf mettrait dans le journal.
      ipcInvoke.mockRejectedValueOnce(
        new Error(`main refused {"apiKey":"${SECRET_KEY}"}`)
      );

      fireEvent.click(screen.getByRole('button', { name: /save openai/i }));

      await waitFor(() =>
        expect(screen.getByText(/failed to save openai/i)).toBeInTheDocument()
      );
      // Ni le journal ni le toast ne citent la clé, alors que l'erreur la
      // portait dans son propre message.
      expect(consoleOutput()).not.toContain(SECRET_KEY);
      expect(document.body.textContent).not.toContain(SECRET_KEY);
    });

    it('keeps a corrupt blob key out of the console during migration', async () => {
      // Une écriture tronquée laisse un blob qui ne parse pas tout en contenant
      // la clé. Journaliser le blob, ou une erreur qui le porte, la ferait fuir.
      window.localStorage.setItem(
        STORAGE_KEY,
        `{"providers":{"openai":{"apiKey":"${SECRET_KEY}"`
      );

      await renderSettings();

      expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
      const output = consoleOutput();
      expect(output).not.toContain(SECRET_KEY);
      // V8 cite les ~10 premiers caractères de l'entrée fautive dans le message
      // d'un SyntaxError : un préfixe suffit à identifier la clé et son compte.
      expect(output).not.toContain(SECRET_KEY.slice(0, 10));
    });
  });

  describe('champs conditionnels', () => {
    it('reveals the key field only for an enabled provider', async () => {
      await renderWithProviders();

      // Tous les providers commencent désactivés : aucun champ de clé.
      expect(screen.queryByLabelText('OpenAI API key')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());
    });

    it('does not invent a Base URL field for a provider that has no endpoint', async () => {
      // OpenAI et Anthropic n'ont pas d'endpoint configurable : afficher un
      // champ pour eux montrerait un réglage que le provider ignore.
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());
      expect(screen.queryByLabelText('OpenAI base URL')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Enable xAI (Grok)'));
      await waitFor(() =>
        expect(screen.getByLabelText('xAI (Grok) base URL')).toBeInTheDocument()
      );
    });

    it('masks the key input until the reveal toggle is used', async () => {
      await renderWithProviders();

      fireEvent.click(screen.getByLabelText('Enable OpenAI'));
      await waitFor(() => expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument());

      const input = screen.getByLabelText('OpenAI API key') as HTMLInputElement;
      expect(input.type).toBe('password');

      fireEvent.click(screen.getByLabelText('Toggle OpenAI key visibility'));
      expect((screen.getByLabelText('OpenAI API key') as HTMLInputElement).type).toBe('text');
    });
  });

  describe('quand le pont est absent', () => {
    it('renders without crashing when window.ipc is unavailable', async () => {
      Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'ipc');

      await renderSettings();
      openTab(/ai providers/i);

      // Dégradé, pas cassé : les autres onglets restent utilisables.
      expect(screen.getByText(/provider settings are unavailable/i)).toBeInTheDocument();
      openTab(/editor/i);
      expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    });

    it('surfaces a failure when main rejects the read', async () => {
      ipcInvoke.mockResolvedValueOnce({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'nope' },
      });

      await renderSettings();
      openTab(/ai providers/i);

      await waitFor(() =>
        expect(screen.getByText(/failed to load ai provider settings/i)).toBeInTheDocument()
      );
    });
  });
});
