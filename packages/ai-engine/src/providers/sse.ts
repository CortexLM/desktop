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

export interface SSEStreamChunk {
  content: string;
  done: boolean;
}

/** Chunk brut au format OpenAI `chat.completion.chunk`. */
export interface OpenAICompatibleChunk {
  choices?: Array<{
    delta?: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
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
  let buffer = '';
  let completed = false;

  /** Parse les lignes disponibles et émet les chunks correspondants. */
  function* drain(lines: string[]): Generator<SSEStreamChunk> {
    for (const line of lines) {
      const payload = parseSSELine(line);
      if (payload === undefined || payload === '') continue;

      if (isSSEDoneMarker(payload)) {
        completed = true;
        return;
      }

      let parsed: OpenAICompatibleChunk;
      try {
        parsed = JSON.parse(payload) as OpenAICompatibleChunk;
      } catch {
        // Ligne mal formée : on l'ignore plutôt que de casser tout le flux
        continue;
      }

      const chunk = toStreamChunk(parsed);
      if (chunk.content || chunk.done) {
        yield chunk;
      }
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
        if (trailing) {
          yield* drain([trailing]);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = splitSSELines(buffer);
      buffer = rest;

      yield* drain(lines);
    }

    // Garantit un chunk terminal pour les consommateurs qui attendent `done`
    if (completed) {
      yield { content: '', done: true };
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
