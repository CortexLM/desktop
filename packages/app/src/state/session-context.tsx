import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
  type Resource,
} from 'solid-js';

import {
  annotateCatalogue,
  capabilitiesFor,
  type Capabilities,
  type CortexModel,
  type ModelAvailability,
  type RuntimeKind,
} from '@cortex-ide/cortex-api';
import type { CortexAccountState, CortexModelView, CortexUserView } from '@cortex-ide/shared';

import { resolveHost, type CortexHost } from './host.ts';

/**
 * The account state every screen reads from.
 *
 * There is one deliberate asymmetry here: the model catalogue loads whether or not anyone
 * is signed in, because `/v1/models` is public. That is what lets a signed-out picker show
 * the real Cortex models marked locked instead of an empty list, which is a far better
 * explanation of what an account buys than a disabled control with no contents.
 *
 * Everything reaches the API through `CortexHost`, never directly: the renderer's `file://`
 * origin makes its own requests fail the CORS check (see `host.ts`).
 */
export interface AccountContextValue {
  user: Accessor<CortexUserView | null>;
  capabilities: Accessor<Capabilities>;
  /**
   * Did the last call reach the API?
   *
   * Kept separate from `user() === null` on purpose: "signed out" and "offline" need
   * different copy, and collapsing them produces the screen that invites you to sign in
   * while the network is down.
   */
  reachable: Accessor<boolean>;
  /** The Cortex catalogue. Loads signed out as well as signed in. */
  models: Resource<CortexModel[]>;
  /** The catalogue annotated with why each entry can or cannot be selected. */
  catalogue: Accessor<ModelAvailability[]>;
  /** Runtimes the picker should offer, given the current capabilities. */
  runtimes: Accessor<readonly RuntimeKind[]>;
  signOut: () => Promise<void>;
  host: CortexHost;
}

const AccountContext = createContext<AccountContextValue>();

export interface AccountProviderProps {
  children: JSX.Element;
  /** Injected by the suites, which drive the screens without an Electron bridge. */
  host?: CortexHost;
}

/**
 * Adapts the IPC projection back to the catalogue shape `annotateCatalogue` expects.
 *
 * `CortexModelView` is deliberately narrower than `CortexModel` — main only forwards what
 * the renderer needs — so the gating flag has to be mapped back onto `locked`, which is the
 * field the capability rules read.
 */
function toCatalogueEntry(model: CortexModelView): CortexModel {
  const entry: CortexModel = {
    id: model.id,
    object: 'model',
    locked: model.requiresAccount,
  };
  if (model.displayName) entry.display_name = model.displayName;
  return entry;
}

export function AccountProvider(props: AccountProviderProps): JSX.Element {
  const host = props.host ?? resolveHost();

  const [user, setUser] = createSignal<CortexUserView | null>(null);
  const [reachable, setReachable] = createSignal(true);

  const applyState = (state: CortexAccountState) => {
    setUser(state.user);
    setReachable(state.reachable);
  };

  const capabilities = createMemo(() => capabilitiesFor(user() !== null));

  const [models] = createResource(
    async () => {
      const result = await host.listModels();
      // A catalogue that cannot load must not take the app down with it. The picker falls
      // back to whatever BYO provider models are configured locally, which is exactly the
      // anonymous path.
      if (result.error) setReachable(false);
      return result.models.map(toCatalogueEntry);
    },
    { initialValue: [] },
  );

  onMount(() => {
    // The session is restored in main and verified against the API, so the answer can arrive
    // after the first paint. The UI starts anonymous and is corrected here.
    void host.getState().then(applyState).catch(() => setReachable(false));

    // A second window, or a device flow completing, changes the session for the whole
    // process — so the state is pushed rather than polled.
    onCleanup(host.onAccountChanged(applyState));
  });

  const catalogue = createMemo(() => annotateCatalogue(models() ?? [], capabilities()));

  return (
    <AccountContext.Provider
      value={{
        user,
        capabilities,
        reachable,
        models,
        catalogue,
        runtimes: () => capabilities().runtimes,
        signOut: async () => {
          applyState(await host.signOut());
        },
        host,
      }}
    >
      {props.children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount must be used inside an AccountProvider');
  return context;
}

/** Shorthand for the common case of gating a control. */
export function useCapabilities(): Accessor<Capabilities> {
  return useAccount().capabilities;
}
