import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Shared deterministic fixture only. Importing this file does not start a server or write files.
const prefix = '[exit code 7]\n… [truncated 9 characters]\n';
const stdout = (prefix + '0123456789abcdef\n'.repeat(3000)).slice(0, 50017);
const python = 'import sys; p="[exit code 7]\\n\\u2026 [truncated 9 characters]\\n"; sys.stdout.write((p+"0123456789abcdef\\n"*3000)[:50017]); sys.stderr.write("stderr\\n")';
export const fixture = {
  protocol: 'cortex-terminal-native-v1', prefix, stdout, stderr: 'stderr\n',
  exitCommand: 'exit 7', largeCommand: `/usr/bin/python3 -c '${python}'`,
  exitOutput: '\n[exit code 7]', largeOutput: stdout.slice(0, 50000) + '\n… [truncated 24 characters]',
  exitNotice: '[Commande terminée avec le code 7]', truncatedNotice: '… [24 caractères omis]',
};
export const prompt = (runID, theme, replay = false) => `Cortex terminal ${replay ? 'replay' : 'verification'} ${runID} ${theme}`;
export const callID = (runID, theme, kind) => `terminal-${runID}-${theme}-${kind}`;

async function serve() {
  const [directory, receipt] = process.argv.slice(2);
  assert.equal(process.platform, 'darwin', 'Run this provider on the leased Mac');
  assert(directory && receipt, 'Usage: node provider.mjs <isolated-mac-project> <mac-receipt.json>');
  const project = fs.realpathSync(directory);
  assert(/^\/(?:private\/)?tmp\/opencode\/desktop-recovery-[^/]+\/project$/.test(project), 'Use the isolated project directory');
  assert(fs.statSync(project).isDirectory());
  assert.equal(fs.realpathSync(path.dirname(receipt)), path.dirname(project), 'Receipt belongs beside project');
  assert(!fs.existsSync(receipt), 'Use a fresh receipt path');
  const runID = randomUUID(), requests = [], errors = [];
  const health = { protocol: fixture.protocol, runID, project, platform: process.platform, port: 9456, startedAt: new Date().toISOString() };
  const snapshot = () => ({ ...health, requests, errors });
  const save = () => fs.writeFileSync(receipt, JSON.stringify(snapshot(), null, 2) + '\n');
  const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
  const catalog = { fake: { id: 'fake', name: 'Cortex test provider', env: [], npm: '@ai-sdk/openai-compatible', api: 'http://127.0.0.1:9456/v1', models: {
    reasoner: { id: 'reasoner', name: 'Reasoner Large', family: 'reasoner', tool_call: true, reasoning: false, attachment: false,
      modalities: { input: ['text'], output: ['text'] }, limit: { context: 100000, output: 4000 } },
  } } };
  const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, health);
    if (req.method === 'GET' && req.url === '/catalog') return json(res, 200, catalog);
    if (req.method === 'GET' && req.url === '/receipt') return json(res, 200, snapshot());
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { error: 'Unknown fixture route' });
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; requireValue(bytes <= 1024 * 1024, 'request_too_large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requireValue(body && body.model === 'reasoner' && Array.isArray(body.messages), 'unexpected_request');
      const users = body.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join('') : '');
      const theme = ['light', 'dark'].find(t => users.includes(prompt(runID, t)));
      requireValue(theme, 'unrecognized_case');
      const replay = users.at(-1) === prompt(runID, theme, true);
      requireValue(replay || users.at(-1) === prompt(runID, theme), 'unrecognized_prompt');
      const parts = body.messages.filter(m => m.role === 'tool');
      requireValue(parts.length <= 2, 'unexpected_tool_count');
      const checks = { modelExact: true, exitOutputExact: null, largeOutputExact: null, exitMetadataExact: null, largeMetadataExact: null, plainReplayExact: null };
      for (const [index, p] of parts.entries()) {
        const kind = index === 0 ? 'exit' : 'large';
        requireValue(p.tool_call_id === callID(runID, theme, kind) && typeof p.content === 'string', 'unexpected_tool_result');
        const expected = kind === 'exit' ? fixture.exitOutput : fixture.largeOutput;
        if (replay) requireValue(p.content === expected, 'replay_output_changed');
        else {
          const value = JSON.parse(p.content);
          requireValue(value.output === expected, 'live_output_changed');
          const m = value.metadata;
          requireValue(m && m.exit === (index ? 0 : 7) && m.outputLength === (index ? 50000 : 0) && m.truncated === (index ? 24 : 0), 'metadata_mismatch');
          checks[`${kind}MetadataExact`] = true;
        }
        checks[`${kind}OutputExact`] = true;
      }
      requireValue(!replay || parts.length === 2, 'missing_replay_results');
      if (replay) checks.plainReplayExact = true;
      const phase = replay ? 'replay' : ['exit', 'large', 'complete'][parts.length];
      requests.push({ index: requests.length + 1, theme, phase, toolResultCount: parts.length, checks });
      save(); // Booleans only: no prompts, credentials or full model/tool bodies in the receipt.
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'terminal-proof', object: 'chat.completion.chunk', created: 1, model: 'reasoner', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      send({ role: 'assistant' });
      if (phase === 'exit' || phase === 'large') {
        send({ tool_calls: [{ index: 0, id: callID(runID, theme, phase), type: 'function', function: { name: 'bash', arguments: JSON.stringify({ command: phase === 'exit' ? fixture.exitCommand : fixture.largeCommand }) } }] });
        send({}, 'tool_calls');
      } else { send({ content: replay ? 'Historique conservé.' : 'Terminé.' }); send({}, 'stop'); }
      res.end('data: [DONE]\n\n');
    } catch (error) {
      errors.push({ index: errors.length + 1, code: error instanceof SyntaxError ? 'invalid_json' : error.message });
      save();
      if (!res.headersSent) json(res, 422, { error: { message: 'Controlled terminal fixture rejected the request' } });
      else res.end();
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9456, '127.0.0.1', resolve); });
  save();
  console.log(`Terminal fixture ready on 127.0.0.1:9456; run ${runID}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await serve();
