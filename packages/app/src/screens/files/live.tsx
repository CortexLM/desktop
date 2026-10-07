// Live viewers: each file screen keeps its own chrome and opens a file picked on this computer. Nothing is uploaded.
import * as React from "react";
import { useT } from "../../i18n";
import { Icon } from "../../kit/ui";
import { listZip, readZipText, xmlText, type ZipEntry } from "./zip";

type Kind = "pdf" | "pptx" | "docx" | "xlsx" | "audio" | "video" | "zip" | "image" | "code";
const ACCEPT: Record<Kind, string> = { pdf: ".pdf,application/pdf", pptx: ".pptx", docx: ".docx", xlsx: ".xlsx", audio: "audio/*", video: "video/*", zip: ".zip,application/zip", image: "image/*", code: ".ts,.tsx,.js,.jsx,.py,.go,.rs,.json,.md,.txt,.css,.html,.sh,.yaml,.yml,.toml" };
const ICON: Record<Kind, string> = { pdf: "file", pptx: "file", docx: "file", xlsx: "file", audio: "mic", video: "play", zip: "folder", image: "image", code: "code" };
type Loaded = { file: File; url: string; parts?: { name: string; text: string }[]; entries?: ZipEntry[] };

async function parse(kind: Kind, file: File): Promise<Loaded> {
  const url = URL.createObjectURL(file);
  if (kind === "zip") return { file, url, entries: listZip(await file.arrayBuffer()) };
  if (kind === "docx" || kind === "pptx" || kind === "xlsx") {
    const buf = await file.arrayBuffer(), all = listZip(buf);
    const pick = kind === "docx" ? (n: string) => n === "word/document.xml" : kind === "pptx" ? (n: string) => /^ppt\/slides\/slide\d+\.xml$/.test(n) : (n: string) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n);
    const order = (n: string) => Number(/(\d+)\.xml$/.exec(n)?.[1] ?? 0);
    const chosen = all.filter(e => pick(e.name)).sort((a, b) => order(a.name) - order(b.name));
    return { file, url, parts: await Promise.all(chosen.map(async e => ({ name: e.name, text: kind === "xlsx" ? (await readZipText(buf, e)).replace(/<\/(?:si|c)>/g, "\t").replace(/<\/row>/g, "\n").replace(/<[^>]+>/g, "").trim() : xmlText(await readZipText(buf, e)) }))) };
  }
  if (kind === "code") return { file, url, parts: [{ name: file.name, text: await file.text() }] };
  return { file, url };
}

export function LiveFile({ kind, screen }: { kind: Kind; screen: string }) {
  const t = useT();
  const input = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<{ s: "empty" } | { s: "loading" } | { s: "error" } | { s: "ready"; data: Loaded }>({ s: "empty" });
  const [slide, setSlide] = React.useState(0);
  React.useEffect(() => () => { if (state.s === "ready") URL.revokeObjectURL(state.data.url); }, [state]);
  const open = async (file?: File) => {
    if (!file) return;
    setState({ s: "loading" }); setSlide(0);
    try { setState({ s: "ready", data: await parse(kind, file) }); } catch { setState({ s: "error" }); }
  };
  const data = state.s === "ready" ? state.data : undefined;
  const parts = data?.parts ?? [];
  const body = !data ? <div className="fichiers-drop" data-testid="file-live-empty" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void open(e.dataTransfer.files[0]); }}>
      <span className="fichiers-drop-ic"><Icon name={ICON[kind]} /></span>
      <b>{t(`files.live.empty.${kind}`)}</b>
      <span>{t(state.s === "error" ? "files.live.error" : state.s === "loading" ? "files.live.loading" : "files.live.hint")}</span>
      <div className="fichiers-drop-act"><button className="btn secondary" data-testid="file-live-open" onClick={() => input.current?.click()}><Icon name="folder" />{t("files.live.open")}</button></div>
    </div>
    : kind === "pdf" ? <object className="fichiers-live-pdf" data={data.url} type="application/pdf" aria-label={data.file.name}><a href={data.url} download={data.file.name}>{data.file.name}</a></object>
    : kind === "audio" ? <audio className="fichiers-live-media" controls src={data.url} aria-label={data.file.name} />
    : kind === "video" ? <video className="fichiers-live-media" controls src={data.url} aria-label={data.file.name} />
    : kind === "image" ? <img className="fichiers-live-media" src={data.url} alt={data.file.name} />
    : kind === "code" ? <pre className="fichiers-live-grid fichiers-live-code" data-testid="file-live-text">{parts[0]?.text}</pre>
    : kind === "zip" ? <ul className="fichiers-live-tree" data-testid="file-live-entries">{data.entries!.map(e => <li key={e.name}><Icon name={e.name.endsWith("/") ? "folder" : "file"} size={16} /><span className="fichiers-grow fichiers-ell">{e.name}</span><span className="fichiers-meta">{e.size}</span></li>)}</ul>
    : kind === "pptx" ? <div className="fichiers-live-slides"><nav className="fichiers-live-thumbs">{parts.map((p, i) => <button key={p.name} aria-current={i === slide || undefined} onClick={() => setSlide(i)}>{i + 1}</button>)}</nav><article className="fichiers-live-slide" data-testid="file-live-text">{parts[slide]?.text}</article></div>
    : kind === "xlsx" ? <pre className="fichiers-live-grid" data-testid="file-live-text">{parts.filter(p => p.name.includes("worksheets")).map(p => p.text).join("\n\n") || parts.map(p => p.text).join("\n")}</pre>
    : <article className="fichiers-a4 fichiers-live-doc" data-testid="file-live-text">{parts.map(p => p.text.split("\n").map((l, i) => <p key={p.name + i}>{l}</p>))}</article>;
  return <div className="fichiers-live" data-testid={`screen-${screen}`} data-kind={kind} data-state={state.s}>
    <div className="content-top fichiers-top">
      <span className="fichiers-ftype" data-k={kind} aria-hidden>{kind.toUpperCase().slice(0, 3)}</span>
      <span className="fichiers-fname fichiers-grow"><span className="ttl fichiers-ell">{data?.file.name ?? t(`files.screen.${screen}`)}</span><span className="fichiers-meta">{data ? t("files.size.kb", { n: Math.max(1, Math.round(data.file.size / 1024)) }) : t("files.live.local")}</span></span>
      {data && <a className="btn secondary" href={data.url} download={data.file.name}><Icon name="download" />{t("files.head.download")}</a>}
      <button className="btn secondary" onClick={() => input.current?.click()}><Icon name="folder" />{t("files.live.open")}</button>
      <input ref={input} type="file" hidden accept={ACCEPT[kind]} data-testid="file-live-input" onChange={e => { void open(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
    <div className={`fichiers-live-body fichiers-live-${kind}`}>{body}</div>
  </div>;
}
