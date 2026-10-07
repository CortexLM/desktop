// Canvas (design "canvas"): document / code side panel. Preview only.
import * as React from "react";
import { Icon, IconBtn, Pop, MItem, useToast } from "../../kit/ui";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { LiveChatFeature } from "./live-features";
import { BotRow, Box, Unavailable, css, useCopy, useFx, useStream } from "./shared";

export const CANVAS_VARIANTS: [string, string, string][] = [["document", "document"], ["code", "code"], ["selection", "selection"], ["generation", "generation"], ["compare", "compare"]]
  .map(([id, d]) => [id, `chat.variant.canvas.${id}`, d]);

export function Canvas() {
  const [v, setV] = useVariant("document");
  if (!isPreview()) return <LiveChatFeature feature="canvas" local={<Unavailable feature="canvas" />} />;
  return <CanvasIn key={v} v={v} setV={setV} />;
}

function CanvasIn({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const fx = useFx().canvas;
  const DOC: string[] = fx.doc;
  const toast = useToast();
  const copy = useCopy();
  const isCode = v === "code";
  const gen = useStream(DOC.join("\n"), { run: v === "generation", step: 2 });
  const [out, setOut] = React.useState("");
  const [ver, setVer] = React.useState(3);
  const docRef = React.useRef<HTMLDivElement>(null);
  const markRef = React.useRef<HTMLElement>(null);
  const [sel, setSel] = React.useState<{ x: number; y: number } | null>(null);
  const [selText, setSelText] = React.useState<string>(fx.sel);
  const [ask, setAsk] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const place = (r: DOMRect) => {
    const d = docRef.current; if (!d) return;
    const b = d.getBoundingClientRect();
    setSel({ x: r.left - b.left + r.width / 2, y: r.bottom - b.top + d.scrollTop });
  };
  React.useLayoutEffect(() => { if (v === "selection" && markRef.current) place(markRef.current.getBoundingClientRect()); }, [v]);
  const onUp = () => {
    const s = getSelection();
    if (s && !s.isCollapsed && docRef.current?.contains(s.anchorNode)) place(s.getRangeAt(0).getBoundingClientRect());
    else if (v !== "selection") setSel(null);
  };
  const apply = (e: React.FormEvent) => {
    e.preventDefault(); setWorking(true);
    setTimeout(() => { setWorking(false); setSel(null); setAsk(""); if (v === "selection") setSelText(fx.sel2); toast.add({ title: t("chat.canvas.edited"), description: t("chat.canvas.versionCreated", { n: 4 }), data: { icon: "check" } }); setVer(4); }, 1200);
  };
  const head: string = isCode ? fx.file : fx.head;
  const editable = v === "document";
  const formats: string[] = isCode ? [t("chat.canvas.downloadTs"), t("chat.canvas.openInCode")] : [t("chat.canvas.pdf"), t("chat.canvas.word"), t("chat.canvas.markdown")];
  const askPh = t("chat.canvas.ask");
  return (<>
    <div className="content-top"><span className="title">{fx.title}</span><div className="spacer" /><IconBtn icon="share" label={t("chat.act.share")} /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" /></div>
    <div className="split chat-canvas">
      <div className="split-l chat-canvas-l">
        <div className="msg-user">{isCode ? fx.codeQ : fx.docQ}</div>
        <BotRow st={v === "generation" ? (gen.on ? "working" : "done") : working ? "working" : "idle"}>
          {v === "generation" && gen.on ? <span className="thinking">{t("chat.canvas.writing")}</span>
            : <p>{isCode ? fx.codeA : fx.docA}</p>}
          <button className="chat-doccard" onClick={() => docRef.current?.focus()}><span className="li-ic"><Icon name={isCode ? "file-code" : "file"} /></span><span className="chat-grow"><span className="ttl">{head}</span><span className="sub">{v === "generation" && gen.on ? t("chat.canvas.inProgress") : t("chat.canvas.versionMeta", { n: ver, time: fx.time })}</span></span></button>
        </BotRow>
        {v === "compare" && <div className="msg-user">{fx.compareQ}</div>}
        {working && <BotRow st="working"><span className="thinking">{t("chat.canvas.editing")}</span></BotRow>}
        <div className="chat-grow" />
        <Box mode={v === "generation" && gen.on ? "busy" : "idle"} onStop={gen.stop} placeholder={askPh} />
      </div>
      <div className="split-r chat-canvas-r">
        <div className="pane-head">
          <Icon name={isCode ? "file-code" : "file"} className="chat-i1" />
          <span className="chat-pane-t">{head}</span>
          {v === "compare" && <span className="badge run">{t("chat.canvas.versions", { a: 2, b: 3 })}</span>}
          <div className="spacer" />
          {isCode && <button className="btn secondary chat-run" onClick={() => setOut(fx.output)}><Icon name="play" size={12} />{t("chat.canvas.run")}</button>}
          <Pop align="end" width={240} trigger={<button className="ibtn" aria-label={t("chat.canvas.history")}><Icon name="history" /></button>}>
            {(fx.versions as [number, string][]).map(([n, l], k) => { const num = k === 0 ? ver : n; return <MItem key={num} icon={num === ver ? "check" : "history"} onClick={() => num !== ver && setV("compare")}>{t("chat.canvas.version", { n: num })}<span className="sub"> · {l}</span></MItem>; })}
          </Pop>
          <IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(isCode ? fx.code : DOC.join("\n\n"))} />
          <Pop align="end" trigger={<button className="ibtn" aria-label={t("chat.canvas.export")}><Icon name="download" /></button>}>
            {formats.map((f) => <MItem key={f} icon="download" onClick={() => toast.add({ title: t("chat.canvas.exportReady"), description: `${head} · ${f}`, data: { icon: "download" } })}>{f}</MItem>)}
          </Pop>
          <IconBtn icon="close" label={t("chat.canvas.close")} />
        </div>
        {isCode ? (
          <div className="chat-code">
            <pre>{(fx.code as string).split("\n").map((l, i) => <div key={i}><span className="chat-ln">{i + 1}</span><code contentEditable suppressContentEditableWarning spellCheck={false}>{l || " "}</code></div>)}</pre>
            {out && <div className="chat-out"><span className="chat-meta">{t("chat.canvas.output")}</span><span className="mono">{out}</span><IconBtn icon="close" label={t("chat.canvas.closeOutput")} size={16} onClick={() => setOut("")} /></div>}
          </div>
        ) : (
          <div className="chat-doc" ref={docRef} onMouseUp={onUp} onKeyDown={(e) => e.key === "Escape" && setSel(null)} tabIndex={-1}>
            <article className="chat-doc-in">
              <h1 contentEditable={editable} suppressContentEditableWarning>{fx.h1}</h1>
              {v === "generation" ? <>
                {gen.shown.split("\n").map((p, i, a) => <p key={i}>{p}{gen.on && i === a.length - 1 && <span className="chat-caret" />}</p>)}
                {gen.on && <div className="chat-skel"><span className="skel line" /><span className="skel line" style={{ width: "86%" }} /><span className="skel line" style={{ width: "62%" }} /></div>}
              </> : v === "compare" ? <>
                <p>{DOC[0]}</p>
                <p>{fx.cmp.a}<del>{fx.cmp.del}</del><ins>{fx.cmp.ins}</ins>{fx.cmp.b}</p>
                <p><ins>{DOC[2]}</ins></p>
                <p><del>{fx.cmp.removed}</del></p>
                <p>{DOC[3]}</p>
              </> : <>
                <p contentEditable={editable} suppressContentEditableWarning>{DOC[0]}</p>
                {v === "selection" ? <p>{fx.selBefore}<mark ref={markRef} className="chat-mark" key={selText}>{selText}</mark>.</p>
                  : <p contentEditable={editable} suppressContentEditableWarning>{DOC[1]}</p>}
                {DOC.slice(2).map((p) => <p key={p} contentEditable={editable} suppressContentEditableWarning>{p}</p>)}
              </>}
            </article>
            {sel && !working && (
              <form className="chat-selbar popup" style={css({ "--selection-x": `${sel.x}px`, top: sel.y })} onSubmit={apply} onMouseUp={(e) => e.stopPropagation()}>
                <Icon name="sparkle-free" className="chat-i1" />
                <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={askPh} aria-label={askPh} autoFocus={v === "selection"} />
                <button className="send chat-mini" aria-label={t("chat.apply")} disabled={!ask.trim()} data-dim={!ask.trim() || undefined}><Icon name="arrow-up" size={16} /></button>
              </form>
            )}
          </div>
        )}
        {v === "compare" && <div className="chat-cmp-f"><span className="chat-meta"><span className="chat-sw ins" />{t("chat.canvas.added", { count: 2 })}<span className="chat-sw del" />{t("chat.canvas.removed", { count: 2 })}</span><div className="spacer" /><button className="btn secondary" onClick={() => toast.add({ title: t("chat.canvas.restored", { n: 2 }), data: { icon: "history", undo: true } })}>{t("chat.canvas.restore", { n: 2 })}</button><button className="btn primary" onClick={() => setV("document")}>{t("chat.canvas.keep", { n: 3 })}</button></div>}
      </div>
    </div>
  </>);
}
