import { type JSX } from 'solid-js';

import { Icon, Segmented } from '@cortex-ide/ui';

import { SHELL_PRODUCTS, type Product } from '../routes.ts';
import { useChrome, type ChromeContextValue } from './chrome-context.tsx';

/** Left cluster + Chat | Code. No-ops when ChromeShell is not mounted. */
export function TitleBarChrome(): JSX.Element | null {
  const chrome = useChrome();
  if (!chrome) return null;

  return (
    <div class="cx-titlebar__chrome">
      <ChromeButton label="Menu" icon="menu" onPress={chrome.openSearch} />
      <ChromeButton
        label={chrome.sidebarHidden() ? 'Show sidebar' : 'Hide sidebar'}
        icon="sidebarToggle"
        onPress={chrome.toggleSidebar}
      />
      <ChromeButton label="Search" icon="search" onPress={chrome.openSearch} />
      <ChromeButton label="Back" icon="back" onPress={chrome.goBack} />
      <button
        type="button"
        class="cx-titlebar__tool"
        aria-label="Forward"
        onClick={() => chrome.goForward()}
      >
        <span class="cx-titlebar__forward">
          <Icon name="back" size={13} strokeWidth={1.5} />
        </span>
      </button>
      <ProductSwitch chrome={chrome} />
      <span class="cx-titlebar__spacer" />
      <ChromeButton label="Notifications" icon="bell" onPress={chrome.openNotifications} />
    </div>
  );
}

function ProductSwitch(props: { chrome: ChromeContextValue }): JSX.Element {
  return (
    <Segmented
      class="cx-titlebar__products"
      label="Product"
      value={props.chrome.product()}
      onChange={(id) => props.chrome.setProduct(id as Product)}
      options={SHELL_PRODUCTS}
    />
  );
}

function ChromeButton(props: {
  label: string;
  icon: 'menu' | 'sidebarToggle' | 'search' | 'back' | 'bell';
  onPress: () => void;
}): JSX.Element {
  return (
    <button type="button" class="cx-titlebar__tool" aria-label={props.label} onClick={() => props.onPress()}>
      <Icon name={props.icon} size={15} strokeWidth={1.6} />
    </button>
  );
}
