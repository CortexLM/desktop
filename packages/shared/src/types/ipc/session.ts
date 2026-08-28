/**
 * IPC Types — sessions (« runs »).
 *
 * ---------------------------------------------------------------------------
 * Pourquoi un domaine distinct de `ai`
 * ---------------------------------------------------------------------------
 * `ai:*` transporte une conversation : créer une session, envoyer un message,
 * streamer des morceaux de texte. C'est ce dont un panneau de chat a besoin.
 *
 * Ce que le design demande est autre chose : une *exécution*. Elle a un état
 * (`queued`, `running`, `review`, `merged`, `failed`), un dépôt et une branche,
 * une statistique de diff, une durée, et une chronologie où les appels d'outils
 * sont des entrées de premier plan — pas du texte dans un message. L'inbox trie
 * et filtre là-dessus.
 *
 * Les deux coexistent : ce domaine s'appuie sur l'orchestrateur d'`ai` plutôt
 * que de le dupliquer (`AgentServer` mène déjà la boucle d'outils, les
 * permissions et les checkpoints). Il ajoute la persistance et la forme que le
 * renderer affiche.
 *
 * ---------------------------------------------------------------------------
 * Ce qui ne traverse pas
 * ---------------------------------------------------------------------------
 * Aucun chemin absolu du poste, aucune clé, aucun jeton. Le renderer identifie
 * un dépôt par son id (`owner/name` ou le nom du dossier), jamais par son chemin
 * disque — le chemin est une donnée du process main, et l'exposer ferait fuiter
 * l'arborescence de l'utilisateur dans un process qui rend du contenu.
 */

/** Où en est une exécution. Le vocabulaire est celui des badges du design. */
export type SessionStatus =
  /** Créée, en attente d'un tour d'agent. */
  | 'queued'
  | 'running'
  /** Terminée avec des changements à relire. */
  | 'review'
  | 'merged'
  | 'failed'
  /** Interrompue par l'utilisateur. */
  | 'stopped';

/** Où l'exécution a lieu. */
export type SessionRuntime = 'local' | 'cloud' | 'ssh';

/** Une ligne de l'inbox, ou de la liste « récentes » de Home. */
export interface SessionSummary {
  id: string;
  /** Le prompt d'origine. Sert de titre : c'est ce que l'utilisateur reconnaît. */
  title: string;
  status: SessionStatus;
  runtime: SessionRuntime;
  /** `owner/name`, ou le nom du dossier pour un dépôt local. */
  repo?: string;
  branch?: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  createdAt: number;
  updatedAt: number;
  /** Présent dès que le tour a commencé. */
  startedAt?: number;
  /** Absent tant que l'exécution tourne. */
  finishedAt?: number;
  archived: boolean;
  /** Renseigné quand `status` vaut `failed`. */
  error?: string;
  pullRequestUrl?: string;
}

/**
 * Une entrée de la chronologie.
 *
 * Discriminée par `kind` plutôt qu'un enregistrement à champs optionnels : un
 * appel d'outil et une réponse de l'agent n'ont presque aucun champ en commun,
 * et un type unique obligerait chaque lecteur à revérifier ce qui est défini.
 */
export type SessionEvent =
  | { kind: 'prompt'; at: number; text: string }
  | { kind: 'reply'; at: number; text: string }
  | { kind: 'thinking'; at: number; text: string }
  | {
      kind: 'tool';
      at: number;
      /** Nom de l'outil tel que l'agent l'a appelé, p. ex. `Edit`. */
      name: string;
      /** Résumé d'une ligne, prêt à afficher. */
      title: string;
      detail?: string;
      /** Absent tant que l'outil tourne. */
      ok?: boolean;
      output?: string;
      additions?: number;
      deletions?: number;
      durationMs?: number;
    }
  | { kind: 'plan'; at: number; steps: readonly SessionPlanStep[] }
  | {
      kind: 'permission';
      at: number;
      requestId: string;
      /** Ce que l'agent demande à faire, en clair. */
      summary: string;
      risk: 'safe' | 'caution' | 'dangerous';
      /** Renseigné une fois la décision prise. */
      decision?: 'allow-once' | 'allow-always' | 'deny';
    }
  | { kind: 'error'; at: number; message: string };

export interface SessionPlanStep {
  id: string;
  label: string;
  state: 'pending' | 'current' | 'done';
}

/** Un fichier modifié par l'exécution, avec son diff unifié. */
export interface SessionDiffFile {
  path: string;
  additions: number;
  deletions: number;
  /** Diff unifié brut. Le renderer le découpe pour l'affichage. */
  diff: string;
}

/** Tout ce qu'il faut pour peindre l'écran Session Detail. */
export interface SessionDetail extends SessionSummary {
  events: readonly SessionEvent[];
  files: readonly SessionDiffFile[];
  /** Le modèle qui a réellement mené l'exécution. */
  model?: string;
  provider?: string;
}

export interface ListSessionsRequest {
  /** Absent = toutes les sessions de l'espace de travail actif. */
  workspaceId?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
}

/**
 * Ce que le composer envoie pour lancer une exécution.
 *
 * `repo` est un identifiant, pas un chemin — cf. l'en-tête du module.
 */
export interface StartSessionRequest {
  prompt: string;
  runtime: SessionRuntime;
  repo?: string;
  branch?: string;
  model?: string;
}

export interface StartSessionResponse {
  session: SessionSummary;
}

export interface GetSessionRequest {
  id: string;
}

export interface GetSessionResponse {
  /** `null` quand l'id ne correspond à rien — un lien périmé, pas une erreur. */
  session: SessionDetail | null;
}

export interface FollowUpSessionRequest {
  id: string;
  prompt: string;
}

export interface SessionIdRequest {
  id: string;
}

export interface ArchiveSessionRequest {
  id: string;
  archived: boolean;
}

export interface ResolveSessionPermissionRequest {
  id: string;
  requestId: string;
  decision: 'allow-once' | 'allow-always' | 'deny';
}

/**
 * Poussé pendant qu'une exécution tourne.
 *
 * Le résumé accompagne l'événement pour que l'inbox n'ait pas à re-interroger à
 * chaque tick : un changement d'état modifie la ligne de la liste *et* la
 * chronologie, et deux allers-retours pour un seul fait les feraient divergent
 * le temps d'un rendu.
 */
export interface SessionProgressEvent {
  session: SessionSummary;
  /** Absent pour un simple changement d'état. */
  event?: SessionEvent;
}

/** Un dépôt que l'utilisateur peut choisir dans le composer. */
export interface RepositoryOption {
  /** `owner/name` si un remote le donne, sinon le nom du dossier. */
  id: string;
  name: string;
  /** La branche courante. */
  branch?: string;
  branches: readonly string[];
  /** Le dépôt a-t-il des changements non commités ? */
  dirty: boolean;
}

export interface ListRepositoriesResponse {
  repositories: RepositoryOption[];
}

/**
 * Le résultat de l'ouverture d'un dossier.
 *
 * `repositories` plutôt qu'un simple succès : après l'ouverture, le composer doit
 * afficher le nouveau dépôt, et le renvoyer ici évite un second aller-retour dont
 * le résultat serait garanti.
 *
 * `cancelled` distingue « l'utilisateur a fermé la boîte de dialogue » d'un échec.
 * Les confondre ferait afficher une erreur pour un geste normal.
 */
export interface OpenWorkspaceResponse {
  cancelled: boolean;
  repositories: RepositoryOption[];
}
