/**
 * BrowserView - Preview intégré avec webview
 * 
 * Features:
 * - Webview Electron pour preview HTML/web apps
 * - Barre d'adresse avec navigation
 * - Refresh, back, forward buttons
 * - DevTools toggle
 */

import * as React from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { cn } from '../../lib/utils';

interface BrowserViewProps {
  initialUrl?: string;
  className?: string;
}

/**
 * Session partition for the preview guest — keeps arbitrary web content out of
 * the application's cookies, localStorage and granted permissions.
 *
 * Duplicated from `WEBVIEW_PARTITION` in `packages/main/src/security.ts` rather
 * than imported: renderer code cannot import from the main process bundle. The
 * main process forces this same value in `will-attach-webview`, so if the two
 * ever drift the main process wins and the guest is still isolated — the
 * mismatch costs a stale cache, not isolation.
 */
const WEBVIEW_PARTITION = 'persist:cortex-webview-preview';

/**
 * Les méthodes de navigation d'un <webview> Electron.
 *
 * `HTMLWebViewElement` (lib.dom) ne décrit que l'élément HTML : les méthodes
 * ci-dessous sont ajoutées par Electron et absentes des types DOM, d'où cette
 * déclaration locale plutôt qu'un `any` sur la ref.
 */
interface ElectronWebView extends HTMLElement {
  src: string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  loadURL(url: string): Promise<void>;
  openDevTools(): void;
  closeDevTools(): void;
  isDevToolsOpened(): boolean;
}

/** Payload de `did-navigate` / `did-navigate-in-page`. */
interface WebViewNavigateEvent extends Event {
  url: string;
}

/** Payload de `did-fail-load`. */
interface WebViewFailLoadEvent extends Event {
  errorCode: number;
  errorDescription: string;
  validatedURL?: string;
}

export function BrowserView({ initialUrl = 'about:blank', className }: BrowserViewProps) {
  // Single source of truth for the address bar. A parallel `currentUrl` state
  // used to be set from the same events and never read.
  const [url, setUrl] = React.useState(initialUrl);
  const [loading, setLoading] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [canGoForward, setCanGoForward] = React.useState(false);
  const [showDevTools, setShowDevTools] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const webviewRef = React.useRef<ElectronWebView>(null);

  // Gérer les événements webview
  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    // Navigation
    const handleDidNavigate = (event: Event) => {
      setUrl((event as WebViewNavigateEvent).url);
      setLoading(false);
    };

    const handleDidStartLoading = () => {
      setLoading(true);
      setError(null);
    };

    const handleDidStopLoading = () => {
      setLoading(false);

      // `canGoBack`/`canGoForward` are methods: testing them without calling
      // was always truthy, so both nav buttons stayed enabled and never
      // reflected real history. They are also called (not just checked) so the
      // state can go back to false.
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleDidFailLoad = (event: Event) => {
      const { errorCode, errorDescription } = event as WebViewFailLoadEvent;
      setLoading(false);
      if (errorCode !== -3) { // Ignore aborted
        setError(`Failed to load: ${errorDescription}`);
      }
    };

    // Attacher les listeners
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, []);

  // Naviguer vers une URL
  const handleNavigate = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    let targetUrl = url.trim();
    if (!targetUrl) return;

    // Ajouter le protocole si manquant
    if (!targetUrl.match(/^https?:\/\//i) && !targetUrl.startsWith('file://')) {
      if (targetUrl.startsWith('localhost') || targetUrl.match(/^\d+\.\d+\.\d+\.\d+/)) {
        targetUrl = `http://${targetUrl}`;
      } else {
        targetUrl = `https://${targetUrl}`;
      }
    }

    setError(null);
    webview.loadURL(targetUrl);
  };

  // Recharger
  const handleReload = () => {
    const webview = webviewRef.current;
    if (!webview) return;
    webview.reload();
  };

  // Retour
  const handleGoBack = () => {
    const webview = webviewRef.current;
    if (!webview || !webview.canGoBack()) return;
    webview.goBack();
    setCanGoBack(webview.canGoBack());
  };

  // Avancer
  const handleGoForward = () => {
    const webview = webviewRef.current;
    if (!webview || !webview.canGoForward()) return;
    webview.goForward();
    setCanGoForward(webview.canGoForward());
  };

  // Toggle DevTools
  const handleToggleDevTools = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    if (showDevTools) {
      webview.closeDevTools();
    } else {
      webview.openDevTools();
    }
    setShowDevTools(!showDevTools);
  };

  // Home
  const handleHome = () => {
    setUrl('about:blank');
    const webview = webviewRef.current;
    if (!webview) return;
    webview.loadURL('about:blank');
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Browser</h2>
          {loading && <Spinner className="w-3 h-3" />}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleDevTools}
            title="Toggle DevTools"
          >
            <DevToolsIcon />
          </Button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-wash">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleGoBack}
          disabled={!canGoBack}
          title="Back"
        >
          <BackIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleGoForward}
          disabled={!canGoForward}
          title="Forward"
        >
          <ForwardIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleReload}
          title="Reload"
        >
          <ReloadIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleHome}
          title="Home"
        >
          <HomeIcon />
        </Button>

        <div className="flex-1 flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNavigate();
            }}
            placeholder="Enter URL or localhost:3000"
            className="flex-1 h-8 text-sm font-mono"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleNavigate}
          >
            Go
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-soft text-red text-xs border-b border-red/20">
          {error}
        </div>
      )}

      {/* Webview Container */}
      <div className="flex-1 relative overflow-hidden">
        <webview
          // React types <webview> as HTMLWebViewElement, which lacks Electron's
          // navigation methods; the ref is bridged to that declared type here.
          ref={webviewRef as unknown as React.Ref<HTMLWebViewElement>}
          src={initialUrl}
          className="w-full h-full"
          style={{ display: 'flex' }}
          // Security attributes are deliberately minimal here.
          //
          // On a <webview> a boolean attribute is enabled by *presence*, not by
          // value: `nodeintegration="false"` turned Node integration ON in the
          // guest. So the dangerous flags are not written at all rather than
          // written as "false" — `nodeintegration`,
          // `nodeintegrationinsubframes`, `disablewebsecurity` and `allowpopups`
          // are all absent on purpose. `allowpopups` used to be set; it let the
          // guest call window.open, and every such window was denied by the main
          // process anyway (setWindowOpenHandler), so it only widened surface.
          //
          // Nothing here is load-bearing. `will-attach-webview` in
          // packages/main/src/security.ts overwrites this guest's webPreferences
          // at attach time, so an unsafe attribute added to this element cannot
          // take effect. The attributes below match what the main process
          // forces, so the two descriptions agree.
          partition={WEBVIEW_PARTITION}
          webpreferences="contextIsolation=yes,sandbox=yes,nodeIntegration=no,webSecurity=yes"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Custom webview element type for TypeScript
// ============================================================================

declare global {
  // `webview` is already declared by React's own JSX types
  // (`WebViewHTMLAttributes`), so redeclaring it here conflicted rather than
  // extended. Only the Electron-specific methods below need augmenting.

  interface HTMLWebViewElement extends HTMLElement {
    loadURL(url: string): void;
    reload(): void;
    goBack(): void;
    goForward(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    openDevTools(): void;
    closeDevTools(): void;
  }
}

// ============================================================================
// Icons
// ============================================================================

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 4L6 8l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M13 8a5 5 0 11-1.5-3.5M13 3v3h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 6l6-4 6 4v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 13V9h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DevToolsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5 6L2 8l3 2M11 6l3 2-3 2M9 3l-2 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
