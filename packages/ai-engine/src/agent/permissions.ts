import type {
  PermissionDecision,
  PermissionGate,
  PermissionRequest,
  PermissionRule,
  ToolDefinition,
  ToolRisk,
} from './types';

const ALWAYS_KEY = (tool: string, pattern?: string, agent?: string) =>
  `always:${agent ?? '*'}:${tool}:${pattern ?? '*'}`;

export class InMemoryPermissionGate implements PermissionGate {
  private always = new Set<string>();
  private pending = new Map<string, (decision: PermissionDecision) => void>();
  private autoAllowSafe: boolean;
  private onRequest?: (request: PermissionRequest) => void;
  private rules: PermissionRule[];
  private agentName?: string;

  constructor(options?: {
    autoAllowSafe?: boolean;
    alwaysAllow?: string[];
    rules?: PermissionRule[];
    agentName?: string;
    onRequest?: (request: PermissionRequest) => void;
  }) {
    this.autoAllowSafe = options?.autoAllowSafe ?? true;
    this.onRequest = options?.onRequest;
    this.rules = options?.rules ?? [];
    this.agentName = options?.agentName;
    for (const tool of options?.alwaysAllow ?? []) {
      this.always.add(ALWAYS_KEY(tool));
    }
  }

  setAgentName(name?: string): void {
    this.agentName = name;
  }

  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  rememberAlways(tool: string, pattern?: string, agent?: string): void {
    this.always.add(ALWAYS_KEY(tool, pattern, agent));
  }

  resolve(requestId: string, decision: PermissionDecision): void {
    const waiter = this.pending.get(requestId);
    if (!waiter) return;
    this.pending.delete(requestId);
    waiter(decision);
  }

  async decide(request: PermissionRequest): Promise<PermissionDecision> {
    const pathOrCommand = request.path ?? '';
    const agent = request.agent ?? this.agentName;

    if (this.always.has(ALWAYS_KEY(request.tool, pathOrCommand || undefined, agent))) {
      return 'allow-always';
    }
    if (this.always.has(ALWAYS_KEY(request.tool))) {
      return 'allow-always';
    }

    const matched = matchRules(this.rules, request.tool, pathOrCommand, agent);
    if (matched === 'deny') return 'deny';
    if (matched === 'allow') return 'allow-once';

    if (this.autoAllowSafe && request.risk === 'safe') {
      return 'allow-once';
    }

    this.onRequest?.(request);

    return await new Promise<PermissionDecision>((resolve) => {
      this.pending.set(request.id, (decision) => {
        if (decision === 'allow-always') {
          this.rememberAlways(request.tool, pathOrCommand || undefined, agent);
        }
        resolve(decision);
      });
    });
  }
}

export function matchRules(
  rules: PermissionRule[],
  tool: string,
  target: string,
  agent?: string
): PermissionRule['action'] | null {
  for (const rule of rules) {
    if (rule.agent && agent && rule.agent !== agent) continue;
    if (rule.agent && !agent) continue;
    if (rule.tool !== '*' && rule.tool !== tool) continue;
    if (rule.pattern && !matchGlobish(target, rule.pattern)) continue;
    return rule.action;
  }
  return null;
}

function matchGlobish(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::GS::')
    .replace(/\*/g, '.*')
    .replace(/::GS::/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

export function riskForTool(tool: ToolDefinition | undefined, fallback: ToolRisk = 'exec'): ToolRisk {
  return tool?.risk ?? fallback;
}

export function summarizeCall(name: string, args: Record<string, unknown>): string {
  const path = typeof args.path === 'string' ? args.path : undefined;
  const command = typeof args.command === 'string' ? args.command : undefined;
  const url = typeof args.url === 'string' ? args.url : undefined;
  if (path) return `${name} ${path}`;
  if (command) return `${name} ${command}`;
  if (url) return `${name} ${url}`;
  return name;
}

export function targetForCall(args: Record<string, unknown>): string | undefined {
  if (typeof args.path === 'string') return args.path;
  if (typeof args.command === 'string') return args.command;
  if (typeof args.url === 'string') return args.url;
  return undefined;
}
