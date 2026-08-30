import { mascots } from '../state/bots.ts';

export function mascotIdFromPath(pathname: string): string | undefined {
  const match = /^\/bot\/([^/]+)/.exec(pathname);
  if (!match) return undefined;
  const id = match[1];
  if (id === 'new' || id === 'approvals') return undefined;
  return id;
}

export function openBotStudio(
  panel: 'routines' | 'memory' | 'approvals',
  pathname: string,
  navigate: (path: string) => void,
): void {
  if (panel === 'approvals') {
    navigate('/bot/approvals');
    return;
  }
  const id = mascotIdFromPath(pathname) ?? mascots()[0]?.id;
  if (!id) {
    navigate('/bot');
    return;
  }
  navigate(`/bot/${id}/${panel}`);
}

export function rosterForSidebar(): { id: string; name: string; unread?: boolean }[] {
  return mascots().map((mascot) => ({
    id: mascot.id,
    name: mascot.name,
    unread: mascot.unread,
  }));
}
