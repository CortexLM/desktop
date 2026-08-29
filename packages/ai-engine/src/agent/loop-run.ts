/**
 * Permission + execute + artifact offload + secret redaction.
 * Independent calls run together; results stay in the original call order.
 */

import { redactSecretValues } from './secrets';
import { runParallel } from './loop-calls';
import type {
  ArtifactHost,
  PermissionGate,
  PermissionRequest,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from './types';
import { riskForTool, summarizeCall, targetForCall } from './permissions';

export interface PreparedCall {
  call: ToolCall;
  definition?: ToolDefinition;
  request: PermissionRequest;
}

export function prepareCall(
  call: ToolCall,
  definition: ToolDefinition | undefined,
  agentName?: string,
): PreparedCall {
  return {
    call,
    definition,
    request: {
      id: `perm-${call.id}`,
      tool: call.name,
      risk: riskForTool(definition),
      summary: summarizeCall(call.name, call.arguments),
      detail: JSON.stringify(call.arguments),
      path: targetForCall(call.arguments),
      agent: agentName,
    },
  };
}

export function readArtifact(call: ToolCall, artifacts?: ArtifactHost): ToolResult | undefined {
  const id = typeof call.arguments.artifact_id === 'string' ? call.arguments.artifact_id : '';
  if (!id || !artifacts) return undefined;
  if (call.name === 'Grep') return pageOrMissing(artifacts.grep(id, String(call.arguments.pattern ?? '')), id);
  if (call.name === 'Read') {
    const offset = typeof call.arguments.offset === 'number' ? call.arguments.offset : 1;
    const limit = typeof call.arguments.limit === 'number' ? call.arguments.limit : 80;
    return pageOrMissing(artifacts.readPage(id, offset, limit), id);
  }
  return undefined;
}

function pageOrMissing(page: string | undefined, id: string): ToolResult {
  return page === undefined ? { ok: false, output: `Unknown artifact "${id}"` } : { ok: true, output: page };
}

export async function decideAndRun(
  prepared: PreparedCall[],
  permissions: PermissionGate,
  execute: (call: ToolCall) => Promise<ToolResult>,
  artifacts?: ArtifactHost,
): Promise<Map<string, ToolResult>> {
  const allowed: PreparedCall[] = [];
  const results = new Map<string, ToolResult>();

  for (const item of prepared) {
    const decision = await permissions.decide(item.request);
    if (decision === 'deny') {
      results.set(item.call.id, { ok: false, output: `Permission denied for ${item.call.name}` });
    } else {
      allowed.push(item);
    }
  }

  const executed = await runParallel(allowed.map((item) => item.call), async (call) => {
    return readArtifact(call, artifacts) ?? execute(call);
  });
  allowed.forEach((item, index) => {
    results.set(item.call.id, finishResult(item.call.name, executed[index]!, artifacts));
  });
  return results;
}

export function finishResult(tool: string, result: ToolResult, artifacts?: ArtifactHost): ToolResult {
  const redacted = redactSecretValues(result.output);
  const stub = artifacts?.offload(tool, redacted) ?? { output: redacted };
  return { ...result, output: stub.output };
}
