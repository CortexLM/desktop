import { For, type JSX } from 'solid-js';

import { Button } from '@cortex-ide/ui';

export interface MascotRailLink {
  id: string;
  label: string;
  onClick: () => void;
  current?: boolean;
}

export function MascotRail(props: { links: readonly MascotRailLink[] }): JSX.Element {
  return (
    <nav class="cx-mascot-rail" aria-label="Mascot">
      <For each={props.links}>
        {(link) => (
          <Button variant={link.current ? 'primary' : 'ghost'} onClick={() => link.onClick()}>
            {link.label}
          </Button>
        )}
      </For>
    </nav>
  );
}

export function mascotLinks(
  id: string,
  current: string,
  go: (path: string) => void,
): MascotRailLink[] {
  const rows: Array<{ id: string; label: string; path: string }> = [
    { id: 'chat', label: 'Conversation', path: `/bot/${id}` },
    // Messages was a registered, tested route that nothing linked to, which made it
    // reachable only by typing the URL.
    { id: 'messages', label: 'Messages', path: `/bot/${id}/messages` },
    { id: 'computer', label: 'Computer', path: `/bot/${id}/computer` },
    { id: 'memory', label: 'Memory', path: `/bot/${id}/memory` },
    { id: 'skills', label: 'Skills', path: `/bot/${id}/skills` },
    { id: 'routines', label: 'Routines', path: `/bot/${id}/routines` },
    { id: 'videos', label: 'Videos', path: `/bot/${id}/videos` },
    { id: 'groups', label: 'Groups', path: `/bot/${id}/groups` },
    { id: 'settings', label: 'Settings', path: `/bot/${id}/settings` },
  ];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    current: row.id === current,
    onClick: () => go(row.path),
  }));
}
