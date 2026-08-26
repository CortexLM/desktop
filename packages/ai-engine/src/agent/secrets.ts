/**
 * Agents may see secret NAMES, never values.
 */

const NAMED: Array<{ name: string; pattern: RegExp }> = [
  { name: 'ANTHROPIC_API_KEY', pattern: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { name: 'OPENAI_API_KEY', pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'GITHUB_TOKEN', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
];

const KEY_VALUE =
  /((?:api[_-]?key|access[_-]?token|secret|password|authorization|bearer)\s*[:=]\s*)(["']?)([^\s"'\\]{8,})\2/gi;

export function redactSecretValues(text: string): string {
  let next = text;
  for (const { name, pattern } of NAMED) {
    next = next.replace(pattern, name);
  }
  next = next.replace(KEY_VALUE, (_all, label: string, quote: string) => `${label}${quote}<secret-name>${quote}`);
  return next;
}
