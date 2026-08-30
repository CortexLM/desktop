import { type JSX } from 'solid-js';

/**
 * Chrome-less noVNC page from the farm. The URL is a capability (ticket hash
 * already bound server-side). Passwords never appear here.
 */
export function NovncFrame(props: { src: string }): JSX.Element {
  return (
    <iframe
      class="cx-vnc cx-vnc--live cx-vnc__frame"
      title="Live desktop"
      src={props.src}
      sandbox="allow-scripts allow-pointer-lock"
      allow="pointer-lock; clipboard-read; clipboard-write; fullscreen"
    />
  );
}
