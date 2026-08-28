/**
 * The Chat composer's draft, at module scope.
 *
 * Same reasoning as the Code composer's draft: a signal owned by the route is
 * disposed the moment you navigate away, which silently empties the box on the
 * way back. Not persisted to disk — a half-typed question is not state worth
 * outliving the app.
 */

import { createSignal } from 'solid-js';

import type { ChatMode } from '../screens/chat/chat-home-screen.tsx';

const [chatDraft, setChatDraft] = createSignal('');
const [chatMode, setChatMode] = createSignal<ChatMode>('search');

export { chatDraft, setChatDraft, chatMode, setChatMode };

export function resetChatDraft(): void {
  setChatDraft('');
}
