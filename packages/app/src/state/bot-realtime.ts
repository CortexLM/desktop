/**
 * Apply Bot agent-turn events onto the in-memory mascot. Never writes
 * localStorage — reconcile() is the only cache writer.
 */

import type { RealtimeEvent } from '@cortex-ide/cortex-api';

import { hydrateMascot, patchMascotState } from './bots.ts';
import { mapMessage, type BotMessageKind } from './bot-map.ts';

const TURN_KINDS: Record<string, BotMessageKind> = {
  send_to_user: 'send_to_user',
  'bot.send_to_user': 'send_to_user',
  ask_user: 'ask_user',
  'bot.ask_user': 'ask_user',
  tool_call: 'work',
  tool_result: 'work',
  'bot.tool_call': 'work',
  'bot.tool_result': 'work',
  token: 'send_to_user',
  'bot.token': 'send_to_user',
};

export function applyBotRealtime(event: RealtimeEvent): void {
  const mascotId = event.mascot_id;
  if (!mascotId) return;
  if (event.type === 'computer_offline' || event.type === 'bot.computer_offline') {
    patchMascotState(mascotId, (mascot) => ({
      ...mascot,
      computer: { ...mascot.computer, status: 'offline', lastError: event.message },
    }));
    return;
  }
  if (event.type === 'bot.routine') {
    void hydrateMascot(mascotId);
    return;
  }
  const kind = TURN_KINDS[event.type];
  if (!kind) return;
  appendTurn(mascotId, event, kind);
}

function appendTurn(mascotId: string, event: RealtimeEvent, kind: BotMessageKind): void {
  if (event.type === 'token' || event.type === 'bot.token') {
    appendToken(mascotId, event.delta ?? event.text ?? '');
    return;
  }
  const message = mapMessage(
    {
      id: event.message_id,
      role: kind === 'user' ? 'user' : 'assistant',
      kind,
      text: event.text ?? event.message ?? event.delta,
      tool: event.tool,
      tool_input: event.tool_input,
      tool_output: event.tool_output,
    },
    0,
  );
  patchMascotState(mascotId, (mascot) => ({
    ...mascot,
    messages: [...mascot.messages, { ...message, seq: mascot.messages.length }],
  }));
}

function appendToken(mascotId: string, delta: string): void {
  if (!delta) return;
  patchMascotState(mascotId, (mascot) => {
    const last = mascot.messages[mascot.messages.length - 1];
    if (last && last.kind === 'send_to_user' && last.id.startsWith('live_')) {
      return {
        ...mascot,
        messages: [...mascot.messages.slice(0, -1), { ...last, content: last.content + delta }],
      };
    }
    return {
      ...mascot,
      messages: [
        ...mascot.messages,
        {
          id: `live_${Date.now().toString(36)}`,
          seq: mascot.messages.length,
          role: 'assistant',
          kind: 'send_to_user',
          content: delta,
          at: Date.now(),
        },
      ],
    };
  });
}
