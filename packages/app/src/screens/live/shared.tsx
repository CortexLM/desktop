// Todo 6b app screens: signed-in owner gate plus thin helpers over the main-process contract table (CONTRACT_OPS).
// Every read and write names an allowlisted trunk route; main validates segments and returns typed refusals.
import * as React from "react";
import type { ContractOpName } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { isPreview } from "../../preview";
import { ContractError, useContract } from "../code/contract-panels";

export { ContractError, useContract };
export type Row = Record<string, unknown>;
export const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export const call = async <T,>(epoch: string, op: ContractOpName, params: Record<string, string> = {}, body?: Record<string, unknown>) =>
  (await api.code.contract({ epoch, op, params, ...(body ? { body } : {}) })).data as T;

export function useOp<T>(epoch: string, op: ContractOpName, params: Record<string, string> = {}, skip = false) {
  const key = JSON.stringify(params);
  return useQuery<T | undefined>(() => (skip ? Promise.resolve(undefined) : call<T>(epoch, op, params)), [epoch, op, key, skip]);
}

export function Owned({ title, children, actions }: { title: string; children: (epoch: string) => React.ReactNode; actions?: React.ReactNode }) {
  const t = useT(), { go, entryKey } = useNav();
  const connection = useQuery(() => api.connection.get(), [entryKey]);
  const signedIn = !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn;
  const owner = useQuery(async () => (signedIn ? (await api.code.models()).epoch : ""), [signedIn, entryKey]);
  const epoch = owner.state === "ready" ? owner.data : "";
  return <>
    <div className="content-top"><span className="title">{title}</span><div className="spacer" />{epoch && actions}</div>
    <div className="page" data-testid="live-screen" data-owner-epoch={epoch}>
      {connection.state === "loading" || (signedIn && owner.state === "loading") ? <p role="status">{t("live.loading")}</p>
        : !signedIn ? <div className="empty" data-testid="live-signed-out"><h2>{t("live.signIn.title")}</h2><p>{t("live.signIn.text")}</p><button className="btn primary" onClick={() => go("login")}>{t("live.signIn.action")}</button></div>
        : owner.state === "error" || !epoch ? <div className="banner err" role="alert">{t("live.error.owner")}<button className="btn secondary" onClick={owner.reload}>{t("live.retry")}</button></div>
        : <React.Fragment key={epoch}>{children(epoch)}</React.Fragment>}
    </div>
  </>;
}

export function Loaded<T>({ q, empty, children }: { q: ReturnType<typeof useOp<T>>; empty?: (data: T) => boolean; children: (data: T) => React.ReactNode }) {
  const t = useT();
  if (q.state === "loading") return <p role="status" data-testid="live-loading">{t("live.loading")}</p>;
  if (q.state === "error") return <div className="banner err" role="alert" data-testid="live-error" data-code={q.code}>{t(`live.error.${q.code === "not_found" ? "notFound" : q.code === "permission_denied" ? "forbidden" : "read"}`)}<button className="btn secondary" onClick={q.reload}>{t("live.retry")}</button></div>;
  if (q.data === undefined) return null;
  if (empty?.(q.data)) return <p className="code-hint" data-testid="live-empty">{t("live.empty")}</p>;
  return <>{children(q.data)}</>;
}

export const when = (iso: unknown) => (iso ? new Date(String(iso)).toLocaleString() : "");
