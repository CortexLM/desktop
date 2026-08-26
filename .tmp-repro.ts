import { OpenRouterProvider } from './packages/ai-engine/src/providers/openrouter-provider';
import { CODING_TOOLS } from './packages/ai-engine/src/agent/tools';
import { readFileSync } from 'node:fs';

const key = JSON.parse(readFileSync('/home/ubuntu/.config/Electron/provider-settings.json', 'utf8')).providers.openrouter.apiKey;
const provider = new OpenRouterProvider({ apiKey: key });

const tools = CODING_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> }));
console.log('tools:', tools.length, tools.map((t) => t.name).join(','));

const started = Date.now();
const timer = setInterval(() => console.log('  ...waiting', Math.round((Date.now() - started) / 1000) + 's'), 5000);

const res = await provider.chat(
  [
    { role: 'system', content: 'You are a coding agent. Use tools to accomplish the task.' },
    { role: 'user', content: 'Create a file named NOTES.md containing a short haiku about code review, then briefly summarize what you did.' },
  ],
  { tools }
);
clearInterval(timer);
console.log('elapsed', Date.now() - started, 'ms');
console.log('content:', JSON.stringify(res.content).slice(0, 200));
console.log('toolCalls:', JSON.stringify(res.toolCalls ?? []).slice(0, 400));
