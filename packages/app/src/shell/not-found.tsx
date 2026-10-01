import { useT } from "../i18n";
import { useNav } from "./nav";

export function NotFound() {
  const t = useT();
  const { go } = useNav();
  return <div className="home"><h1>{t("shell.notFound.title")}</h1><p style={{ color: "var(--t2)", margin: "0 0 16px" }}>{t("shell.notFound.body")}</p><button className="btn primary" onClick={() => go("home")}>{t("shell.notFound.cta")}</button></div>;
}
