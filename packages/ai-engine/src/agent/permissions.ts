import type { PermissionDecision, PermissionGate, PermissionRequest, ToolDefinition, ToolRisk } from './types';

const ALWAYS_KEY = (tool: string) => `always:${tool}`;

export class InMemoryPermissionGate implements PermissionGate {
  private always = new Set<string>();
  private pending = new Map<string, (decision: PermissionDecision) => void>();
  private autoAllowSafe: boolean;
  private onRequest?: (request: PermissionRequest) => void;

  constructor(options?: {
    autoAllowSafe?: boolean;
    alwaysAllow?: string[];
    onRequest?: (request: PermissionRequest) => void;
  }) {
    this.autoAllowSafe = options?.autoAllowSafe ?? true;
    this.onRequest = options?.onRequest;
    for (const tool of options?.alwaysAllow ?? []) {
      this.always.add(ALWAYS_KEY(tool));
    }
  }

  rememberAlways(tool: string): void {
    this.always.add(ALWAYS_KEY(tool));
  }

  resolve(requestId: string, decision: PermissionDecision): void {
    const waiter = this.pending.get(requestId);
    if (!waiter) return;
    this.pending.delete(requestId);
    waiter(decision);
  }

  async decide(request: PermissionRequest): Promise<PermissionDecision> {
    if (this.always.has(ALWAYS_KEY(request.tool))) {
      return 'allow-always';
    }
    if (this.autoAllowSafe && request.risk === 'safe') {
      return 'allow-once';
    }

    this.onRequest?.(request);

    return await new Promise<PermissionDecision>((resolve) => {
      this.pending.set(request.id, (decision) => {
        if (decision === 'allow-always') {
          this.rememberAlways(request.tool);
        }
        resolve(decision);
      });
    });
  }
}

export function riskForTool(tool: ToolDefinition | undefined, fallback: ToolRisk = 'exec'): ToolRisk {
  return tool?.risk ?? fallback;
}

export function summarizeCall(name: string, args: Record<string, unknown>): string {
  const path = typeof args.path === 'string' ? args.path : undefined;
  const command = typeof args.command === 'string' ? args.command : undefined;
  if (path) return `${name} ${path}`;
  if (command) return `${name} ${command}`;
  return name;
}
