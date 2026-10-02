// Shape of packages/i18n/locales/<locale>/fixtures/code.json (preview content only).
export type St = "run" | "review" | "merged" | "fail" | "archived";
export type TaskFx = { t: string; repo: string; br: string; st: St; a: number; d: number; dur: string; env: string; when: string; n?: number };
export type AttemptFx = { done: number; fail?: boolean; a: number; d: number; files: number; tests: string; p95: string; note: string; diff: string[] };
export type FileFx = { path: string; st: "A" | "M" | "D"; a: number; d: number; src: string; hidden?: boolean; more?: string };
export type TK = "cmd" | "ok" | "err" | "dim" | "ask";
export type EnvFx = { name: string; ic: string; image: string; stack: string; repos: string; net: string; cache: string; ready: boolean };
export type Person = [string, string];

export type CodeFx = {
  home: { repos: string[]; branches: string[]; envCloud: string; envLocal: string; envCloudShort: string; envLocalShort: string; tasks: [string, string, string][] };
  session: { title: string; prRef: string; prompt: string; log: [string, string][]; running: string; answer: string; answerBold: string; file: string; diff: string; terminal: string };
  tasks: { list: TaskFx[]; repos: string[] };
  attempts: { title: string; repo: string; branch: string; env: string; recommendBody: string; durations: string[]; items: AttemptFx[] };
  review: {
    title: string; prTitle: string; author: Person; branch: string; base: string; src: string; pageOld: string; pageNew: string; test: string;
    srcFile: string; testFile: string; c1: string; c2: string; c3: string; commit: string; commitBranch: string; prRef: string;
  };
  diff: {
    title: string; branch: string; files: FileFx[]; hidden: string[][]; tree: [string, number[]][]; me: Person; comment: string; reply: string;
    conflictFile: string; conflictBody: string; ours: string[]; theirs: string[]; cortex: string[]; oursLabel: string; baseBranch: string;
  };
  terminal: {
    title: string; base: [TK, string][]; run: [TK, string][]; fail: [TK, string][]; build: string; buildAlt: string; user: string;
    env: string; branch: string; network: string; approvals: string; failSub: string; doneSub: string; repo: string; times: string[];
  };
  env: {
    envs: EnvFx[]; setup: string; boot: string[]; bootErr: string[]; images: string[]; domains: string[]; secrets: [string, string, string][];
    stackHint: string; cacheSub: string; cacheFreed: string; current: string; repo: string; netSummary: string; secretsSummary: string; bootTime: string; errLine: string; errBody: string; domainPlaceholder: string;
  };
  pr: {
    title: string; ref: string; desc: string; reviewers: Person[]; more: Person[]; branch: string; checks: [string, string, string][]; ciLog: string;
    sha: string; user: string; files: number; a: number; d: number; reviewerHint: string; e2eFail: string; approvedBy: string;
  };
  settings: {
    org: string; repos: { o: string; r: string; s: string; on: boolean }[]; avail: string[]; agents: string; repoNames: string[];
    allow: string[]; fromTask: string; usage: [string, number, number, number][]; reset: string;
  };
};
