/**
 * Split a SendToUser turn into employee-style bubbles.
 *
 * One wall of text reads as a dump. Double newlines are the natural pause
 * between things a teammate would send as separate messages.
 */

export function splitEmployeeBubbles(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : text.trim() ? [text.trim()] : [];
}
