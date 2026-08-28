import { REALTIME_PATH } from './events.ts';

/** Turns an HTTP API base into the authenticated WebSocket URL. */
export function realtimeUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const prefix = url.pathname.replace(/\/+$/, '');
  url.pathname = `${prefix}${REALTIME_PATH}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
