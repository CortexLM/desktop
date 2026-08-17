/**
 * Settings View - Complete app settings and preferences
 */

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/select';
import { useToast } from '../../components/ui/toast';
import { FiSave, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import type { ProviderId, ProviderSettingsView } from '@cortex-ide/shared';
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDERS_WITH_BASE_URL,
  credentialSourceLabel,
  migrationRequests,
} from './provider-settings';

/**
 * Ce que le renderer détient pour un provider.
 *
 * Pas de champ `apiKey` côté état persistant : la clé vit dans le process main.
 * `draftKey` est ce que l'utilisateur vient de taper, en mémoire seulement, et
 * il est vidé dès que le Save a abouti. `view` est l'état renvoyé par main
 * (masque + provenance), jamais la clé.
 */
interface ProviderDraft {
  view: ProviderSettingsView;
  /** Saisie en cours. Chaîne vide = rien tapé depuis le dernier chargement. */
  draftKey: string;
  /** Base URL en cours d'édition. */
  draftBaseUrl: string;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  autoSave: boolean;
  autoSaveDelay: number;
  // `providers` a été RETIRÉ de ce blob : il portait les clés d'API en clair
  // dans `localStorage`, lisible par tout code du renderer, et `AIService` ne
  // l'a jamais lu. Les providers passent désormais par les canaux
  // `settings:*` (cf. `provider-settings.ts`).
  shortcuts: {
    [key: string]: string;
  };
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Monaco, Consolas, monospace',
  tabSize: 2,
  autoSave: true,
  autoSaveDelay: 1000,
  shortcuts: {
    'toggle-sidebar': 'Cmd+B',
    'toggle-terminal': 'Cmd+J',
    'new-chat': 'Cmd+N',
    'save-file': 'Cmd+S',
    'open-command-palette': 'Cmd+P',
  },
};

/**
 * Merges a stored settings blob over the defaults.
 *
 * `JSON.parse(saved)` was assigned to state directly, so any blob missing a key
 * produced a state object missing that key too. `settings.providers` was then
 * `undefined` and the AI Providers tab's `Object.entries(settings.providers)`
 * threw "Cannot convert undefined or null to object", unmounting the whole
 * settings screen — with no way back in to repair the value. Every settings file
 * written by an older build is such a blob, so this was reachable by upgrading.
 *
 * Unknown keys are dropped and mistyped values fall back to the default, which
 * also means what `saveSettings` writes is always loadable again.
 */
function normalizeSettings(raw: unknown): AppSettings {
  const source = isRecord(raw) ? raw : {};

  return {
    theme:
      source.theme === 'light' || source.theme === 'dark' || source.theme === 'system'
        ? source.theme
        : defaultSettings.theme,
    fontSize: finiteOr(source.fontSize, defaultSettings.fontSize),
    fontFamily: typeof source.fontFamily === 'string' && source.fontFamily.trim() !== ''
      ? source.fontFamily
      : defaultSettings.fontFamily,
    tabSize: finiteOr(source.tabSize, defaultSettings.tabSize),
    autoSave: typeof source.autoSave === 'boolean' ? source.autoSave : defaultSettings.autoSave,
    autoSaveDelay: finiteOr(source.autoSaveDelay, defaultSettings.autoSaveDelay),
    shortcuts: normalizeShortcuts(source.shortcuts),
  };
}

function normalizeShortcuts(raw: unknown): AppSettings['shortcuts'] {
  const source = isRecord(raw) ? raw : {};
  const shortcuts: AppSettings['shortcuts'] = { ...defaultSettings.shortcuts };

  for (const [action, binding] of Object.entries(source)) {
    if (typeof binding === 'string') shortcuts[action] = binding;
  }

  return shortcuts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A finite number, or the default.
 *
 * The number inputs run their value through `parseInt`, which yields NaN for an
 * empty or non-numeric field. `JSON.stringify({ fontSize: NaN })` is
 * `{"fontSize":null}`, so clearing a field and pressing Save persisted `null` —
 * and the next mount fed `null` into a controlled number input. Clamping is left
 * to the inputs' own min/max; this only rejects values that cannot round-trip.
 */
function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function SettingsView() {
  const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = React.useState(true);
  const [showApiKeys, setShowApiKeys] = React.useState<{ [key: string]: boolean }>({});
  /**
   * État des providers, tel que main le rapporte.
   *
   * Séparé de `settings` parce que sa source de vérité est différente : `settings`
   * vient de `localStorage` (préférences non sensibles), les providers viennent
   * de l'IPC. Les mélanger reconduirait la clé dans `localStorage` au premier
   * `JSON.stringify(settings)`.
   */
  const [providers, setProviders] = React.useState<ProviderDraft[]>([]);
  const [precedence, setPrecedence] = React.useState<string | null>(null);
  const toast = useToast();

  React.useEffect(() => {
    loadSettings();
    void loadProviders();
  }, []);

  /**
   * Charge l'état des providers depuis main, en migrant au passage ce qu'une
   * version précédente avait laissé dans `localStorage`.
   *
   * La migration est faite AVANT la lecture : une clé héritée doit être visible
   * comme configurée dès le premier affichage, sinon l'utilisateur croit l'avoir
   * perdue et la ressaisit.
   */
  const loadProviders = async () => {
    const bridge = window.ipc;
    if (!bridge) return;

    try {
      await migrateLegacyProviders();

      const response = await bridge.invoke('settings:get-providers');
      if (!response.success) {
        toast.error('Failed to load AI provider settings');
        return;
      }

      setProviders(
        response.data.providers.map((view) => ({
          view,
          draftKey: '',
          draftBaseUrl: view.baseUrl ?? '',
        }))
      );
      setPrecedence(response.data.precedence);
    } catch {
      // Pas de `error` journalisé : cette branche s'exécute autour d'un appel qui
      // transporte une clé, et un rejet peut citer son payload.
      toast.error('Failed to load AI provider settings');
    }
  };

  /**
   * Déplace vers main les clés laissées dans `localStorage`, puis les efface.
   *
   * Les laisser en place après migration reviendrait à garder le stockage qu'on
   * cherche précisément à quitter.
   */
  const migrateLegacyProviders = async () => {
    const bridge = window.ipc;
    if (!bridge) return;

    const raw = localStorage.getItem('cortex:settings');
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Blob illisible : `loadSettings` s'en plaint déjà, et il n'y a rien à
      // migrer d'un JSON cassé.
      return;
    }

    const requests = migrationRequests(parsed);

    for (const request of requests) {
      try {
        await bridge.invoke('settings:set-provider', request);
      } catch {
        // Un provider qui ne migre pas ne doit pas empêcher les autres.
      }
    }

    // `providers` quitte le blob, migration réussie ou non : cette clé ne doit
    // plus servir de stockage de secrets.
    if (typeof parsed === 'object' && parsed !== null && 'providers' in parsed) {
      const { providers: _dropped, ...rest } = parsed as Record<string, unknown>;
      localStorage.setItem('cortex:settings', JSON.stringify(rest));
    }
  };

  /**
   * Enregistre un provider : la clé part vers main et ne revient pas.
   *
   * `apiKey` n'est transmis que si l'utilisateur a tapé quelque chose. Sans cette
   * distinction, un Save déclenché pour basculer `enabled` effacerait la clé
   * stockée, puisque l'UI ne la connaît pas et ne peut pas la renvoyer.
   */
  const saveProvider = async (id: ProviderId, overrides?: { enabled?: boolean }) => {
    const bridge = window.ipc;
    if (!bridge) return;

    const draft = providers.find((entry) => entry.view.id === id);
    if (!draft) return;

    const request: {
      id: ProviderId;
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
    } = {
      id,
      enabled: overrides?.enabled ?? draft.view.enabled,
    };

    if (draft.draftKey.length > 0) request.apiKey = draft.draftKey;
    if (PROVIDERS_WITH_BASE_URL.has(id) && draft.draftBaseUrl.length > 0) {
      request.baseUrl = draft.draftBaseUrl;
    }

    try {
      const response = await bridge.invoke('settings:set-provider', request);
      if (!response.success) {
        toast.error(`Failed to save ${PROVIDER_LABELS[id]} settings`);
        return;
      }

      // L'état vient de la réponse, pas de la requête : c'est ce qui rend le
      // succès vérifiable (`active: true`) au lieu d'un simple « ok ». Et
      // `draftKey` est vidé, donc la clé en clair ne survit pas au Save.
      setProviders(
        response.data.providers.map((view) => ({
          view,
          draftKey: '',
          draftBaseUrl: view.baseUrl ?? '',
        }))
      );
    } catch {
      toast.error(`Failed to save ${PROVIDER_LABELS[id]} settings`);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load from localStorage or IPC
      const saved = localStorage.getItem('cortex:settings');
      if (saved) {
        setSettings(normalizeSettings(JSON.parse(saved)));
      }
    } catch (error) {
      // Deliberately not logging `error`: the settings blob holds provider API
      // keys, and V8's SyntaxError message quotes the first ~10 characters of
      // the input it choked on ("Unexpected token 's', \"sk-live-51\"..."). A
      // truncated write whose blob starts with a key would put that prefix in
      // the log. The error's constructor name is enough to tell a parse failure
      // from a storage failure.
      console.error('Failed to load settings:', errorKind(error));
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      // Normalized before the write, so a NaN from a cleared number field never
      // reaches storage, and so what is written is always loadable back.
      const normalized = normalizeSettings(settings);
      localStorage.setItem('cortex:settings', JSON.stringify(normalized));
      // Keep the form showing exactly what was persisted, rather than leaving a
      // rejected value on screen as if it had been saved.
      setSettings(normalized);
      toast.success('Settings saved successfully');
    } catch (error) {
      // Same reasoning as loadSettings: never log anything derived from the
      // settings payload.
      console.error('Failed to save settings:', errorKind(error));
      toast.error('Failed to save settings');
    }
  };

  const resetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(defaultSettings);
      toast.info('Settings reset to defaults');
    }
  };

  const toggleApiKeyVisibility = (provider: string) => {
    setShowApiKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <h1 className="text-sm font-semibold">Settings</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetSettings}>
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={saveSettings}>
            <FiSave className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="providers">AI Providers</TabsTrigger>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="shortcuts">Keyboard Shortcuts</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6 mt-6">
              <SettingSection title="Appearance">
                <SettingItem label="Theme" description="Choose your color scheme">
                  {/* Radix-based Select: `onValueChange` + Trigger/Content/Item,
                      not a native <select> with <option> children (which
                      rendered an empty dropdown). */}
                  <Select
                    value={settings.theme}
                    onValueChange={(value) =>
                      setSettings({ ...settings, theme: value as AppSettings['theme'] })
                    }
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingItem>
              </SettingSection>

              <SettingSection title="Auto Save">
                <SettingItem label="Enable Auto Save" description="Automatically save files">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                    className="w-4 h-4"
                  />
                </SettingItem>
                {settings.autoSave && (
                  <SettingItem label="Auto Save Delay (ms)" description="Delay before auto-saving">
                    <Input
                      type="number"
                      value={settings.autoSaveDelay}
                      onChange={(e) =>
                        setSettings({ ...settings, autoSaveDelay: parseInt(e.target.value) })
                      }
                      min={500}
                      max={5000}
                      step={100}
                    />
                  </SettingItem>
                )}
              </SettingSection>
            </TabsContent>

            {/* AI Providers */}
            <TabsContent value="providers" className="space-y-6 mt-6">
              {/* La precedence est annoncee par main, pas codee en dur ici :
                  deux descriptions de la meme regle qui divergent sont pires
                  qu'aucune. */}
              {precedence === 'settings-over-env' && (
                <p className="text-xs text-text-secondary" data-testid="settings-precedence">
                  Keys saved here take precedence over environment variables.
                </p>
              )}

              {providers.length === 0 && (
                <p className="text-xs text-text-secondary">
                  AI provider settings are unavailable.
                </p>
              )}

              {providers.map(({ view, draftKey, draftBaseUrl }) => (
                <SettingSection key={view.id} title={PROVIDER_LABELS[view.id]}>
                  <SettingItem
                    label="Enabled"
                    description={`Enable ${PROVIDER_LABELS[view.id]} integration`}
                  >
                    <input
                      type="checkbox"
                      checked={view.enabled}
                      aria-label={`Enable ${PROVIDER_LABELS[view.id]}`}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        // Ecrit tout de suite : un toggle est un geste complet,
                        // et il doit reconstruire le registry (activer un
                        // provider sans reconstruire, c'est le bug d'origine).
                        setProviders((prev) =>
                          prev.map((entry) =>
                            entry.view.id === view.id
                              ? { ...entry, view: { ...entry.view, enabled } }
                              : entry
                          )
                        );
                        void saveProvider(view.id, { enabled });
                      }}
                      className="w-4 h-4"
                    />
                  </SettingItem>

                  {/* La provenance de la cle est affichee meme quand le champ
                      parait vide : sinon une variable d'environnement active
                      passe pour une absence de configuration. */}
                  <SettingItem label="Credential" description={credentialSourceLabel(view)}>
                    <div className="text-xs text-text-secondary space-y-1">
                      <div data-testid={`provider-${view.id}-source`}>
                        {view.maskedApiKey ?? 'not set'}
                      </div>
                      <div data-testid={`provider-${view.id}-active`}>
                        {view.active ? 'resolved by the AI service' : 'not resolved'}
                      </div>
                    </div>
                  </SettingItem>

                  {view.enabled && (
                    <>
                      <SettingItem
                        label="API Key"
                        description="Sent to the main process on save. It is never read back."
                      >
                        <div className="relative">
                          <Input
                            type={showApiKeys[view.id] ? 'text' : 'password'}
                            value={draftKey}
                            aria-label={`${PROVIDER_LABELS[view.id]} API key`}
                            onChange={(e) =>
                              setProviders((prev) =>
                                prev.map((entry) =>
                                  entry.view.id === view.id
                                    ? { ...entry, draftKey: e.target.value }
                                    : entry
                                )
                              )
                            }
                            placeholder={view.maskedApiKey ?? 'sk-...'}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            aria-label={`Toggle ${PROVIDER_LABELS[view.id]} key visibility`}
                            onClick={() => toggleApiKeyVisibility(view.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                          >
                            {showApiKeys[view.id] ? (
                              <FiEyeOff className="w-4 h-4" />
                            ) : (
                              <FiEye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </SettingItem>

                      {PROVIDERS_WITH_BASE_URL.has(view.id) && (
                        <SettingItem label="Base URL" description="Custom API endpoint">
                          <Input
                            type="text"
                            value={draftBaseUrl}
                            aria-label={`${PROVIDER_LABELS[view.id]} base URL`}
                            onChange={(e) =>
                              setProviders((prev) =>
                                prev.map((entry) =>
                                  entry.view.id === view.id
                                    ? { ...entry, draftBaseUrl: e.target.value }
                                    : entry
                                )
                              )
                            }
                            placeholder="https://api.example.com"
                          />
                        </SettingItem>
                      )}

                      <SettingItem label="Available Models" description="Models you can use">
                        <div className="text-xs text-text-secondary space-y-1">
                          {PROVIDER_MODELS[view.id].map((model) => (
                            <div key={model} className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="font-mono">{model}</span>
                            </div>
                          ))}
                        </div>
                      </SettingItem>

                      <SettingItem
                        label=""
                        description="Saves this provider and rebuilds the AI service registry."
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void saveProvider(view.id)}
                        >
                          Save {PROVIDER_LABELS[view.id]}
                        </Button>
                      </SettingItem>
                    </>
                  )}
                </SettingSection>
              ))}
            </TabsContent>

            {/* Editor Settings */}
            <TabsContent value="editor" className="space-y-6 mt-6">
              <SettingSection title="Typography">
                <SettingItem label="Font Size" description="Editor font size in pixels">
                  <Input
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                    min={10}
                    max={24}
                  />
                </SettingItem>
                <SettingItem label="Font Family" description="Editor font family">
                  <Input
                    type="text"
                    value={settings.fontFamily}
                    onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                  />
                </SettingItem>
              </SettingSection>

              <SettingSection title="Formatting">
                <SettingItem label="Tab Size" description="Number of spaces per tab">
                  <Input
                    type="number"
                    value={settings.tabSize}
                    onChange={(e) => setSettings({ ...settings, tabSize: parseInt(e.target.value) })}
                    min={2}
                    max={8}
                  />
                </SettingItem>
              </SettingSection>
            </TabsContent>

            {/* Keyboard Shortcuts */}
            <TabsContent value="shortcuts" className="space-y-6 mt-6">
              <SettingSection title="Keyboard Shortcuts">
                {Object.entries(settings.shortcuts).map(([action, shortcut]) => (
                  <SettingItem key={action} label={formatActionName(action)} description="">
                    <Input
                      type="text"
                      value={shortcut}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          shortcuts: { ...settings.shortcuts, [action]: e.target.value },
                        })
                      }
                      placeholder="Cmd+X"
                      className="font-mono"
                    />
                  </SettingItem>
                ))}
              </SettingSection>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{title}</h3>
      <div className="space-y-4 pl-4 border-l-2 border-border">{children}</div>
    </div>
  );
}

function SettingItem({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        {description && <div className="text-xs text-text-secondary mt-1">{description}</div>}
      </div>
      <div className="w-64 flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * A log-safe description of a failure: the error's kind, never its message.
 *
 * Anything derived from the settings payload — including a SyntaxError's quoted
 * input snippet — can carry an API key.
 */
function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function formatActionName(action: string): string {
  return action
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
