// Header model picker for signed-in Chat: the current model, a popover of the
// discovered catalogue with capability badges, and reasoning effort when it applies.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import type { RemoteModel } from "@cortex/schema";
import { Icon } from "../../icons/Icon";
import { useI18n } from "../../i18n";

export type Effort = "low" | "medium" | "high";
const EFFORTS = ["low", "medium", "high"] as const;

type Props = {
  models: RemoteModel[];
  /** Selected slug; in an existing chat, "" means the chat's own model. */
  value: string;
  onValue: (slug: string) => void;
  recorded?: { name: string };
  effort?: Effort;
  onEffort?: (effort: Effort) => void;
  disabled?: boolean;
};

export function RemoteModelMenu({ models, value, onValue, recorded, effort, onEffort, disabled }: Props) {
  const { t, locale } = useI18n();
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const current = models.find((m) => m.slug === value);
  const name = current?.name ?? recorded?.name ?? t("chat.model.none");
  const heading = t(recorded ? "chat.remote.oneOff" : "chat.remote.model");
  const effortShown = !!effort && !!onEffort;
  return <Menu.Root>
    <Menu.Trigger className="remote-model-trigger" type="button" disabled={disabled} data-testid="remote-model-trigger" data-value={value}
      aria-label={t("chat.remote.modelTrigger", { model: name })}>
      <span className="remote-model-name">{name}</span>
      {effortShown && <span className="remote-model-effort">{t(`chat.remote.effort.${effort}`)}</span>}
      <Icon name="chevron-down" size={12} />
    </Menu.Trigger>
    <Menu.Portal><Menu.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12}>
      <Menu.Popup className="popup remote-model-menu" aria-label={heading}>
        <div className="chat-mgroup" aria-hidden>{heading}</div>
        <Menu.RadioGroup aria-label={heading} value={value} onValueChange={(v) => onValue(String(v))}>
          {recorded && <Menu.RadioItem value="" closeOnClick className="mitem remote-model-item" data-testid="remote-model-option" data-value="">
            <span className="chat-grow remote-model-text"><span className="ttl">{t("chat.remote.chatDefault")}</span><span className="sub">{recorded.name}</span></span>
            <Menu.RadioItemIndicator className="remote-model-check"><Icon name="check" /></Menu.RadioItemIndicator>
          </Menu.RadioItem>}
          {models.map((m) => {
            const sub = m.description ?? (m.contextTokens ? t("chat.remote.contextSize", { size: compact.format(m.contextTokens) }) : undefined);
            return <Menu.RadioItem key={m.slug} value={m.slug} closeOnClick className="mitem remote-model-item" data-testid="remote-model-option" data-value={m.slug}>
              <span className="chat-grow remote-model-text">
                <span className="remote-model-row">
                  <span className="ttl">{m.name}</span>
                  {m.preview && <span className="badge run">{t("chat.remote.badge.preview")}</span>}
                  {m.reasoning === true && <span className="badge">{t("chat.model.reasoning")}</span>}
                  {m.vision === true && <span className="badge">{t("chat.model.image")}</span>}
                  {m.tools === true && <span className="badge">{t("chat.model.tools")}</span>}
                </span>
                {sub && <span className="sub">{sub}</span>}
              </span>
              <Menu.RadioItemIndicator className="remote-model-check"><Icon name="check" /></Menu.RadioItemIndicator>
            </Menu.RadioItem>;
          })}
        </Menu.RadioGroup>
        {effortShown && <>
          <Menu.Separator className="msep" />
          <div className="chat-mgroup" aria-hidden>{t("chat.remote.effortLabel")}</div>
          <Menu.RadioGroup aria-label={t("chat.remote.effortLabel")} className="remote-effort" value={effort} onValueChange={(v) => {
            if (EFFORTS.includes(v as Effort)) onEffort!(v as Effort);
          }}>
            {EFFORTS.map((e) => <Menu.RadioItem key={e} value={e} closeOnClick={false} className="mitem remote-effort-item" data-testid="remote-effort-option" data-value={e}>
              {t(`chat.remote.effort.${e}`)}
            </Menu.RadioItem>)}
          </Menu.RadioGroup>
        </>}
      </Menu.Popup>
    </Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}
