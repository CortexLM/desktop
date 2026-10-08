import { normalizeCode } from "./lib.js";

const $ = (id) => document.getElementById(id);
const MESSAGES = {
  bad_code: "That is not a pairing code. It has 8 letters and digits.",
  wrong_code: "Wrong or expired code. Generate a new one in Cortex.",
  app_not_running: "Cortex is not running. Open the desktop app and try again.",
  not_shareable: "This page cannot be shared.",
};

function render(s) {
  $("pair").hidden = s.paired;
  $("main").hidden = !s.paired;
  $("status").textContent = s.paired ? "Connected" : "Not connected";
  if (!s.paired) return;
  const c = s.current;
  $("title").textContent = c?.title || "No tab";
  $("url").textContent = c ? new URL(c.url || "about:blank").host : "";
  $("share").disabled = !c?.shareable || c.shared;
  $("share").textContent = c?.shared ? "Shared" : "Share this tab";
  $("empty").hidden = s.shared.length > 0;
  $("list").replaceChildren(...s.shared.map((t) => {
    const li = document.createElement("li"), name = document.createElement("span"), b = document.createElement("button");
    name.textContent = t.title || t.url; name.title = t.url;
    b.textContent = "Stop"; b.onclick = () => send({ type: "stop", tabId: t.id });
    li.append(name, b);
    return li;
  }));
}

async function send(msg) {
  const res = await chrome.runtime.sendMessage(msg);
  $("error").hidden = res.ok;
  if (!res.ok) $("error").textContent = MESSAGES[res.error] ?? "Something went wrong. Try again.";
  else render(res.state);
}

$("pair-form").onsubmit = (e) => { e.preventDefault(); const code = normalizeCode($("code").value); void send({ type: "pair", code: code ?? $("code").value }); };
$("share").onclick = () => void send({ type: "share" });
$("disconnect").onclick = () => void send({ type: "disconnect" });
void send({ type: "state" });
