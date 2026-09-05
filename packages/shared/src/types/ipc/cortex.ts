/**
 * IPC Types — compte Cortex et catalogue de modèles.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi ce domaine existe : le renderer ne peut pas appeler l'API
 * ---------------------------------------------------------------------------
 * Le renderer est chargé depuis `file://` (cf. `main/src/index.ts`). Son origine
 * est donc opaque, et un `fetch('https://api.cortex.foundation/...')` échoue au
 * contrôle CORS avant même de partir — sans message exploitable côté UI. Ce
 * n'est pas une limite qu'on peut contourner en ajoutant un en-tête : c'est le
 * modèle d'origine du web appliqué à une page locale.
 *
 * Tous les appels à l'API passent donc par le process main, qui n'a pas
 * d'origine et pour qui la question ne se pose pas.
 *
 * ---------------------------------------------------------------------------
 * Invariant : le jeton d'accès ne traverse jamais vers le renderer
 * ---------------------------------------------------------------------------
 * Même asymétrie que pour les clés de providers (`settings.ts`), et pour la même
 * raison : le renderer est le process le moins fiable. Le flux d'appareil
 * (RFC 8628) est mené *dans main* du début à la fin — le renderer reçoit le code
 * utilisateur et l'URL de vérification, qui sont faits pour être affichés, puis
 * apprend le résultat par un événement. Il ne voit ni `access_token` ni
 * `device_code` (ce dernier est le secret échangeable contre un jeton).
 *
 * `CortexAccountState` n'a donc pas de champ jeton, et un test le vérifie.
 */

/** Un modèle du catalogue Cortex, tel qu'exposé au renderer. */
export interface CortexModelView {
  id: string;
  /** Nom lisible, quand l'API en fournit un. */
  displayName?: string;
  /** Le fournisseur en amont (`anthropic`, `openai`, …) quand il est connu. */
  provider?: string;
  /** L'accès à ce modèle exige-t-il un compte ? */
  requiresAccount: boolean;
}

/**
 * L'identité, telle que le renderer est autorisé à la voir.
 *
 * Aucun jeton. Ce sont les champs que la sidebar et l'écran de compte affichent.
 */
export interface CortexUserView {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  organizationId?: string;
}

/**
 * Tout ce dont le renderer a besoin pour décider quoi afficher.
 *
 * `reachable` est distingué de `user === null` volontairement : « déconnecté »
 * et « API injoignable » demandent deux messages différents, et les confondre
 * produit l'écran qui invite à se connecter alors que le réseau est coupé.
 */
export interface CortexAccountState {
  user: CortexUserView | null;
  /** Le dernier appel à l'API a-t-il abouti ? */
  reachable: boolean;
  /** Le jeton stocké est-il chiffré au repos ? Rendu visible, comme pour les providers. */
  credentialsEncrypted: boolean;
}

export type CortexAccountStateResponse = CortexAccountState;

/** Le catalogue. Public : il se charge déconnecté aussi bien que connecté. */
export interface CortexListModelsResponse {
  models: CortexModelView[];
  /** Absent en cas de succès. Sinon, de quoi expliquer l'échec dans l'UI. */
  error?: string;
}

/**
 * Ce que le renderer reçoit quand un flux d'appareil démarre.
 *
 * Pas de `deviceCode` : c'est le secret que main échange contre un jeton. Le
 * renderer n'a besoin que de ce qui s'affiche.
 */
export interface CortexDeviceStartResponse {
  /** Le code que l'utilisateur recopie, p. ex. `WDJB-MJHT`. */
  userCode: string;
  verificationUri: string;
  /** URL pré-remplie avec le code, quand l'API en fournit une. */
  verificationUriComplete?: string;
  /** Secondes avant expiration, pour le compte à rebours. */
  expiresIn: number;
}

/** L'avancement d'un flux d'appareil, poussé par main. */
export type CortexDeviceStatus =
  | { kind: 'pending' }
  /** L'utilisateur doit approuver plus vite que le rythme de sondage. */
  | { kind: 'slow-down' }
  | { kind: 'authorized'; user: CortexUserView }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export interface CortexDeviceStatusEvent {
  status: CortexDeviceStatus;
}

/**
 * Renderer → main product call. Path must be a Bot / plugins / skills route.
 * Main attaches the session cookie. The renderer never sees it.
 */
export interface CortexProductRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
}

export interface CortexProductResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

export interface CortexBrowserLoginRequest {
  provider: 'google' | 'github';
}

export interface CortexBrowserLoginResponse {
  opened: boolean;
}

/** In-app email form. Password crosses IPC once, never logged, never returned. */
export interface CortexEmailLoginRequest {
  email: string;
  password: string;
}

export interface CortexAuthCompleteEvent {
  ok: boolean;
  message?: string;
}
