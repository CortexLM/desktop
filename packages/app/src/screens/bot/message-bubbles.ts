/**
 * One SendToUser turn may be several bubbles. The service can send a `bubbles`
 * array; otherwise a blank line starts a new bubble. Tool traces stay in Work.
 */

import type { BotMessage } from '../../state/bot-map.ts';

export function visibleBubbles(message: BotMessage): string[] {
  if (message.kind !== 'send_to_user' && message.kind !== 'user') {
    return message.content.trim() ? [message.content] : [];
  }
  if (message.bubbles && message.bubbles.length > 0) {
    return message.bubbles.map((part) => part.trim()).filter(Boolean);
  }
  return splitParagraphs(message.content);
}

export function splitParagraphs(content: string): string[] {
  const parts = content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [];
}
