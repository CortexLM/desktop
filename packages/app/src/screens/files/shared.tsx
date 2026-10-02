// Shared helpers of the Files area: fixture shapes, locale-aware number formatting, preview answers.
import { useI18n } from "../../i18n";
import { useFixtures } from "../../preview";
import type { State } from "../../mascot/Mascot";

export type Msg = { u?: string; b?: string; st?: State };
/** Preview mini-chat: suggestions, keyword answers (regex source) and a fallback. */
export type AskFx = { sugg: string[]; answers: { re: string; a: string }[]; fallback: string };
export const answerOf = (ask: AskFx) => (q: string) => ask.answers.find((x) => new RegExp(x.re, "i").test(q))?.a ?? ask.fallback;

export type PPage = { h: string; p: string[]; chart?: number[] };
export type Slide = { t: string; s?: string; k: "cover" | "bullets" | "stat" | "img" | "split" | "end"; b?: string[]; img?: string; n?: string };
export type Cmt = { id: number; who: string; at: string; t: string; done?: boolean };
export type Cell = string | number;
export type Sheet = { name: string; head: string[]; rows: Cell[][]; f?: Record<string, string> };
export type UpFx = { name: string; size: number; pct: number; err?: "type" | "size" | "connection" };
export type Seg = { t: number; who: number; text: string };
export type ZipNode = { name: string; kb?: number; kids?: ZipNode[]; text?: string; img?: string };
export type MediaMeta = { name: string; size: string; type: string };
export type MediaAsk = { sugg: string[]; answers: string[] };

export type FilesFx = {
  bot: string;
  pdf: {
    name: string; meta: string; kicker: string; pages: PPage[]; months: string[]; search: string; selection: string;
    notes: Record<string, { y: string; who: string; t: string }[]>; ask: AskFx; summary: Msg[]; summaryPoints: string[];
    act: { explain: string; summarize: string; quote: string }; protectedBody: string;
  };
  pptx: { name: string; meta: string; slides: Slide[]; ask: AskFx };
  docx: {
    name: string; meta: string; author: string; comments: Cmt[]; ask: AskFx;
    doc: {
      kicker: string; title: string; intro: string; h1: string; h2: string; h3: string;
      obj: [string, string, { pre: string; del: string; ins: string; post: string }];
      deliv: [string, { pre: string; del: string; ins: string }, { text: string; ins: string }];
      table: { head: [string, string, string]; rows: [string, string, number][]; total: string };
      contact: string;
    };
  };
  xlsx: { name: string; meta: string; sheets: Sheet[]; errs: Record<string, string>; ask: AskFx };
  upload: { project: string; demo: UpFx[]; errors: UpFx[]; drive: { name: string; size: number }[] };
  image: MediaMeta & { alt: string; exif: [string, [string, string][]][]; ask: MediaAsk };
  code: MediaMeta & { src: string; diff: [string, string][]; diffMeta: string; ask: MediaAsk };
  audio: MediaMeta & { speakers: [string, string, string][]; segs: Seg[]; lang: string; ask: MediaAsk };
  video: MediaMeta & { chapters: { t: number; title: string; img: string }[]; segs: Seg[]; ask: MediaAsk };
  zip: MediaMeta & { tree: ZipNode[]; extractedTo: string; extractingFile: string; ask: MediaAsk };
};

export const useFx = () => useFixtures<FilesFx>("files");

/** Locale-aware number, currency and byte formatting. */
export function useFmt() {
  const { locale } = useI18n();
  const num = (n: number, d = 0) => n.toLocaleString(locale, { maximumFractionDigits: d, minimumFractionDigits: d });
  const eur = (n: number) => n.toLocaleString(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  return { locale, num, eur };
}
