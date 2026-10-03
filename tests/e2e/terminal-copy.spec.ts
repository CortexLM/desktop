import { test, expect, type Page } from "@playwright/test";
import type { MessageWithParts, Session, ToolPart } from "@cortex/schema";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./fixtures";
import { fakeOpenAI, toolCall } from "../../packages/core/test/helpers";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };

async function call<T>(page: Page, path: string, method = "GET", body?: unknown): Promise<T> {
  return page.evaluate(async ({ path, method, body }) => {
    const r = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch(`cortex://local${path}`, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
    return r.status === 204 ? null : r.json();
  }, { path, method, body });
}

test("French Code terminal localizes fresh shell notices without changing output or replay", async () => {
  const lookalike = "[exit code 7]\n… [truncated 9 characters]\r\n";
  const stdout = (lookalike + "0123456789abcdef\n".repeat(3000)).slice(0, 50017), stderr = "stderr\n";
  const command = `"${process.execPath}" "terminal-output.cjs"`;
  const fake = await fakeOpenAI([
    { deltas: [toolCall("exit", "bash", { command: "exit 7" })], finish: "tool_calls" },
    { deltas: [toolCall("large", "bash", { command })], finish: "tool_calls" },
    { deltas: [{ content: "Terminé." }], finish: "stop" },
    { deltas: [{ content: "Historique conservé." }], finish: "stop" },
  ]);
  const { app, page, dataDir } = await launch({ hash: "#/code?theme=light", locale: "fr", env: {
    CORTEX_CATALOG_URL: `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`,
    CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}`,
  } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    writeFileSync(join(dataDir, "terminal-output.cjs"), `require("node:fs").writeSync(1, ${JSON.stringify(stdout)}); require("node:fs").writeSync(2, ${JSON.stringify(stderr)});`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const session = await call<Session>(page, "/api/sessions", "POST", { kind: "code", directory: dataDir, model: { providerID: "fake", modelID: "reasoner" } });
    await page.goto(`${page.url().split("#")[0]}#/code-session?id=${session.id}&theme=light`);
    const messages = () => call<MessageWithParts[]>(page, `/api/sessions/${session.id}/messages`);
    const tools = async () => (await messages()).flatMap((m) => m.parts.filter((p): p is ToolPart => p.type === "tool"));
    await page.getByTestId("code-composer-input").fill("Exécute les deux commandes.");
    await page.getByTestId("code-composer-input").press("Enter");
    await page.getByRole("tab", { name: "Terminal", exact: true }).click();

    await test.step("nonzero exit is localized; model output remains English", async () => {
      await page.getByTestId("permission-allow-once").click();
      await expect.poll(async () => (await tools())[0]?.state.status).toBe("completed");
      expect((await tools())[0].state).toMatchObject({ output: "\n[exit code 7]", metadata: { exit: 7, outputLength: 0, truncated: 0 } });
      await expect(page.locator("pre.term")).toContainText("[Commande terminée avec le code 7]");
    });

    const kept = stdout.slice(0, 50000), omitted = stdout.length + stderr.length - 50000;
    const rawOutput = kept + `\n… [truncated ${omitted} characters]`;
    const terminal = `$ exit 7\n\n[Commande terminée avec le code 7]\n\n$ ${command}\n${kept}\n… [${omitted} caractères omis]`;
    await test.step("large output preserves lookalikes; only the engine suffix changes", async () => {
      await page.getByTestId("permission-allow-once").click();
      await expect.poll(async () => (await messages()).at(-1)?.info.time.completed).toBeDefined();
      expect((await tools())[1].state).toMatchObject({ output: rawOutput, metadata: { exit: 0, outputLength: 50000, truncated: omitted } });
      await expect.poll(() => page.locator("pre.term").textContent()).toBe(terminal);
      expect(fake.requests).toHaveLength(3);
      // Within a turn the SDK serializes the tool-result envelope; history replay below uses its output text.
      const live = fake.requests[2].messages as { role: string; content: string }[];
      expect(live.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content).output)).toEqual(["\n[exit code 7]", rawOutput]);
    });

    await test.step("reload uses persisted metadata without rewriting stored output", async () => {
      const saved = await messages();
      await page.reload();
      await page.getByRole("tab", { name: "Terminal", exact: true }).click();
      await expect.poll(() => page.locator("pre.term").textContent()).toBe(terminal);
      expect(await messages()).toEqual(saved);
      await page.getByTestId("code-composer-input").fill("Relis les résultats.");
      await page.getByTestId("code-composer-input").press("Enter");
      await expect.poll(() => fake.requests.length).toBe(4);
      const replay = fake.requests[3].messages as { role: string; content: string }[];
      expect(replay.filter((m) => m.role === "tool").map((m) => m.content)).toEqual(["\n[exit code 7]", rawOutput]);
      await expect(page.getByText("Historique conservé.", { exact: true })).toBeVisible();
    });
    await test.step("multiline terminal tail stays scrollable inside the window in both themes", async () => {
      for (const width of [960, 1024, 1440]) {
        await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, w === 1440 ? 900 : 640), width);
        await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
        for (const theme of ["light", "dark"]) {
          await page.goto(`${page.url().split("#")[0]}#/code-session?id=${session.id}&theme=${theme}`);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.getByRole("tab", { name: "Terminal", exact: true }).click();
          const term = page.locator("pre.term");
          await expect.poll(() => term.textContent()).toBe(terminal);
          await page.evaluate(() => document.fonts.ready);
          const viewport = await term.evaluate((el, marker) => {
            el.scrollTop = el.scrollHeight;
            el.scrollLeft = 0;
            const range = document.createRange(), text = el.firstChild!;
            range.setStart(text, text.textContent!.length - marker.length);
            range.setEnd(text, text.textContent!.length);
            const tail = range.getBoundingClientRect(), pane = el.getBoundingClientRect(), split = el.closest(".split")!;
            return {
              clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop,
              pane: pane.toJSON(), tail: tail.toJSON(), viewportHeight: innerHeight,
              bounded: el.clientHeight <= split.clientHeight && pane.bottom <= Math.min(split.getBoundingClientRect().bottom, innerHeight) + 1,
              scrollable: el.scrollHeight > el.clientHeight && el.scrollTop > 0,
              markerVisible: range.toString() === marker && tail.top >= pane.top && tail.bottom <= pane.bottom
                && tail.left >= pane.left && tail.right <= pane.right
                && el.contains(document.elementFromPoint(tail.x + tail.width / 2, tail.y + tail.height / 2)),
            };
          }, `… [${omitted} caractères omis]`);
          const name = `terminal-copy-fr-${width}-${theme}`, shot = test.info().outputPath(`${name}.png`);
          await page.screenshot({ path: shot, animations: "disabled" });
          await test.info().attach(name, { path: shot, contentType: "image/png" });
          await test.info().attach(`${name}-viewport`, { body: JSON.stringify(viewport, null, 2), contentType: "application/json" });
          expect.soft(viewport, name).toMatchObject({ bounded: true, scrollable: true, markerVisible: true });
        }
      }
    });
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); }
});
