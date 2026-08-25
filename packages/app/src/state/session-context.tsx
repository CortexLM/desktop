import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
  type Resource,
} from 'solid-js';

import {
  annotateCatalogue,
  capabilitiesFor,
  CortexApiClient,
  type Capabilities,
  type CortexModel,
  type CortexUser,
  type ModelAvailability,
  type RuntimeKind,
} from '@cortex-ide/cortex-api';

/**
 * The account state every screen reads from.
 *
 * There is one deliberate asymmetry here: the model catalogue loads whether or not anyone
 * is signed in, because `/v1/models` is public. That is what lets a signed-out picker show
 * the real Cortex models marked locked instead of an empty list, which is a far better
 * explanation of what an account buys than a disabled control with no contents.
 */
export interface AccountContextValue {
  user: Accessor<CortexUser | null>;
  capabilities: Accessor<Capabilities>;
  /** The Cortex catalogue. Loads signed out as well as signed in. */
  models: Resource<CortexModel[]>;
  /** The catalogue annotated with why each entry can or cannot be selected. */
  catalogue: Accessor<ModelAvailability[]>;
  /** Runtimes the picker should offer, given the current capabilities. */
  runtimes: Accessor<readonly RuntimeKind[]>;
  signIn: (user: CortexUser) => void;
  signOut: () => void;
  client: CortexApiClient;
}

const AccountContext = createContext<AccountContextValue>();

export interface AccountProviderProps {
  children: JSX.Element;
  /** Injected in tests and by the Electron host, which supplies a preconfigured client. */
  client?: CortexApiClient;
  /** A session restored from disk on launch. */
  initialUser?: CortexUser | null;
}

export function AccountProvider(props: AccountProviderProps): JSX.Element {
  const client = props.client ?? new CortexApiClient();
  const [user, setUser] = createSignal<CortexUser | null>(props.initialUser ?? null);

  const capabilities = createMemo(() => capabilitiesFor(user() !== null));

  const [models] = createResource(
    async () => {
      try {
        return await client.listModels();
      } catch {
        // A catalogue that cannot load must not take the app down with it. The picker falls
        // back to whatever BYO provider models are configured locally, which is exactly the
        // anonymous path.
        return [];
      }
    },
    { initialValue: [] },
  );

  const catalogue = createMemo(() => annotateCatalogue(models() ?? [], capabilities()));

  return (
    <AccountContext.Provider
      value={{
        user,
        capabilities,
        models,
        catalogue,
        runtimes: () => capabilities().runtimes,
        signIn: (next) => setUser(next),
        signOut: () => {
          setUser(null);
          client.clearCredentials();
        },
        client,
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
