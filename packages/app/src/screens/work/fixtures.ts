// Shape of the preview fixtures (packages/i18n/locales/<locale>/fixtures/work.json). Preview only.
type Col = "todo" | "doing" | "review" | "done";
type Run = "ok" | "err" | "skip";
export type Msg = { id: number; bot: string; t: string; d: string; when: string; urg: "now" | "today" | "later"; act: string; to: string };
export type Conn = { id: string; mono: string; t: string; d: string; st: "on" | "re" | "err" | "off"; perms: [string, string, string][] };
export type WorkFx = {
  main: { name: string };
  filterBots: string[];
  tasks: { id: string; t: string; bot: string; col: Col; meta: string; prog?: number }[];
  computer: { menu: string[]; url: string; nav: string[]; navActive: number; heading: string; rows: [string, string, string][] };
  task: {
    title: string; site: string; statusDoing: string; user: string; bot1: string; bot2: string;
    ev1: { b: string; t: string; when: string }; ev2: { b: string; t: string; when: string };
    steps: string[];
    mail: { header: string; to: string; subject: string; body: string[]; toastTo: string; sentAt: string };
    cred: { header: string; text: string; login: string; skip: string };
    recap: { badge: string; stats: [string, string][]; files: [string, string, string][] };
    fail: { title: string; text: string; bot: string };
  };
  routines: { id: string; t: string; bot: string; trig: string; ev?: boolean; next: string; nextSub: string; runs: Run[]; on: boolean }[];
  history: [string, string, string, Run, string][];
  failRoutine: string; failNextSub: string; failHist: [string, string, string, Run, string];
  failBanner: { title: string; text: string };
  edit: { name: string; instr: string; eventName: string; eventInstr: string; eventBot: string; bots: string[]; tz: string; sources: Record<string, string>; eventRate: string; testSteps: string[]; testOkTitle: string; testOkText: string };
  inbox: Msg[];
  approvals: { id: string; bot: string; icon: string; kind: string; t: string; d: string; when: string }[];
  payment: {
    bot: string; amount: string; kv: [string, string][]; check: string; alwaysRule: string; why: string;
    okTitle: string; okText: string; noTitle: string; noText: string; cancelTransfer: string;
    invoice: { vendor: string; ref: string; address: string; lines: [string, string][]; totalLabel: string };
  };
  activity: [string, { bot: string; icon: string; type: string; b: string; t: string; when: string }[]][];
  activityBots: string[];
  notifications: { id: number; kind: "bot" | "mention"; who: string; initials?: string; t: string; when: string; to: [string, string?] }[];
  readIds: number[];
  connectors: Conn[];
  connError: { banner: string; bannerText: string; detail: string; affected: [string, string][] };
  connOk: string;
};
