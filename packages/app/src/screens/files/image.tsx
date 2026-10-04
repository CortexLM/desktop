import * as React from "react";
import { CortexApiError } from "@cortex/client";
import { api } from "../../api";
import { useI18n } from "../../i18n";
import { Icon, IconBtn } from "../../kit/ui";
import { navigation, readHash, useNav } from "../../shell/nav";
import { onEvent } from "../../state/live";
import { Upload } from "./docs";
import { ImageScreen, ZoomView } from "./media";
import { readRaster, rasterFilename } from "./raster";

type Target = { session: string; message: string; part: string };
type Failure = "unavailable" | "unsupported" | "invalid" | "tooLarge" | "load";
type ImageData = { url: string; blob: Blob; filename: string; downloadName: string; width: number; height: number };
type View = { state: "loading" } | { state: "error"; reason: Failure } | { state: "ready"; data: ImageData; downloading: boolean };
const fields = ["session", "message", "part"] as const;
function target(params: URLSearchParams): Target | null {
  const values = fields.map((key) => params.getAll(key));
  return values.every((v, i) => v.length === 1 && new RegExp(`^${["ses", "msg", "prt"][i]}_[0-9a-f]{32,}$`).test(v[0]))
    ? { session: values[0][0], message: values[1][0], part: values[2][0] } : null;
}

export function FileImage() {
  const { params } = useNav();
  const key = new URLSearchParams(fields.flatMap((field) => params.getAll(field).map((value) => [field, value]))).toString();
  // The complete tuple owns reads; shell theme/sidebar updates keep that same owner.
  const tuple = React.useMemo(() => target(new URLSearchParams(key)), [key]);
  if (params.has("preview") || params.has("shot")) return <ImageScreen />;
  if (fields.every((key) => !params.has(key))) return <Upload />;
  return <SavedImage key={key} tuple={tuple} />;
}

function useImage(tuple: Target | null) {
  const [view, setView] = React.useState<View>({ state: "loading" });
  const actions = React.useRef<{ reload: () => void; download: () => Promise<void> } | null>(null);
  React.useLayoutEffect(() => {
    if (!tuple) { setView({ state: "error", reason: "unavailable" }); return; }
    let mounted = true, active = false, deleted = false, seq = 0, url = "", probe: HTMLImageElement | null = null, ready: ImageData | null = null, downloading = false, reading = false;
    const permitted = () => {
      const route = readHash(), actual = target(route.params);
      return route.route === "file-image" && !route.params.has("preview") && !route.params.has("shot") && actual !== null && fields.every((key) => tuple[key] === actual[key]);
    };
    const clear = () => {
      seq++; ready = null; downloading = false; reading = false;
      if (probe) { probe.src = ""; probe = null; }
      if (url) { URL.revokeObjectURL(url); url = ""; }
    };
    const fail = (reason: Failure) => { clear(); if (mounted) setView({ state: "error", reason }); };
    const reload = () => {
      if (!mounted || !permitted() || deleted || reading) return;
      clear(); reading = true; const version = seq;
      const current = () => mounted && !deleted && seq === version && permitted();
      setView({ state: "loading" });
      void (async () => {
        try {
          const [session, history] = await Promise.all([api.sessions.get(tuple.session), api.sessions.messages(tuple.session)]);
          if (!current()) return;
          if (session.id !== tuple.session || session.kind !== "chat") { fail("unavailable"); return; }
          const message = history.find((m) => m.info.id === tuple.message && m.info.sessionID === tuple.session);
          const part = message?.parts.find((p) => p.id === tuple.part && p.messageID === tuple.message && p.sessionID === tuple.session && p.type === "file");
          if (!part || part.type !== "file") { fail("unavailable"); return; }
          const raster = readRaster(part);
          if (!raster.ok) { fail(raster.reason); return; }
          const blob = new Blob([raster.value.bytes], { type: raster.value.mime });
          url = URL.createObjectURL(blob); const image = new Image(); probe = image; image.src = url;
          try { await image.decode(); } catch { if (current()) fail("invalid"); return; }
          if (!current()) return;
          if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 32768 || image.naturalHeight > 32768 || image.naturalWidth * image.naturalHeight > 40000000) { fail("tooLarge"); return; }
          const downloadName = rasterFilename(part.filename, raster.value.mime);
          ready = { url, blob, filename: part.filename?.trim() || downloadName, downloadName, width: image.naturalWidth, height: image.naturalHeight };
          probe = null; image.src = ""; reading = false;
          setView({ state: "ready", data: ready, downloading: false });
        } catch (error) { if (current()) fail(error instanceof CortexApiError && error.status === 404 ? "unavailable" : "load"); }
      })();
    };
    const download = async () => {
      if (!mounted || deleted || !permitted() || !ready || downloading) return;
      const data = ready, version = seq; downloading = true; setView({ state: "ready", data, downloading: true });
      const current = () => mounted && !deleted && permitted() && seq === version && ready === data;
      try {
        const session = await api.sessions.get(tuple.session);
        if (!current()) return;
        if (session.id !== tuple.session || session.kind !== "chat") { fail("unavailable"); return; }
        const source = URL.createObjectURL(data.blob), link = document.createElement("a");
        // ponytail: downloads have no completion acknowledgement; retain their independent URL for one minute after handoff.
        setTimeout(() => URL.revokeObjectURL(source), 60000);
        link.href = source; link.download = data.downloadName; document.body.append(link);
        try { link.click(); } finally { link.remove(); }
      } catch (error) { if (current()) fail(error instanceof CortexApiError && error.status === 404 ? "unavailable" : "load"); }
      finally { if (current()) { downloading = false; setView({ state: "ready", data, downloading: false }); } }
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
    actions.current = { reload, download }; navigation.addEventListener("currententrychange", sync); sync();
    return () => { mounted = false; actions.current = null; off(); navigation.removeEventListener("currententrychange", sync); clear(); };
  }, [tuple]);
  return { view, reload: () => actions.current?.reload(), download: () => { void actions.current?.download(); } };
}

function SavedImage({ tuple }: { tuple: Target | null }) {
  const { t, locale } = useI18n(), image = useImage(tuple), { view } = image;
  const data = view.state === "ready" ? view.data : null;
  return <div className="medias-image-live">
    <div className="content-top medias-top">
      <span className="medias-fic" aria-hidden><Icon name="image" size={16} /></span>
      <span className="title"><span className="medias-name" tabIndex={data ? 0 : undefined}>{data?.filename ?? t("files.screen.file-image")}</span></span>
      <div className="spacer" />
      {data && <IconBtn icon="download" label={t("files.head.download")} disabled={view.state !== "ready" || view.downloading} onClick={image.download} />}
    </div>
    {data ? <div className="medias-body"><div className="medias-stage"><div className="medias-imgrow">
      <div className="medias-col"><ZoomView key={data.url} src={data.url} alt={data.filename} dimensions={{ width: data.width, height: data.height }} /></div>
      <aside className="medias-card medias-exif" aria-label={t("files.image.details")}>
        <h3>{t("files.image.details")}</h3>
        {[
          [t("files.image.dimensions"), t("files.image.dimensionsValue", { width: data.width.toLocaleString(locale), height: data.height.toLocaleString(locale) })],
          [t("files.image.format"), data.blob.type.slice(6).toUpperCase()],
          [t("files.image.fileSize"), t("files.image.byteSize", { n: data.blob.size.toLocaleString(locale) })],
        ].map(([label, value]) => <div className="medias-kv" key={label}><span>{label}</span><span>{value}</span></div>)}
      </aside>
    </div></div></div> : <div className="fichiers-state" role="status" aria-busy={view.state === "loading" || undefined}>
      <span className="fichiers-badge" aria-hidden><Icon name={view.state === "loading" ? "image" : "alert-triangle"} /></span>
      <h2>{t(view.state === "error" ? `files.image.${view.reason}Title` : "files.image.loading")}</h2>
      {view.state === "error" && <p>{t(`files.image.${view.reason}Text`)}</p>}
      {view.state === "error" && view.reason === "load" && <button className="btn secondary" onClick={image.reload}>{t("files.retry")}</button>}
    </div>}
  </div>;
}
