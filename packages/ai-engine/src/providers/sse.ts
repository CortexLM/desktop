/**
 * Parsing SSE (Server-Sent Events) partagé pour les providers compatibles
 * OpenAI (Grok, OpenRouter, OpenAI, ...).
 *
 * Corrige les problèmes de l'implémentation dupliquée précédente :
 * - le buffer restant en fin de flux était perdu (dernier chunk tronqué si le
 *   flux ne terminait pas par un `\n`)
 * - `\r\n` (CRLF) laissait un `\r` collé au JSON
 * - seul `data: ` (avec espace) était reconnu, pas `data:`
 * - `finish_reason` absent (`undefined`) était traité comme "terminé", coupant
 *   le flux au premier chunk de certains providers
 * - le reader n'était jamais libéré/annulé en cas d'erreur ou d'abandon
 */

import type { ProviderToolCall } from './base';

/**
 * Décode les arguments d'un appel d'outil.
 *
 * Les arguments arrivent en JSON sérialisé, et un modèle produit parfois du JSON
 * invalide. On préfère un appel dont les arguments sont vides à une exception qui
 * ferait échouer tout le tour : la boucle peut alors répondre à l'outil que sa
 * saisie était illisible, ce qui donne au modèle une chance de se corriger.
 *
 * Défini ici et non dans le provider : `sse.ts` ne doit rien importer de lui, ou
 * les deux modules forment un cycle qui ne tient que par le hoisting.
 */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export interface SSEStreamChunk {
  content: string;
  done: boolean;
  /**
   * Appels d'outils complets, émis uniquement sur le chunk terminal.
   *
   * Ils ne peuvent pas être émis au fil de l'eau : les arguments arrivent en
   * fragments de JSON, et un fragment n'est pas exploitable tant que l'appel
   * n'est pas complet.
   */
  toolCalls?: ProviderToolCall[];
}

/** Fragment d'appel d'outil dans un delta de streaming. */
export interface OpenAIToolCallDelta {
  /**
   * Position de l'appel dans la liste. C'est la seule clé fiable : `id` et
   * `name` n'arrivent que sur le premier fragment de chaque appel.
   */
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

/** Chunk brut au format OpenAI `chat.completion.chunk`. */
export interface OpenAICompatibleChunk {
  choices?: Array<{
    delta?: {
      role?: string;
      content?: string | null;
      tool_calls?: OpenAIToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
}

/**
 * Accumulateur d'appels d'outils sur un flux.
 *
 * Les fragments d'arguments doivent être concaténés par index : un appel arrive
 * comme `{"pa`, `th": "/t`, `mp"}` réparti sur plusieurs chunks. Parser chaque
 * fragment produit du JSON invalide, et les indexer par `id` échoue parce que
 * l'`id` n'est présent que sur le premier fragment.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, { id: string; name: string; args: string }>();

  add(deltas: OpenAIToolCallDelta[] | undefined): void {
    for (const delta of deltas ?? []) {
      const existing = this.calls.get(delta.index) ?? { id: '', name: '', args: '' };

      this.calls.set(delta.index, {
        id: delta.id ?? existing.id,
        name: delta.function?.name ?? existing.name,
        args: existing.args + (delta.function?.arguments ?? ''),
      });
    }
  }

  get size(): number {
    return this.calls.size;
  }

  /** Les appels terminés, dans l'ordre de leur index. */
  toToolCalls(): ProviderToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        // Un provider qui n'émet jamais d'`id` reste appariable : l'index est
        // stable sur la durée du flux, donc il fait un identifiant valide.
        id: call.id || `call_${index}`,
        name: call.name,
        arguments: parseToolArguments(call.args),
      }));
  }
}

/**
 * Découpe un buffer SSE en lignes complètes.
 * @returns les lignes complètes et le reste (ligne partielle) à conserver
 */
export function splitSSELines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n');
  // La dernière part peut être incomplète : on la garde pour le prochain read()
  const rest = parts.pop() ?? '';

  return {
    // Retire le \r de fin pour supporter les flux CRLF
    lines: parts.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line)),
    rest,
  };
}

/**
 * Extrait le payload d'une ligne SSE `data:`.
 * @returns le payload, ou `undefined` si la ligne n'est pas un événement data
 *   (commentaire `:`, champ `event:`, ligne vide, ...)
 */
export function parseSSELine(line: string): string | undefined {
  if (!line.startsWith('data:')) return undefined;

  // Supporte `data: {...}` comme `data:{...}`
  return line.slice(5).trim();
}

/** Marqueur de fin de flux OpenAI. */
export function isSSEDoneMarker(payload: string): boolean {
  return payload === '[DONE]';
}

/**
 * Convertit un chunk OpenAI-compatible en `SSEStreamChunk`.
 *
 * Distingue explicitement `finish_reason: null` (chunk intermédiaire) de
 * l'absence de champ : l'ancien test `!== null` renvoyait `done: true` dès que
 * `finish_reason` était absent, ce qui terminait le flux prématurément.
 */
export function toStreamChunk(parsed: OpenAICompatibleChunk): SSEStreamChunk {
  const choice = parsed.choices?.[0];
  const content = choice?.delta?.content ?? '';
  // done seulement si finish_reason est présent ET non-null
  const done = choice?.finish_reason != null;

  return { content, done };
}

/**
 * Traite une ligne SSE, en alimentant l'accumulateur d'outils au passage.
 *
 * `null` signale le marqueur de fin ; `undefined` signale une ligne sans rien à
 * émettre (commentaire, chunk vide, JSON illisible).
 */
function handleSSELine(
  line: string,
  tools: ToolCallAccumulator,
): SSEStreamChunk | null | undefined {
  const payload = parseSSELine(line);
  if (payload === undefined || payload === '') return undefined;
  if (isSSEDoneMarker(payload)) return null;

  const parsed = parseChunkPayload(payload);
  if (!parsed) return undefined;

  tools.add(parsed.choices?.[0]?.delta?.tool_calls);
  return toEmittableChunk(parsed, tools);
}

/** `undefined` sur une ligne mal formée : on l'ignore plutôt que casser le flux. */
function parseChunkPayload(payload: string): OpenAICompatibleChunk | undefined {
  try {
    return JSON.parse(payload) as OpenAICompatibleChunk;
  } catch {
    return undefined;
  }
}

/** Le chunk à émettre, ou rien quand il n'apporte ni texte ni fin de flux. */
function toEmittableChunk(
  parsed: OpenAICompatibleChunk,
  tools: ToolCallAccumulator,
): SSEStreamChunk | undefined {
  const chunk = toStreamChunk(parsed);

  if (chunk.done && tools.size > 0) {
    return { ...chunk, toolCalls: tools.toToolCalls() };
  }

  return chunk.content || chunk.done ? chunk : undefined;
}

/**
 * Parse un flux SSE OpenAI-compatible en chunks.
 *
 * Le reader est toujours libéré (et le flux annulé si on sort avant la fin),
 * y compris si le consommateur abandonne l'itération (`break`/`return`), ce
 * qui évite de laisser une connexion HTTP et son buffer ouverts.
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncIterableIterator<SSEStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const tools = new ToolCallAccumulator();
  let buffer = '';
  let completed = false;

  /** Parse les lignes disponibles et émet les chunks correspondants. */
  function* drain(lines: string[]): Generator<SSEStreamChunk> {
    for (const line of lines) {
      const chunk = handleSSELine(line, tools);
      if (chunk === null) {
        completed = true;
        return;
      }
      if (chunk !== undefined) yield chunk;
    }
  }

  try {
    while (!completed) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush : le décodeur peut retenir des octets d'un caractère multi-byte,
        // et le buffer peut contenir une dernière ligne sans `\n` final.
        buffer += decoder.decode();
        const trailing = buffer.trim();
        if (trailing) yield* drain([trailing]);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = splitSSELines(buffer);
      buffer = rest;

      yield* drain(lines);
    }

    // Garantit un chunk terminal pour les consommateurs qui attendent `done`.
    // Les appels d'outils y sont joints : certains providers envoient `[DONE]`
    // sans jamais émettre de `finish_reason`, et sans cela les appels accumulés
    // seraient perdus au moment même où ils deviennent exploitables.
    if (completed) {
      yield {
        content: '',
        done: true,
        toolCalls: tools.size > 0 ? tools.toToolCalls() : undefined,
      };
    }
  } finally {
    // Libère systématiquement la connexion, y compris si le consommateur
    // interrompt l'itération.
    try {
      await reader.cancel();
    } catch {
      // Flux déjà fermé
    }
    reader.releaseLock();
  }
}
