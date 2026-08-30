/**
 * Chrome actions shared by the title bar and the workspace shell.
 *
 * Optional: TitleBar still renders in isolation (its own tests, no router).
 * App wraps the tree with `ChromeShell` so the product switcher, sidebar
 * collapse, search and notifications have somewhere to go.
 */

import { createContext, createSignal, onMount, useContext, type JSX } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';

import type { Product } from '../routes.ts';
import { productForPath, productHome } from '../routes.ts';
import { hasElectronHost } from '../state/electron-bridge.ts';
import { readWelcomeSeen } from '../screens/welcome/welcome-screen.tsx';
import { openOverlay } from './overlay-host.tsx';

export interface ChromeContextValue {
  product: () => Product;
  setProduct: (product: Product) => void;
  sidebarHidden: () => boolean;
  toggleSidebar: () => void;
  goBack: () => void;
  goForward: () => void;
  openSearch: () => void;
  openNotifications: () => void;
  openBot: () => void;
}

const ChromeContext = createContext<ChromeContextValue>();

export function useChrome(): ChromeContextValue | undefined {
  return useContext(ChromeContext);
}

export function ChromeProvider(props: {
  value: ChromeContextValue;
  children: JSX.Element;
}): JSX.Element {
  return <ChromeContext.Provider value={props.value}>{props.children}</ChromeContext.Provider>;
}

export function ChromeShell(props: { children: JSX.Element }): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarHidden, setSidebarHidden] = createSignal(false);

  onMount(() => {
    if (!hasElectronHost() || readWelcomeSeen()) return;
    const path = location.pathname;
    if (path === '/welcome' || path.startsWith('/sign-in') || path.startsWith('/onboarding')) {
      return;
    }
    navigate('/welcome', { replace: true });
  });

  const value: ChromeContextValue = {
    product: () => productForPath(location.pathname),
    setProduct: (product) => navigate(productHome(product)),
    sidebarHidden,
    toggleSidebar: () => setSidebarHidden((hidden) => !hidden),
    goBack: () => window.history.back(),
    goForward: () => window.history.forward(),
    openSearch: () => openOverlay('palette'),
    openNotifications: () => openOverlay('notifications'),
    openBot: () => navigate('/bot'),
  };

  return <ChromeContext.Provider value={value}>{props.children}</ChromeContext.Provider>;
}
