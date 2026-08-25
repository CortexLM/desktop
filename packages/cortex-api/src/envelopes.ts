/**
 * Unwrapping response envelopes whose shape was never observed.
 *
 * Some routes on this service could not be reached without credentials, so their
 * envelope is unknown. Rather than picking one and failing on the others with a
 * validation error, the list is pulled out of whichever wrapper is present — and the
 * raw value is returned unchanged when none is, so the schema still gets to reject
 * something genuinely wrong.
 */

/** Pulls a list out of a bare array, `{ data }` or `{ api_keys }`. */
export function unwrapList(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'object' && raw !== null) {
    const envelope = raw as { data?: unknown; api_keys?: unknown };
    if (Array.isArray(envelope.data)) return envelope.data;
    if (Array.isArray(envelope.api_keys)) return envelope.api_keys;
  }

  return raw;
}
