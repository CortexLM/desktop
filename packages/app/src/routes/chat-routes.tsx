/**
 * The Chat product's routes: Home (the greeting + composer) and Conversation.
 *
 * The conversation store itself lives in `state/conversations-context.tsx`; these
 * routes project it onto the screens and own nothing but navigation.
 */

import { createMemo, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { useConversations } from '../state/conversations-context.tsx';
import { chatDraft, chatMode, resetChatDraft, setChatDraft, setChatMode } from '../state/chat-draft.ts';
import { ChatHomeScreen, type ChatApp } from '../screens/chat/chat-home-screen.tsx';
import { ConversationScreen } from '../screens/chat/conversation-screen.tsx';

/** "Good morning" / "Good afternoon" / "Good evening", by the local clock. */
export function greetingFor(hour: number, name?: string): string {
  const daypart = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return name ? `Good ${daypart}, ${name}.` : `Good ${daypart}.`;
}

/**
 * The apps row. Code is the working product; the rest are the roadmap, shown
 * locked with an honest reason rather than hidden or pretending to work.
 */
const CHAT_APPS: readonly ChatApp[] = [
  { id: 'code', title: 'Code', description: 'The Cortex agent working inside your repos.', icon: 'code' },
  { id: 'bot', title: 'Bot', description: 'A mascot with its own dedicated computer.', icon: 'bot' },
  { id: 'planning', title: 'Planning', description: 'Recurring jobs that run on a cadence.', icon: 'clock' },
  { id: 'projects', title: 'Projects', description: 'A brief and the sources that belong to it.', icon: 'folder' },
];

const SUGGESTIONS = [
  'Plan a 5-day trip to Tokyo',
  'Summarize this quarterly report',
  'Draft a launch announcement',
];

export function ChatHomeRoute(): JSX.Element {
  const account = useAccount();
  const chats = useConversations();
  const navigate = useNavigate();

  const greeting = createMemo(() => {
    const name = account.user()?.displayName?.split(/\s+/)[0];
    return greetingFor(new Date().getHours(), name);
  });

  const send = async () => {
    const text = chatDraft().trim();
    if (!text) return;
    const id = await chats.start(text, chatMode());
    if (!id) return;
    resetChatDraft();
    navigate(`/chat/${id}`);
  };

  return (
    <ChatHomeScreen
      greeting={greeting()}
      draft={chatDraft()}
      onDraftChange={setChatDraft}
      onSubmit={() => void send()}
      mode={chatMode()}
      onModeChange={setChatMode}
      modelLabel={chats.modelLabel()}
      apps={CHAT_APPS}
      onOpenApp={(id) => {
        if (id === 'code') navigate('/code');
        if (id === 'bot') navigate('/bot');
        if (id === 'planning') navigate('/planning');
        if (id === 'projects') navigate('/projects');
      }}
      suggestions={SUGGESTIONS}
      onPickSuggestion={(suggestion) => setChatDraft(suggestion)}
    />
  );
}

export function ConversationRoute(): JSX.Element {
  const params = useParams<{ conversationId: string }>();
  const chats = useConversations();

  return <ConversationScreen conversationId={() => params.conversationId} chats={chats} />;
}
