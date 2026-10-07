import * as React from "react";
import { CortexApiError } from "@cortex/client";
import { api } from "../../api";
import { useI18n } from "../../i18n";
import { Icon, IconBtn } from "../../kit/ui";
import { navigation, readHash, useNav } from "../../shell/nav";
import { onEvent } from "../../state/live";
import { LiveFile } from "./live";
import { CodeScreen } from "./media";
import { readText, textFilename, type SavedText } from "./text-data";

type Target = { session: string; message: string; part: string };
type Failure = "unavailable" | "unsupported" | "invalid" | "tooLarge" | "load";
type TextData = Omit<SavedText, "bytes"> & { blob: Blob; filename: string; downloadName: string };
type CopyStatus = "success" | "failed" | null;
type View = { state: "loading" } | { state: "error"; reason: Failure } | { state: "ready"; data: TextData; pending: boolean; copy: CopyStatus };
const fields = ["session", "message", "part"] as const;
function target(params: URLSearchParams): Target | null {
  const values = fields.map((key) => params.getAll(key));
  return values.every((v, i) => v.length === 1 && new RegExp(`^${["ses", "msg", "prt"][i]}_[0-9a-f]{32,}$`).test(v[0]))
    ? { session: values[0][0], message: values[1][0], part: values[2][0] } : null;
}

export function FileText() {
  const { params } = useNav();
  const key = new URLSearchParams(fields.flatMap((field) => params.getAll(field).map((value) => [field, value]))).toString();
  // The complete tuple owns reads; shell theme/sidebar updates keep that same owner.
  const tuple = React.useMemo(() => target(new URLSearchParams(key)), [key]);
  if (params.has("preview") || params.has("shot")) return <CodeScreen />;
  if (fields.every((key) => !params.has(key))) return <LiveFile kind="code" screen="file-code" />;
  return <SavedTextView key={key} tuple={tuple} />;
}

function useText(tuple: Target | null) {
  const [view, setView] = React.useState<View>({ state: "loading" });
  const actions = React.useRef<{ reload: () => void; act: (kind: "copy" | "download") => Promise<void> } | null>(null);
  React.useLayoutEffect(() => {
    if (!tuple) { setView({ state: "error", reason: "unavailable" }); return; }
    let mounted = true, active = false, deleted = false, seq = 0, ready: TextData | null = null, pending = false, reading = false;
    const permitted = () => {
      const route = readHash(), actual = target(route.params);
      return route.route === "file-code" && !route.params.has("preview") && !route.params.has("shot") && actual !== null && fields.every((key) => tuple[key] === actual[key]);
    };
    const clear = () => { seq++; ready = null; pending = false; reading = false; };
    const fail = (reason: Failure) => { clear(); if (mounted) setView({ state: "error", reason }); };
    const reload = () => {
      if (!mounted || !active || !permitted() || deleted || reading) return;
      clear(); reading = true; const version = seq;
      const current = () => mounted && active && !deleted && seq === version && permitted();
      setView({ state: "loading" });
      void (async () => {
        try {
          const [session, history] = await Promise.all([api.sessions.get(tuple.session), api.sessions.messages(tuple.session)]);
          if (!current()) return;
          if (session.id !== tuple.session || session.kind !== "chat") { fail("unavailable"); return; }
          const message = history.find((m) => m.info.id === tuple.message && m.info.sessionID === tuple.session);
          const part = message?.parts.find((p) => p.id === tuple.part && p.messageID === tuple.message && p.sessionID === tuple.session && p.type === "file");
          if (!part || part.type !== "file") { fail("unavailable"); return; }
          const text = readText(part);
          if (!text.ok) { fail(text.reason); return; }
          const { bytes, ...data } = text.value, downloadName = textFilename(part.filename, data.mime);
          ready = { ...data, blob: new Blob([bytes], { type: data.mime }), filename: part.filename?.trim() || downloadName, downloadName };
          reading = false; setView({ state: "ready", data: ready, pending: false, copy: null });
        } catch (error) { if (current()) fail(error instanceof CortexApiError && error.status === 404 ? "unavailable" : "load"); }
      })();
    };
    const act = async (kind: "copy" | "download") => {
      if (!mounted || !active || deleted || !permitted() || !ready || pending) return;
      const data = ready, version = seq; pending = true; setView({ state: "ready", data, pending: true, copy: null });
      const current = () => mounted && active && !deleted && permitted() && seq === version && ready === data;
      let copy: CopyStatus = null;
      try {
        const session = await api.sessions.get(tuple.session);
        if (!current()) return;
        if (session.id !== tuple.session || session.kind !== "chat") { fail("unavailable"); return; }
        if (kind === "copy") {
          // An already-dispatched clipboard write cannot be revoked by later navigation.
          try { await navigator.clipboard.writeText(data.text); copy = "success"; }
          catch { copy = "failed"; }
        } else {
          const source = URL.createObjectURL(data.blob), link = document.createElement("a");
          // ponytail: downloads have no completion acknowledgement; retain their independent URL for one minute after handoff.
          setTimeout(() => URL.revokeObjectURL(source), 60000);
          link.href = source; link.download = data.downloadName; document.body.append(link);
          try { link.click(); } finally { link.remove(); }
        }
      } catch (error) { if (current()) fail(error instanceof CortexApiError && error.status === 404 ? "unavailable" : "load"); }
      finally { if (current()) { pending = false; setView({ state: "ready", data, pending: false, copy }); } }
    };
    const sync = () => {
      const next = permitted(); if (next === active) return;
      active = next; clear();
      if (deleted) setView({ state: "error", reason: "unavailable" });
      else if (active) reload();
      else setView({ state: "loading" });
    };
    const off = onEvent((event) => {
      if (event.type === "session.deleted" && event.properties.sessionID === tuple.session) { deleted = true; fail("unavailable"); }
      else if (!deleted && event.type === "part.updated" && event.properties.part.sessionID === tuple.session && event.properties.part.messageID === tuple.message && event.properties.part.id === tuple.part) {
        clear(); setView({ state: "loading" }); reload();
      }
    });
    actions.current = { reload, act }; navigation.addEventListener("currententrychange", sync); sync();
    return () => { mounted = false; actions.current = null; off(); navigation.removeEventListener("currententrychange", sync); clear(); };
  }, [tuple]);
  return { view, reload: () => actions.current?.reload(), copy: () => { void actions.current?.act("copy"); }, download: () => { void actions.current?.act("download"); } };
}

function SavedTextView({ tuple }: { tuple: Target | null }) {
  const { t, locale } = useI18n(), text = useText(tuple), { view } = text;
  const data = view.state === "ready" ? view.data : null;
  const gutter = React.useMemo(() => Array.from({ length: data?.lines ?? 0 }, (_, i) => String(i + 1)).join("\n"), [data?.lines]);
  return <div className="medias-text-live">
    <div className="content-top medias-top">
      <span className="medias-fic" aria-hidden><Icon name="file-code" size={16} /></span>
      <span className="title"><span className="medias-name" tabIndex={data ? 0 : undefined}>{data?.filename ?? t("files.text.title")}</span></span>
      <div className="spacer" />
      {data && <IconBtn icon="download" label={t("files.head.download")} disabled={view.state !== "ready" || view.pending} onClick={text.download} />}
    </div>
    {data ? <div className="medias-body"><div className="medias-stage">
      <div className="medias-bar">
        <span className="medias-meta">{t(data.mime === "text/markdown" ? "files.text.markdownSource" : "files.text.plainText")}</span>
        <span className="medias-meta">{t(data.bom ? "files.text.utf8Bom" : "files.text.utf8")}</span>
        <span className="medias-meta">{t("files.text.lines", { count: data.lines })}</span>
        <span className="medias-meta">{t("files.image.byteSize", { n: data.blob.size.toLocaleString(locale) })}</span>
        <div className="medias-grow" />
        <IconBtn icon="copy" label={t("files.text.copy")} disabled={view.state !== "ready" || view.pending} onClick={text.copy} />
        <span className="medias-meta medias-text-status" role="status">{view.state === "ready" && view.copy && t(view.copy === "success" ? "files.text.copySuccess" : "files.text.copyFailed")}</span>
      </div>
      <div className="medias-text-scroll" role="region" aria-label={t("files.code.contents", { name: data.filename })} tabIndex={0}>
        <pre className="medias-text-gutter" aria-hidden>{gutter}</pre>
        <pre className="medias-text-source">{data.display}</pre>
        {data.lines === 0 && <p className="medias-text-empty">{t("files.text.empty")}</p>}
      </div>
    </div></div> : <div className="fichiers-state" role="status" aria-busy={view.state === "loading" || undefined}>
      <span className="fichiers-badge" aria-hidden><Icon name={view.state === "loading" ? "file-code" : "alert-triangle"} /></span>
      <h2>{t(view.state === "error" ? `files.text.${view.reason}Title` : "files.text.loading")}</h2>
      {view.state === "error" && <p>{t(`files.text.${view.reason}Text`)}</p>}
      {view.state === "error" && view.reason === "load" && <button className="btn secondary" onClick={text.reload}>{t("files.retry")}</button>}
    </div>}
  </div>;
}
