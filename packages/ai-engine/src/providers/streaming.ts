/**
 * Lecture de flux « JSON lines » (un objet JSON par ligne).
 *
 * Utilisé par les providers qui ne parlent pas SSE (Ollama). Le découpage de
 * lignes est délégué à `splitSSELines` (cf. `sse.ts`) afin de n'avoir qu'une
 * seule implémentation de la bufferisation CRLF/partielle.
 */

import { splitSSELines } from './sse';

/**
 * Découpe un `ReadableStream` en lignes complètes.
 *
 * Le décodage est incrémental (`stream: true`) pour gérer les caractères
 * multi-octets coupés entre deux chunks réseau. Le reliquat est émis à la
 * fermeture du flux, et le reader est toujours libéré.
 */
export async function* readStreamLines(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush : octets retenus par le décodeur + dernière ligne sans `\n`
        const trailing = (buffer + decoder.decode()).trim();
        if (trailing) {
          yield trailing;
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = splitSSELines(buffer);
      buffer = rest;

      for (const line of lines) {
        yield line;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Flux déjà fermé
    }
    reader.releaseLock();
  }
}

/**
 * Parse une chaîne JSON en ignorant les erreurs.
 *
 * Les flux peuvent contenir des lignes tronquées ou des keep-alives : elles
 * sont ignorées plutôt que de faire échouer le stream entier.
 */
export function tryParseJSON<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
