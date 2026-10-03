// Files area: document and media viewers plus the upload screen.
import type * as React from "react";
import type { ScreenDef } from "../../registry";
import { isPreview } from "../../preview";
import { FilePdf, FilePptx, FileDocx, FileXlsx, Upload } from "./docs";
import { CodeScreen, AudioScreen, VideoScreen, ZipScreen } from "./media";
import { FileImage } from "./image";
import "./files.css";

// ponytail: remaining formats await real readers; saved local Chat rasters use FileImage.
const viewer = (C: () => React.ReactNode) => () => (isPreview() ? <C /> : <Upload />);
const base = { mode: "Cortex" as const, group: "files.group" };

export const SCREENS: ScreenDef[] = [
  { ...base, id: "file-pdf", name: "files.screen.file-pdf", render: viewer(FilePdf), variants: [
    ["reading", "files.variant.reading", "lecture"], ["loading", "files.variant.loading", "chargement"], ["search", "files.variant.search", "recherche"],
    ["selection", "files.variant.selection", "selection"], ["summary", "files.variant.summary", "resume"], ["protected", "files.variant.protected", "protege"], ["corrupt", "files.variant.corrupt", "corrompu"]] },
  { ...base, id: "file-pptx", name: "files.screen.file-pptx", render: viewer(FilePptx), variants: [
    ["editing", "files.variant.editing", "edition"], ["presenting", "files.variant.presenting", "presentation"], ["grid", "files.variant.grid", "grille"], ["converting", "files.variant.converting", "conversion"]] },
  { ...base, id: "file-docx", name: "files.screen.file-docx", render: viewer(FileDocx), variants: [
    ["reading", "files.variant.reading", "lecture"], ["tracked", "files.variant.tracked", "suivi"], ["comments", "files.variant.comments", "commentaires"]] },
  { ...base, id: "file-xlsx", name: "files.screen.file-xlsx", render: viewer(FileXlsx), variants: [
    ["data", "files.variant.data", "donnees"], ["range", "files.variant.range", "plage"], ["chart", "files.variant.chart", "graphique"], ["errors", "files.variant.importErrors", "erreurs"]] },
  { ...base, id: "upload", name: "files.screen.upload", render: () => <Upload />, variants: [
    ["empty", "files.variant.empty", "vide"], ["dragging", "files.variant.dragging", "glisser"], ["uploading", "files.variant.uploading", "encours"], ["done", "files.variant.done", "termine"], ["errors", "files.variant.errors", "erreurs"]] },
  { ...base, id: "file-image", name: "files.screen.file-image", render: () => <FileImage />, variants: [
    ["view", "files.variant.view", "affichage"], ["zoom", "files.variant.zoom", "zoom"], ["compare", "files.variant.compare", "comparaison"]] },
  { ...base, id: "file-code", name: "files.screen.file-code", render: viewer(CodeScreen), variants: [
    ["view", "files.variant.view", "affichage"], ["diff", "files.variant.diff", "diff"]] },
  { ...base, id: "file-audio", name: "files.screen.file-audio", render: viewer(AudioScreen), variants: [
    ["playing", "files.variant.playing", "lecture"], ["transcribing", "files.variant.transcribing", "transcription"]] },
  { ...base, id: "file-video", name: "files.screen.file-video", render: viewer(VideoScreen), variants: [
    ["playing", "files.variant.playing", "lecture"], ["paused", "files.variant.paused", "pause"]] },
  { ...base, id: "file-zip", name: "files.screen.file-zip", render: viewer(ZipScreen), variants: [
    ["tree", "files.variant.tree", "arborescence"], ["extracting", "files.variant.extracting", "extraction"]] },
];
