// Components page: every kit component, live, in the current theme.
import * as React from "react";
import { Icon, Gel, IconBtn, Row, Section, Segmented, Switch, ProgressCard, ModeSwitcher, Pop, MItem, MSep, Tip, useToast, type Mode } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { useFx } from "./common";

// Fine-line isometric "Hairline" illustration (same drawing as the Bot screens).
const Hairline = ({ size = 160 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 160 160" fill="none" stroke="var(--t2)" strokeWidth="0.75" strokeLinejoin="round" aria-hidden>
    <path d="M80 118 128 92 80 66 32 92Z" /><path d="M32 92v6l48 26 48-26v-6" /><path d="M80 118v6" />
    <path d="M80 34 112 51v36L80 104 48 87V51Z" /><path d="M48 51l32 17 32-17M80 68v36" />
    <path d="M60 70v8M68 74v8" strokeWidth="1.5" strokeLinecap="round" stroke="var(--t1)" />
    <path d="M80 34V22" /><circle cx="80" cy="19" r="3" />
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${44 + i * 12} ${100 + i * 6}l${48} -26`} strokeDasharray="1 3" opacity=".6" />)}
  </svg>
);

const Block = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="cblock">
    <div className="cblock-head"><span>{title}</span>{note && <span className="mono">{note}</span>}</div>
    <div className="cblock-body">{children}</div>
  </section>
);

const MOTIONS = ["iconBtn", "row", "seg", "menu", "mode", "theme", "send", "switch", "steps", "slide", "toast", "sidebar"];
const ICON_BUTTONS: [string, string][] = [
  ["compose", "shell.nav.newChat"], ["search", "shell.search"], ["bell", "shell.notifications"], ["share", "shell.share"],
  ["copy", "common.copy"], ["refresh", "chat.refresh"], ["settings", "shell.settings"], ["more-dots", "shell.nav.options"],
];
const ICONS: [string, string][] = [
  ["home", "shell.rail.home"], ["projects", "shell.nav.projects"], ["history", "shell.rail.history"], ["bot", "system.comp.yourBot"],
  ["compose", "shell.nav.newChat"], ["search", "shell.search"], ["bell", "shell.notifications"], ["folder", "system.icon.folder"],
  ["folder-open", "system.icon.folder"], ["folder-code", "shell.code.repos"], ["git-branch", "code.terminal.kvBranch"], ["pull-request", "code.screen.code-pr"],
  ["terminal", "bots.symbol.terminal"], ["cpu", "shell.code.thisMac"], ["mail", "system.icon.mail"], ["calendar", "system.icon.calendar"],
  ["file", "files.screen.file-docx"], ["globe", "system.icon.globe"], ["mic", "composer.dictate"], ["voice-wave", "composer.voice"],
  ["paperclip", "composer.addFiles"], ["image", "system.icon.image"], ["copy", "common.copy"], ["trash", "common.delete"],
  ["edit", "system.edit"], ["pin", "system.comp.pin"], ["settings", "shell.settings"], ["sun", "shell.themeLight"],
  ["moon", "shell.themeDark"], ["system", "shell.themeSystem"], ["check", "system.key.confirm"], ["close", "common.close"],
];

export function ComponentsScreen() {
  const t = useT();
  const toast = useToast();
  const fx = useFx();
  const [seg, setSeg] = React.useState(t("shell.tab.chat"));
  const [mode, setMode] = React.useState<Mode>("Cortex");
  const [sw, setSw] = React.useState(true);
  const c = (k: string) => t(`system.comp.${k}`);
  return (<>
    <div className="content-top"><span className="title">{c("title")}</span><div className="spacer" /><span className="mono" style={{ color: "var(--t3)" }}>{c("fonts")}</span></div>
    <div className="page cgrid">
      <Block title={c("iconBtns")} note={c("iconBtnsNote")}>
        {ICON_BUTTONS.map(([i, label]) => <IconBtn key={i} icon={i} label={t(label)} />)}
        <IconBtn icon="arrow-right" label={c("disabled")} disabled />
      </Block>
      <Block title={c("rail")} note={c("railNote")}>
        <div className="rail" style={{ padding: 0, flexDirection: "row", width: "auto" }}>
          <button className="rail-btn" data-active aria-label={t("shell.rail.home")}><Icon name="home" size={18} /></button>
          <button className="rail-btn" aria-label={t("shell.rail.library")}><Icon name="projects" size={18} /></button>
          <button className="rail-btn" aria-label={t("shell.rail.history")}><Icon name="history" size={18} /></button>
          <button className="rail-btn" aria-label={t("shell.rail.bots")}><Icon name="bot" size={18} /></button>
          <div className="avatar-dot" style={{ margin: 0 }}>{isPreview() ? fx.user?.initials : <Icon name="user" size={14} />}</div>
        </div>
      </Block>
      <Block title={c("buttons")} note={c("buttonsNote")}>
        <button className="btn primary">{t("system.onb.continue")}<Icon name="arrow-right" /></button>
        <button className="btn secondary">{t("system.back")}</button>
        <button className="btn primary" disabled>{c("createPr")}</button>
      </Block>
      <Block title={c("segmented")} note={c("segmentedNote")}>
        <Segmented items={[t("shell.tab.chat"), t("shell.tab.work")]} value={seg} onChange={setSeg} />
        <Segmented items={[c("changes"), c("terminal")]} value={c("changes")} onChange={() => {}} />
      </Block>
      <Block title={c("modeSwitcher")} note={c("modeSwitcherNote")}>
        <ModeSwitcher mode={mode} onMode={setMode} />
      </Block>
      <Block title={c("rows")} note={c("rowsNote")}>
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 2 }}>
          <Section title={t("shell.nav.projects")} action={<IconBtn icon="plus" label={t("shell.nav.newProject")} />} />
          <Row label={t("shell.nav.newChat")} icon="compose" />
          <Row label={c("yourBot")} icon="bot" meta={c("active")} status="green" active />
          <Row label={t("shell.nav.webSearch")} gel="recherche-web" />
          <Row label={c("sampleProject")} icon="folder-open" strong />
          <Row label={c("sampleChat")} child actions={<IconBtn icon="more-dots" label={t("shell.nav.options")} />} />
          <Row label={c("showMore")} child dim />
        </div>
      </Block>
      <Block title={c("composer")} note={c("composerNote")}>
        <div style={{ width: "100%" }}><Composer /></div>
      </Block>
      <Block title={c("gels")} note={c("gelsNote")}>
        {["recherche-web", "documents", "images", "automatisations", "bot", "code", "donnees"].map((g) => <Gel key={g} name={g} size={24} />)}
      </Block>
      <Block title={c("icons")} note={c("iconsNote")}>
        <div className="icons">{ICONS.map(([i, label]) => <Tip key={i} label={t(label)}><span className="icell"><Icon name={i} /></span></Tip>)}</div>
      </Block>
      <Block title={c("menu")} note={c("menuNote")}>
        <Pop trigger={<button className="btn secondary">{c("openMenu")}<Icon name="chevron-down" size={12} /></button>}>
          <MItem icon="edit" kbd="⌘R">{t("system.rename")}</MItem><MItem icon="pin">{c("pin")}</MItem><MSep /><MItem icon="trash" danger>{t("system.common.delete")}</MItem>
        </Pop>
        <Tip label={c("tooltip")} kbd="⌘K"><button className="btn secondary">{c("tooltip")}</button></Tip>
      </Block>
      <Block title={c("switchBadges")}>
        <Switch checked={sw} onCheckedChange={setSw} aria-label={c("example")} />
        <span className="badge ok">{c("done")}</span><span className="badge run"><span className="spin" />{c("running")}</span><span className="badge wait">{c("review")}</span><span className="badge err">{c("failed")}</span>
        <button className="bot-pill" data-on><i />{c("active")}</button>
      </Block>
      <Block title={c("fields")}>
        <input className="input" placeholder={c("botName")} style={{ width: 220 }} />
        <button className="chip" data-pressed>{t("system.search.k.all")}</button><button className="chip">{t("system.search.k.files")}</button>
      </Block>
      <Block title={c("progress")}>
        <div style={{ width: 260 }}><ProgressCard label={t("shell.gettingStarted")} done={2} total={5} /></div>
        <button className="btn secondary" onClick={() => toast.add({ title: c("toastTitle"), description: c("sampleChat"), data: { undo: true, icon: "trash" } })}>{c("showToast")}</button>
      </Block>
      <Block title={c("botIllustration")}>
        <div className="orb" /><Hairline size={96} /><span className="typing"><i /><i /><i /></span>
      </Block>
      <section className="cblock" style={{ gridColumn: "1 / -1" }}>
        <div className="cblock-head"><span>{c("micro")}</span><span className="mono">{c("microRef")}</span></div>
        <div className="list" style={{ boxShadow: "none", borderRadius: 0, background: "none" }}>
          {MOTIONS.map((k) => <div key={k} className="li"><span style={{ width: 200, fontWeight: 500 }}>{t(`system.motion.${k}.name`)}</span><span className="grow sub">{t(`system.motion.${k}.desc`)}</span><span className="mono" style={{ width: 150 }}>{t(`system.motion.${k}.time`)}</span><span className="mono" style={{ width: 150, color: "var(--t2)", whiteSpace: "nowrap" }}>{t(`system.motion.${k}.ease`)}</span></div>)}
        </div>
      </section>
    </div>
  </>);
}
