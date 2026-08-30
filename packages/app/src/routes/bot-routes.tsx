import { createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { removeMascot, updateMascot } from '../state/bots.ts';
import { teachFromVideo } from '../state/bot-runtime-store.ts';
import { BotMessagesScreen, BotVideosScreen } from '../screens/bot/mascot-detail-screens.tsx';
import { BotSettingsScreen } from '../screens/bot/mascot-settings-screen.tsx';
import type { MascotFace, MascotLook } from '../state/bot-map.ts';
import { useBotMascot } from './bot-mascot.ts';

export { BotHomeRoute, BotCreateRoute } from './bot-home-route.tsx';
export { BotConversationRoute } from './bot-conversation-route.tsx';
export { BotComputerRoute } from './bot-computer-route.tsx';

export {
  BotGroupsRoute,
  BotMemoryRoute,
  BotRoutinesRoute,
  BotSkillsRoute,
} from './bot-runtime-routes.tsx';

export function BotMessagesRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotMessagesScreen mascot={useBotMascot()()} onBack={() => navigate('/bot')} onGo={(path) => navigate(path)} />;
}

export function BotVideosRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  return (
    <BotVideosScreen
      mascot={mascot()}
      onTeach={(videoId) => {
        const current = mascot();
        if (current) void teachFromVideo(current.id, videoId);
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

export function BotSettingsRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  return (
    <BotSettingsScreen
      mascot={mascot()}
      error={error()}
      saving={saving()}
      onRename={(name) => applyPatch(mascot()?.id, { name }, setError, setSaving)}
      onLook={(look) => applyPatch(mascot()?.id, { look }, setError, setSaving)}
      onFace={(face) => applyPatch(mascot()?.id, { face }, setError, setSaving)}
      onDelete={() => void deleteAndLeave(mascot()?.id, navigate, setError)}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

function applyPatch(
  id: string | undefined,
  patch: { name?: string; look?: MascotLook; face?: MascotFace },
  setError: (value: string) => void,
  setSaving: (value: boolean) => void,
): void {
  if (!id) return;
  setSaving(true);
  setError('');
  void updateMascot(id, patch)
    .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
    .finally(() => setSaving(false));
}

async function deleteAndLeave(
  id: string | undefined,
  navigate: (path: string) => void,
  setError: (value: string) => void,
): Promise<void> {
  if (!id) return;
  try {
    await removeMascot(id);
    navigate('/bot');
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : String(caught));
  }
}
