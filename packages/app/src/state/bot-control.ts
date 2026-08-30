import { classifyBotError, type ComputerRuntime } from '@cortex-ide/cortex-api';

import { releaseComputerControl, runLifecycle, takeComputerControl } from './bot-actions.ts';

export async function runComputerControl(
  mascotId: string | undefined,
  action: 'take' | 'release',
  setError: (value: string) => void,
): Promise<void> {
  if (!mascotId) return;
  setError('');
  try {
    if (action === 'take') await takeComputerControl(mascotId);
    else await releaseComputerControl(mascotId);
  } catch (caught) {
    setError(classifyBotError(caught).message);
  }
}

export async function pickComputerRuntime(
  mascotId: string | undefined,
  runtime: ComputerRuntime,
  setError: (value: string) => void,
): Promise<void> {
  if (!mascotId) return;
  setError('');
  try {
    await runLifecycle(mascotId, 'resume', runtime);
  } catch (caught) {
    setError(classifyBotError(caught).message);
  }
}
