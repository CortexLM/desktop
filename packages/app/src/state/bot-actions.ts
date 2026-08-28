/**
 * Bot writes. Every function hits the API first. localStorage is never the
 * write target for messages, lifecycle, or videos.
 */

import {
  postComputerInput,
  postLifecycle,
  postMascotMessage,
  postRecord,
  postRespond,
  postSecret,
  type ComputerInput,
  type LifecycleAction,
} from '@cortex-ide/cortex-api';

import { requireBotClient } from './bot-client.ts';
import { mascotById, patchMascotState } from './bots.ts';
import { mapComputer, mapMessage, type BotMessage } from './bot-map.ts';

export async function sendBotMessage(mascotId: string, text: string): Promise<BotMessage> {
  const client = requireBotClient();
  const row = await postMascotMessage(client, mascotId, { text });
  const message = mapMessage(row, nextSeq(mascotId));
  patchMascotState(mascotId, (mascot) => ({ ...mascot, messages: [...mascot.messages, message] }));
  return message;
}

export async function answerAsk(mascotId: string, text: string, askId?: string): Promise<void> {
  const client = requireBotClient();
  const row = await postRespond(client, mascotId, { text, ask_id: askId });
  const message = mapMessage(row, nextSeq(mascotId));
  patchMascotState(mascotId, (mascot) => ({
    ...mascot,
    messages: [...settleAsks(mascot.messages), message],
  }));
}

export async function submitBotSecret(
  mascotId: string,
  name: string,
  value: string,
): Promise<void> {
  await postSecret(requireBotClient(), mascotId, { name, value });
  patchMascotState(mascotId, (mascot) => ({
    ...mascot,
    messages: mascot.messages.map((message) =>
      message.kind === 'secret' && message.secret?.name === name
        ? { ...message, secret: { ...message.secret, pending: false } }
        : message,
    ),
  }));
}

export async function runLifecycle(mascotId: string, action: LifecycleAction): Promise<void> {
  const computer = await postLifecycle(requireBotClient(), mascotId, action);
  patchMascotState(mascotId, (mascot) => ({
    ...mascot,
    computer: mapComputer({ id: mascotId, computer_id: mascot.computer.id }, computer),
  }));
}

export async function sendComputerInput(mascotId: string, input: ComputerInput): Promise<void> {
  await postComputerInput(requireBotClient(), mascotId, input);
}

export async function setRecording(mascotId: string, action: 'start' | 'stop'): Promise<void> {
  await postRecord(requireBotClient(), mascotId, { action });
}

function nextSeq(mascotId: string): number {
  const messages = mascotById(mascotId)?.messages ?? [];
  return messages.length === 0 ? 0 : messages[messages.length - 1]!.seq + 1;
}

function settleAsks(messages: BotMessage[]): BotMessage[] {
  return messages.map((message) =>
    message.kind === 'ask_user' && message.ask
      ? { ...message, ask: { ...message.ask, pending: false } }
      : message,
  );
}
