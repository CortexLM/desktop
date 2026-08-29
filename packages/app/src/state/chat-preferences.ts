/**
 * Chat preferences, held on the account.
 *
 * These were two `localStorage` booleans written straight from the route. For a
 * checkbox that only affects this tab's rendering that would be defensible, but
 * these two are not that: "Notify on mentions" governs whether the *service* sends
 * a notification, so a per-browser copy is a setting the sender never reads.
 *
 * `saving` and `saveError` are separate from the load state because the two
 * failures need different copy: "we could not read your preferences" and "that
 * toggle did not save" are different, and a toggle that flips back without saying
 * why is the worst version of either.
 */

import { createSignal } from 'solid-js';

import { getChatPreferences, putChatPreferences } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { isRouteMissing } from './surface-error.ts';

export interface ChatPreferences {
  streamReplies: boolean;
  notifyOnMentions: boolean;
}

/**
 * What the UI shows before the account answers.
 *
 * Streaming on and mention notifications on: these are the defaults the product
 * ships, so a first paint that matches them is not a guess about this account, it
 * is the same thing a new account would get.
 */
export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  streamReplies: true,
  notifyOnMentions: true,
};

const [preferences, setPreferences] = createSignal<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);
const [editable, setEditable] = createSignal(false);
const [saveError, setSaveError] = createSignal('');

export { preferences as chatPreferences, editable as preferencesEditable, saveError as preferencesError };

export async function loadChatPreferences(): Promise<void> {
  const client = botClient();
  if (!client) {
    setEditable(false);
    setSaveError('');
    return;
  }

  try {
    const row = await getChatPreferences(client);
    setPreferences({
      streamReplies: row.stream_replies ?? DEFAULT_CHAT_PREFERENCES.streamReplies,
      notifyOnMentions: row.notify_on_mentions ?? DEFAULT_CHAT_PREFERENCES.notifyOnMentions,
    });
    setEditable(true);
    setSaveError('');
  } catch (error) {
    // Not editable rather than silently local: a control the user can move but
    // that saves nowhere is worse than one that is visibly unavailable.
    setEditable(false);
    setSaveError(
      isRouteMissing(error)
        ? 'This Cortex backend does not store Chat preferences yet.'
        : error instanceof Error
          ? error.message
          : String(error),
    );
  }
}

/**
 * Saves one preference.
 *
 * Sends only the field that changed: sending both on every toggle would let one
 * tab overwrite what another just set.
 */
export async function saveChatPreference(patch: Partial<ChatPreferences>): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Chat preferences need a connection to Cortex.');

  const previous = preferences();
  setPreferences({ ...previous, ...patch });
  try {
    await putChatPreferences(client, {
      ...(patch.streamReplies === undefined ? {} : { stream_replies: patch.streamReplies }),
      ...(patch.notifyOnMentions === undefined ? {} : { notify_on_mentions: patch.notifyOnMentions }),
    });
    setSaveError('');
  } catch (error) {
    // Put the toggle back where it was. Leaving it moved would show a preference
    // the account does not have.
    setPreferences(previous);
    setSaveError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export function resetChatPreferencesForTests(): void {
  setPreferences(DEFAULT_CHAT_PREFERENCES);
  setEditable(false);
  setSaveError('');
}
