import * as React from "react";
import { readHash, useNav } from "../shell/nav";

const KEY = "cortex.pref.general.enter";
const EVENT = "cortex-send-enter";

// ponytail: one device-local preference; keep execution settings in the engine.
function readPreference(): boolean | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === null || value === "true" ? true : value === "false" ? false : null;
  } catch { return null; }
}

export function useSendEnter() {
  const { route, params, entryKey } = useNav();
  const live = route !== "gallery" && !params.has("preview") && !params.has("shot");
  const [value, setValue] = React.useState<boolean | null>(() => live ? readPreference() : true);
  const composing = React.useRef(false);
  const ownsRoute = () => {
    const current = readHash();
    return live && current.entryKey === entryKey && current.route === route && current.params.toString() === params.toString();
  };
  React.useEffect(() => {
    if (!live) return;
    const refresh = () => setValue(readPreference());
    const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) refresh(); };
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", storage); };
  }, [live]);
  const update = (next: boolean) => {
    if (!live) { setValue(next); return true; }
    if (!ownsRoute()) return false;
    try { localStorage.setItem(KEY, String(next)); }
    catch { return false; }
    setValue(next);
    window.dispatchEvent(new Event(EVENT));
    return true;
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.repeat || composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (!ownsRoute()) return;
    const accepted = readPreference();
    setValue(accepted);
    if (accepted !== true) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };
  return { live, value, update, field: { onKeyDown, onCompositionStart: () => { composing.current = true; }, onCompositionEnd: () => { composing.current = false; } } };
}
