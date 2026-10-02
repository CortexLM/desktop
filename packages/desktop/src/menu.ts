// Native application menu. Labels come from the i18n catalogs; commands are forwarded to the renderer.
import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";
import type { T } from "@cortex/i18n";

export function buildMenu(t: T, win: () => BrowserWindow | undefined, appName: string) {
  const send = (cmd: string) => () => win()?.webContents.send("cortex:menu", cmd);
  const mac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ label: appName, submenu: [
      { label: t("menu.about", { app: appName }), click: send("about") },
      { type: "separator" as const },
      { label: t("menu.settings"), accelerator: "CmdOrCtrl+,", click: send("settings") },
      { type: "separator" as const },
      { role: "services" as const, label: t("menu.services") },
      { type: "separator" as const },
      { role: "hide" as const, label: t("menu.hide", { app: appName }) },
      { role: "hideOthers" as const, label: t("menu.hideOthers") },
      { role: "unhide" as const, label: t("menu.showAll") },
      { type: "separator" as const },
      { role: "quit" as const, label: t("menu.quit", { app: appName }) },
    ] }] : []),
    { label: t("menu.file"), submenu: [
      { label: t("menu.newChat"), accelerator: "CmdOrCtrl+N", click: send("new") },
      { label: t("menu.upload"), accelerator: "CmdOrCtrl+U", click: send("upload") },
      { type: "separator" },
      mac ? { role: "close", label: t("menu.closeWindow") } : { role: "quit", label: t("menu.quit", { app: appName }) },
    ] },
    { label: t("menu.edit"), submenu: [
      { role: "undo", label: t("menu.undo") }, { role: "redo", label: t("menu.redo") }, { type: "separator" },
      { role: "cut", label: t("menu.cut") }, { role: "copy", label: t("menu.copy") }, { role: "paste", label: t("menu.paste") },
      { role: "selectAll", label: t("menu.selectAll") },
    ] },
    { label: t("menu.view"), submenu: [
      { label: t("menu.toggleSidebar"), accelerator: "CmdOrCtrl+B", click: send("sidebar") },
      { label: t("menu.focusMode"), accelerator: "CmdOrCtrl+\\", click: send("focus") },
      { label: t("menu.commandPalette"), accelerator: "CmdOrCtrl+K", click: send("command") },
      { type: "separator" },
      { label: t("menu.back"), accelerator: "CmdOrCtrl+[", click: send("back") },
      { label: t("menu.forward"), accelerator: "CmdOrCtrl+]", click: send("forward") },
      { type: "separator" },
      { role: "resetZoom", label: t("menu.actualSize") }, { role: "zoomIn", label: t("menu.zoomIn") }, { role: "zoomOut", label: t("menu.zoomOut") },
      // AppKit inserts its own full-screen command on macOS (electron/electron#49048).
      ...(!mac ? [{ type: "separator" as const }, { role: "togglefullscreen" as const, label: t("menu.fullScreen") }] : []),
    ] },
    { label: t("menu.go"), submenu: [
      { label: t("menu.goChat"), click: send("home") },
      { label: t("menu.goWork"), click: send("work-home") },
      { label: t("menu.goCode"), click: send("code") },
      { label: t("menu.goBots"), click: send("bot-roster") },
      { label: t("menu.goSpace"), enabled: false },
      { label: t("menu.goScheduled"), enabled: false },
      { label: t("menu.goPlugins"), enabled: false },
      { label: t("menu.goLibrary"), click: send("library") },
    ] },
    { role: "windowMenu", label: t("menu.window") },
    { role: "help", label: t("menu.help"), submenu: [
      { label: t("menu.shortcuts"), accelerator: "CmdOrCtrl+/", click: send("shortcuts") },
      { label: t("menu.gallery"), click: send("gallery") },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
