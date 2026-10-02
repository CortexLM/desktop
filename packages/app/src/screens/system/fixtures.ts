// Shape of packages/i18n/locales/<locale>/fixtures/system.json (preview content only).
export type Hit = { kind: "chats" | "projects" | "files" | "bots" | "settings"; icon: string; title: string; sub: string; meta: string; to: string; img?: string };
export type Proj = { name: string; desc: string; img: string; icon: string; color: string; members: string[]; chats: number; files: number };
export type Mem = { id: number; theme: string; text: string; src: string };
export type ProviderFx = { id: string; name: string; supported: boolean; modelCount: number; hasKey?: boolean; keyHint?: string; enabled?: boolean };
export type ModelFx = { id: string; name: string; reasoning: boolean; image: boolean; tools: boolean; context: number; input: number; output: number };

export type SystemFx = {
  bot: { name: string; doing: string; meta: string };
  user: { initials: string; name: string; first: string; last: string; email: string; role: string; org: string };
  search: { hits: Hit[]; recent: [string, string][]; opened: string[]; total: string; q: Record<string, string> };
  cmd: { recents: { label: string; icon: string; to: string; meta: string }[]; q: Record<string, string> };
  projects: Proj[];
  newProject: { name: string; instructions: string };
  project: {
    name: string; desc: string; color: string; icon: string; members: string[]; chats: number; files: number;
    fileList: [string, string, string, string][]; chatList: [string, string][]; people: [string, string, string, "owner" | "editor" | "viewer"][];
    instructions: string; invite: string; link: string; botDoing: string;
  };
  memory: { items: Mem[]; exportFile: string };
  onboarding: { apps: [string, string, string][]; connectors: number };
  login: { email: string; good: string; bad: string };
  pricing: { card: string; exp: string };
  profile: { twofaSince: string; passkeys: string; codes: string[]; sessions: [string, string, string, string, boolean][]; chats: number; projects: number; memories: number; files: number };
  offline: { title: string; lastSync: string; user: string; bot: string; queue: [string, string, string][] };
  error: { ref: string; project: string; owner: string; idle: string; start: string; end: string; paused: number; back: string };
  update: { version: string; current: string; size: number; notes: ["ok" | "run" | "wait", "new" | "improved" | "fixed", string][] };
  about: { version: string; build: string; os: string; ref: string };
  providers: ProviderFx[];
  models: ModelFx[];
};
