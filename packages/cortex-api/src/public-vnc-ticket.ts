/**
 * A VNC signalling ticket as the renderer may hold it: a hash, and optionally a
 * stream URL the farm already minted. Passwords never leave this module.
 */

export interface VncTicket {
  ticket_hash: string;
  stream_url?: string;
}

const STREAM_KEYS = ['stream_url', 'novnc_url', 'embed_url', 'url'] as const;
const SECRET_QUERY = new Set(['password', 'passwd', 'vnc_password', 'token', 'secret']);

/** Keep the hash and a safe stream URL; drop every password-shaped field. */
export function publicVncTicket(raw: Record<string, unknown>): VncTicket {
  const ticket: VncTicket = { ticket_hash: String(raw.ticket_hash ?? '') };
  const stream = pickStreamUrl(raw);
  if (stream) ticket.stream_url = stream;
  return ticket;
}

export function pickStreamUrl(raw: Record<string, unknown>): string | undefined {
  for (const key of STREAM_KEYS) {
    const cleaned = sanitizeStreamUrl(raw[key]);
    if (cleaned) return cleaned;
  }
  return undefined;
}

/** http(s) or a same-origin /novnc path. Never javascript:, never a password query. */
export function sanitizeStreamUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return stripSecretQuery(trimmed);
  }
  return sanitizeAbsoluteStream(trimmed);
}

function sanitizeAbsoluteStream(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol)) return undefined;
    const drop: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (SECRET_QUERY.has(key.toLowerCase())) drop.push(key);
    });
    for (const key of drop) url.searchParams.delete(key);
    url.hash = '';
    if (url.protocol === 'ws:' || url.protocol === 'wss:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stripSecretQuery(path: string): string {
  const queryAt = path.indexOf('?');
  if (queryAt < 0) return path;
  const params = new URLSearchParams(path.slice(queryAt + 1));
  const drop: string[] = [];
  params.forEach((_, key) => {
    if (SECRET_QUERY.has(key.toLowerCase())) drop.push(key);
  });
  for (const key of drop) params.delete(key);
  const query = params.toString();
  return query ? `${path.slice(0, queryAt)}?${query}` : path.slice(0, queryAt);
}
