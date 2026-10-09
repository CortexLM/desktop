import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Menu } from "@base-ui/react/menu";
import { Tabs } from "@base-ui/react/tabs";
import { Switch as BSwitch } from "@base-ui/react/switch";
import { Toast } from "@base-ui/react/toast";
import { Icon, Gel } from "../icons/Icon";
import { useT } from "../i18n";

// The existing Settings switch persists this device preference in its change callback.
function syncReducedMotion() {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-reduce-motion", localStorage.getItem("cortex.pref.appearance.reduceMotion") === "true");
}
syncReducedMotion();
if (typeof document !== "undefined") window.addEventListener("storage", (event) => {
  if (event.key === "cortex.pref.appearance.reduceMotion" || event.key === null) syncReducedMotion();
});
const reducedMotion = () => document.documentElement.hasAttribute("data-reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

export { Icon, Gel };

export function Tip({ label, kbd, children, side = "bottom" }: { label: string; kbd?: string; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={6}>
          <Tooltip.Popup className="tip">{label}{kbd && <kbd>{kbd}</kbd>}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const IconBtn = React.forwardRef<HTMLButtonElement, { icon: string; label: string; kbd?: string; size?: number; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ icon, label, kbd, size = 16, className = "", ...p }, ref) => (
    <Tip label={label} kbd={kbd}>
      <button ref={ref} className={"ibtn " + className} aria-label={label} {...p}><Icon name={icon} size={size} /></button>
    </Tip>
  ),
);

export function Row({ label, icon, gel, lead, active, child, dim, strong, meta, status, onClick, actions }: {
  label: string; icon?: string; gel?: string; lead?: React.ReactNode; active?: boolean; child?: boolean; dim?: boolean; strong?: boolean; meta?: string; status?: string; onClick?: () => void; actions?: React.ReactNode;
}) {
  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }} className="row" data-active={active || undefined} data-child={child || undefined} data-dim={dim || undefined} data-strong={strong || undefined} onClick={onClick}>
      {lead ? lead : gel ? <Gel name={gel} /> : icon ? <Icon name={icon} className="ic" /> : null}
      <span className="label">{label}</span>
      {meta && <span className="meta">{meta}</span>}
      {status && <span className="dot"><i style={{ background: `var(--${status})` }} /></span>}
      {actions && <span className="row-actions" onClick={(e) => e.stopPropagation()}>{actions}</span>}
    </div>
  );
}

export const Section = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <div className="sb-section"><span>{title}</span>{action}</div>
);

export function Segmented({ items, value: external, onChange, resetKey }: { items: string[]; value: string; onChange: (v: string) => string | void; resetKey?: string }) {
  const [value, setValue] = React.useState(external);
  const pending = React.useRef<number | undefined>(undefined);
  const committed = React.useRef(external);
  const requested = React.useRef<{ value: string; key?: string } | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(pending.current), []);
  React.useEffect(() => {
    const ownCommit = external === requested.current?.value && resetKey === requested.current?.key;
    committed.current = external; requested.current = undefined;
    // A previous selection may commit while a newer choice is still animating.
    if (ownCommit && pending.current !== undefined) return;
    clearTimeout(pending.current); pending.current = undefined; setValue(external);
  }, [external, resetKey]);
  const list = React.useRef<HTMLDivElement>(null);
  const ind = React.useRef<HTMLSpanElement>(null);
  const placed = React.useRef(false);
  React.useLayoutEffect(() => {
    const l = list.current, i = ind.current; if (!l || !i) return;
    const to = [...l.querySelectorAll<HTMLElement>(".seg-tab")].find((tab) => tab.dataset.value === value);
    if (!to) return;
    const end = { translate: `${to.offsetLeft}px 0`, width: `${to.offsetWidth}px` };
    if (!placed.current || reducedMotion()) { placed.current = true; Object.assign(i.style, end); return; }
    const from = i.getBoundingClientRect(), parent = l.getBoundingClientRect();
    const left = Math.min(from.left - parent.left, to.offsetLeft), right = Math.max(from.right - parent.left, to.offsetLeft + to.offsetWidth);
    let cancelled = false;
    const stretch = i.animate([{ translate: `${left}px 0`, width: `${right - left}px` }], { duration: 190, easing: "cubic-bezier(0.32,0.72,0.24,1)", fill: "forwards" });
    stretch.finished.then(async () => {
      if (cancelled) return;
      const settle = i.animate([end], { duration: 420, easing: "cubic-bezier(0.28,1.28,0.36,1)", fill: "forwards" });
      await settle.finished;
      if (!cancelled) { Object.assign(i.style, end); stretch.cancel(); settle.cancel(); }
    }).catch(() => {});
    return () => {
      cancelled = true;
      const current = getComputedStyle(i);
      Object.assign(i.style, { translate: current.translate, width: current.width });
      i.getAnimations().forEach((a) => a.cancel());
    };
  }, [value]);
  return (
    <Tabs.Root value={value} onValueChange={(v) => {
      const next = v as string;
      setValue(next); clearTimeout(pending.current);
      const commit = () => {
        pending.current = undefined;
        if (next !== (requested.current?.value ?? committed.current)) requested.current = { value: next, key: onChange(next) ?? undefined };
      };
      if (reducedMotion()) commit();
      else pending.current = window.setTimeout(commit, 610);
    }}>
      <Tabs.List className="seg" ref={list}>
        {items.map((t) => <Tabs.Tab key={t} value={t} data-value={t} className="seg-tab">{t}</Tabs.Tab>)}
        <span className="seg-ind" ref={ind} aria-hidden />
      </Tabs.List>
    </Tabs.Root>
  );
}

export function Switch(p: { checked?: boolean; defaultChecked?: boolean; disabled?: boolean; onCheckedChange?: (v: boolean) => void; "aria-label"?: string }) {
  return <BSwitch.Root className="switch" {...p} onCheckedChange={(checked) => {
    p.onCheckedChange?.(checked);
    syncReducedMotion();
  }}><BSwitch.Thumb className="switch-thumb" /></BSwitch.Root>;
}

export function ProgressCard({ label, done, total, onClick }: { label: string; done: number; total: number; onClick?: () => void }) {
  const t = useT();
  const L = 2 * Math.PI * 7;
  return (
    <button className="progress-card" onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--subtle)" strokeWidth="2" />
        <circle className="val" cx="9" cy="9" r="7" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(L * done) / total} ${L}`} transform="rotate(-90 9 9)" /></svg>
      <span>{label}</span><span className="count">{t("common.progressCount", { done, total })}</span>
    </button>
  );
}

export function Pop({ trigger, children, align = "start", side = "bottom", width }: { trigger: React.ReactElement; children: React.ReactNode; align?: "start" | "center" | "end"; side?: "top" | "bottom"; width?: number }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align={align} side={side}>
          <Menu.Popup className="popup" style={{ width }}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
export const MItem = ({ icon, children, kbd, onClick, danger }: { icon?: string; children: React.ReactNode; kbd?: string; onClick?: () => void; danger?: boolean }) => (
  <Menu.Item className={"mitem" + (danger ? " danger" : "")} onClick={onClick}>{icon && <Icon name={icon} />}<span>{children}</span>{kbd && <kbd>{kbd}</kbd>}</Menu.Item>
);
export const MSep = () => <Menu.Separator className="msep" />;

export type Mode = "Cortex" | "Cortex Code";
export const MODE_IMG: Record<Mode, string> = { Cortex: "/img/lagon.png", "Cortex Code": "/img/aube.png" };
export function ModeSwitcher({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const t = useT();
  const ring = React.useRef<HTMLSpanElement>(null);
  const opts: [Mode, string][] = [["Cortex", t("shell.mode.cortexHint")], ["Cortex Code", t("shell.mode.codeHint")]];
  return (
    <Menu.Root>
      <Menu.Trigger className="mode-trigger" onPointerDown={(e) => {
        if (reducedMotion()) return;
        e.currentTarget.getAnimations().forEach((animation) => { if (!(animation instanceof CSSTransition)) animation.cancel(); });
        e.currentTarget.animate([{ scale: 1 }, { scale: .97 }, { scale: 1 }], { duration: 260, easing: "cubic-bezier(.3,.9,.4,1)" });
        ring.current?.getAnimations().forEach((animation) => animation.cancel());
        ring.current?.animate([{ scale: .75, opacity: 1 }, { opacity: 1, offset: .6 }, { scale: 1.6, opacity: 0 }], { duration: 380, easing: "linear" });
      }}>
        <span className="mode-avatar" style={{ backgroundImage: `url(${MODE_IMG[mode]})` }} />
        <span className="mode-name">{mode}</span>
        <Icon name="chevron-down" size={12} className="mode-chev" />
        <span className="mode-ring" ref={ring} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" alignOffset={0}>
          <Menu.Popup className="popup" style={{ width: 259 }}>
            <Menu.RadioGroup value={mode} onValueChange={(v) => onMode(v as Mode)}>
              {opts.map(([m, s]) => (
                <Menu.RadioItem key={m} value={m} closeOnClick className="mitem" style={{ padding: "8px 10px" }}>
                  <span className="mode-avatar" style={{ width: 20, height: 20, borderRadius: 6, backgroundImage: `url(${MODE_IMG[m]})` }} />
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontWeight: 500 }}>{m}</span><span className="sub">{s}</span></span>
                  <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function Banner({ tone = "info", children, action }: { tone?: "info" | "warn" | "err"; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className={`banner ${tone}`} role={tone === "err" ? "alert" : "status"}><span className="grow">{children}</span>{action}</div>;
}

export const useToast = () => Toast.useToastManager();
export function Toasts() {
  const tr = useT();
  const { toasts, close } = Toast.useToastManager();
  return (
    <Toast.Portal><Toast.Viewport className="toasts">
      {toasts.map((t) => (
        <Toast.Root key={t.id} toast={t} className="toast">
          <Icon name={(t.data as { icon?: string })?.icon ?? "check-circle"} />
          <div className="t-body"><Toast.Title className="t-title" /><Toast.Description className="t-desc" /></div>
          {(t.data as { undo?: boolean })?.undo && <Toast.Action className="undo" onClick={() => { (t.data as { onUndo?: () => void })?.onUndo?.(); close(t.id); }}>{tr("common.undo")}<span className="burn" /></Toast.Action>}
        </Toast.Root>
      ))}
    </Toast.Viewport></Toast.Portal>
  );
}
