import { test, expect, type Page } from "@playwright/test";
import { launch } from "./fixtures";
import { startFakeProvider } from "./fake-provider";
import catalog from "../../packages/core/test/fixtures/catalog.json" with { type: "json" };
import enComposer from "../../packages/i18n/locales/en/composer.json" with { type: "json" };
import frComposer from "../../packages/i18n/locales/fr/composer.json" with { type: "json" };
import esComposer from "../../packages/i18n/locales/es/composer.json" with { type: "json" };
import deComposer from "../../packages/i18n/locales/de/composer.json" with { type: "json" };
import jaComposer from "../../packages/i18n/locales/ja/composer.json" with { type: "json" };
import zhComposer from "../../packages/i18n/locales/zh-Hans/composer.json" with { type: "json" };
import ptComposer from "../../packages/i18n/locales/pt-BR/composer.json" with { type: "json" };
import koComposer from "../../packages/i18n/locales/ko/composer.json" with { type: "json" };

const CATALOG_URL = `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

for (const theme of ["light", "dark"]) {
  test(`frozen preview actions and same-URL Chat/Code history — ${theme}`, async () => {
    const { app, page } = await launch({ hash: `#/home?preview&theme=${theme}`, locale: "fr", env: { CORTEX_CATALOG_URL: CATALOG_URL } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      const base = page.url().split("#")[0];
      const home = () => page.goto(`${base}#/home?preview&theme=${theme}`);
      const input = page.getByTestId("composer-input");
      const form = page.locator("form.composer");
      const model = form.locator(".model");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".sidebar .row").filter({ has: page.getByText("Plan de lancement du 14 avril", { exact: true }) })).toHaveAttribute("data-dim", "true");
      for (const [name, route] of [["Ajouter des fichiers", "upload"], ["Créer une image", "image-gen"], ["Recherche web", "search-results"], ["Confier à ton Bot", "bot"]]) {
        await home();
        await form.getByRole("button", { name: "Ajouter", exact: true }).click();
        await page.getByRole("menuitem", { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#/${route}\\?`));
        expect(new URLSearchParams(page.url().split("?")[1]).has("preview")).toBe(true);
      }
      await home();
      await form.getByRole("button", { name: "Mode vocal", exact: true }).click();
      await expect(page).toHaveURL(/#\/voice\?/);
      await home();
      await form.getByRole("button", { name: "Dicter", exact: true }).click();
      await expect(page).toHaveURL(/#\/voice\?/);
      await home();
      await input.fill("  Brouillon conservé  ");
      await page.locator("main .content-top").getByRole("button", { name: "Actualiser", exact: true }).click();
      await expect(page.getByText("Les suggestions locales sont à jour. Ton brouillon est conservé.", { exact: true })).toBeVisible();
      await expect(input).toHaveValue("  Brouillon conservé  ");
      await page.locator("main .content-top").getByRole("button", { name: "Nouveau chat", exact: true }).click();
      await expect(input).toHaveValue("");

      await model.click();
      await page.getByRole("menuitemradio", { name: /Réflexion/ }).click();
      await expect(model).toHaveText("Réflexion");
      const suggestion = page.locator(".suggestion").first();
      const suggested = (await suggestion.innerText()).trim();
      expect(await suggestion.locator(".gel").evaluate((el) => el.getBoundingClientRect().width)).toBe(16);
      await suggestion.click();
      await expect(page.locator(".msg-user")).toHaveText(suggested);
      await expect(model).toHaveText("Réflexion");
      await expect(page.locator(".msg-bot").last()).toContainText("aucun service IA ni outil externe n’a été exécuté.");
      await page.locator("main .content-top").getByRole("button", { name: "Nouveau chat", exact: true }).click();

      for (const area of ["chat", "code"]) {
        const code = area === "code";
        if (code) await page.goto(`${base}#/code?preview&theme=${theme}`);
        const draftInput = code ? page.getByTestId("code-composer-input") : input;
        const selected = code ? "Code réfléchi" : "Réflexion";
        const historical = code ? "Corriger la pagination des factures" : "Plan de lancement du 14 avril";
        const draft = code ? "Conserver exactement cette demande de code" : "Conserver exactement cette demande personnelle";
        await model.click();
        await page.getByRole("menuitemradio", { name: new RegExp(selected) }).click();
        await draftInput.fill(draft);
        await draftInput.press("Enter");
        await expect(page.locator("main .content-top .title")).toHaveText(draft);
        await expect(page.locator(".msg-user")).toHaveText(draft);
        await expect(model).toHaveText(selected);
        const url = page.url();
        const length = await page.evaluate(() => history.length);
        const historicalRow = page.locator(".sidebar .row").filter({ has: page.getByText(historical, { exact: true }) });
        if (!code) await expect(historicalRow).toHaveAttribute("data-dim", "true");
        await historicalRow.click();
        await expect(page.locator("main .content-top .title")).toHaveText(historical);
        if (!code) await expect(historicalRow).not.toHaveAttribute("data-dim");
        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => history.length)).toBe(length + 1);
        expect(await page.evaluate(() => history.state?.cortexChat)).toBeNull();
        await page.goBack();
        await expect(page.locator("main .content-top .title")).toHaveText(draft);
        await expect(page.locator(".msg-user")).toHaveText(draft);
        await expect(model).toHaveText(selected);
        if (!code) await expect(historicalRow).toHaveAttribute("data-dim", "true");
        expect(await page.evaluate(() => history.state?.cortexChat)).toEqual({ text: draft, model: selected });
        await capture(page, `frozen-${area}-history-${theme}`);
        await page.goForward();
        await expect(page.locator("main .content-top .title")).toHaveText(historical);
        expect(await page.evaluate(() => history.state?.cortexChat)).toBeNull();
        await page.goBack();
        await expect(page.locator("main .content-top .title")).toHaveText(draft);
        if (code) {
          await expect(page.locator(".split-r")).toContainText("Aucune modification exécutée");
          await expect(page.locator(".diff")).toHaveCount(0);
          await page.locator(".content-top").getByRole("button", { name: "Terminal", exact: true }).click();
          await expect(page.locator(".term")).toHaveText("Démonstration locale\nAucune commande exécutée.");
          await expect(page.getByRole("button", { name: "Voir la PR", exact: true })).toBeDisabled();
          await expect(page.getByRole("button", { name: "Voir la PR", exact: true })).toHaveAttribute("title", "Aucune modification exécutée dans cette démonstration");
        } else {
          await input.fill("Une deuxième demande");
          await input.press("Enter");
          await page.getByRole("button", { name: "Arrêter la génération", exact: true }).click();
          await expect(page.locator(".msg-user")).toHaveText([draft, "Une deuxième demande"]);
          await page.getByRole("button", { name: "Options du chat", exact: true }).click();
          await page.getByRole("menuitem", { name: "Supprimer", exact: true }).click();
          await expect(page.locator(".msg-user")).toHaveCount(0);
          await page.getByRole("button", { name: "Annuler", exact: true }).click();
          await expect(page.locator(".msg-user")).toHaveText([draft, "Une deuxième demande"]);
          await page.getByRole("button", { name: "Options du chat", exact: true }).click();
          await page.getByRole("menuitem", { name: "Renommer", exact: true }).click();
          await page.getByRole("textbox", { name: "Titre du chat", exact: true }).fill("Titre local modifié");
          await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
          await expect(page.locator("main .content-top .title")).toHaveText("Titre local modifié");
          await page.getByRole("button", { name: "Options du chat", exact: true }).click();
          await page.getByRole("menuitem", { name: "Épingler", exact: true }).click();
          await expect(page.getByTitle("Épinglé dans cet aperçu", { exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Options du chat", exact: true }).click();
          await page.getByRole("menuitem", { name: "Déplacer vers un projet", exact: true }).click();
          await page.getByRole("combobox", { name: "Projet du chat", exact: true }).selectOption({ label: "Studio Nord" });
          await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
          await expect(page.getByText("Projet modifié dans cet aperçu", { exact: true })).toBeVisible();
        }
      }
      const sessions = await page.evaluate(async () => (await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/sessions")).json());
      expect(sessions).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await app.close(); }
  });

  test(`live composer capsule geometry, locale labels and attachment safety — ${theme}`, async () => {
    const fake = await startFakeProvider();
    const { app, page } = await launch({ hash: `#/home?theme=${theme}`, env: { CORTEX_CATALOG_URL: CATALOG_URL, CORTEX_TEST_PROVIDER_BASEURL: `fake=${fake.url}` } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
      const form = page.locator("form.composer");
      const input = page.getByTestId("composer-input");
      for (const [locale, labels] of Object.entries({ en: enComposer, fr: frComposer, es: esComposer, de: deComposer, ja: jaComposer, "zh-Hans": zhComposer, "pt-BR": ptComposer, ko: koComposer })) {
        await page.evaluate((value) => localStorage.setItem("cortex.locale", value), locale);
        await page.reload();
        await expect(input).toHaveAttribute("placeholder", labels.placeholder);
        await expect(form.getByRole("button", { name: labels.dictate, exact: true })).toBeVisible();
        await expect(page.getByTestId("composer-send")).toHaveAttribute("aria-label", labels.voice);
        await input.fill("Test capsule");
        await expect(form).toHaveAttribute("data-has-text", "true");
        await expect(page.getByTestId("composer-send")).toHaveAttribute("aria-label", labels.send);
        await expect(page.getByTestId("composer-send")).toBeInViewport({ ratio: 1 });
      }
      await page.evaluate(() => localStorage.setItem("cortex.locale", "en"));
      await page.reload();
      const geometry = () => form.evaluate((el) => {
        const send = el.querySelector<HTMLButtonElement>(".send")!;
        const input = el.querySelector<HTMLInputElement>('[data-testid="composer-input"]')!;
        const style = getComputedStyle(send);
        return { width: parseFloat(getComputedStyle(el, "::before").width), transform: style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m41, inputWidth: input.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
      });
      await expect(page.getByTestId("composer-send")).toHaveAttribute("aria-label", "Voice mode");
      await expect(form).not.toHaveAttribute("data-has-text");
      const empty = await geometry();
      await input.fill("   ");
      await expect(form).not.toHaveAttribute("data-has-text");
      await input.fill("Keep the live draft");
      await expect.poll(async () => Math.round(empty.width - (await geometry()).width)).toBe(46);
      await expect.poll(async () => Math.round((await geometry()).transform)).toBe(8);
      // Composited entrance transforms can round DOMRects by fractions of a CSS pixel.
      expect((await geometry()).height).toBeCloseTo(empty.height, 2);
      expect((await geometry()).inputWidth).toBeGreaterThan(40);
      await page.locator("main .content-top").getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(input).toHaveValue("Keep the live draft");
      await form.getByRole("button", { name: "Dictate", exact: true }).click();
      await expect(page.getByText("Not available yet", { exact: true })).toBeVisible();
      await expect(input).toHaveValue("Keep the live draft");
      await input.fill("");
      await expect.poll(async () => Math.round((await geometry()).width)).toBe(Math.round(empty.width));
      await expect.poll(async () => Math.round((await geometry()).transform)).toBe(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await input.fill("Reduced motion draft");
      await expect.poll(async () => Math.round(empty.width - (await geometry()).width)).toBe(46);
      expect(await form.evaluate((el) => getComputedStyle(el, "::before").transitionDuration.split(",").every((s) => parseFloat(s) <= 0.001))).toBe(true);
      await capture(page, `frozen-live-capsule-${theme}`);

      await page.evaluate(async () => {
        const response = await (window as unknown as { __bridgeFetch: typeof fetch }).__bridgeFetch("cortex://local/api/providers/fake/key", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "sk-test-frozen-composer" }) });
        if (!response.ok) throw new Error(`Key setup failed: ${response.status}`);
      });
      await page.reload();
      const select = async (name: string) => {
        await page.getByTestId("model-trigger").click();
        await page.getByTestId("model-option").filter({ hasText: name }).click();
        await expect(page.getByTestId("model-trigger")).toHaveAttribute("aria-expanded", "false");
      };
      await select("Reasoner Large");
      await page.getByTestId("attach-input").setInputFiles({ name: "frozen.png", mimeType: "image/png", buffer: PNG });
      await expect(page.locator(".chat-att-img")).toBeVisible();
      await input.fill("What is in this picture?");
      await select("Plain Text");
      await page.getByTestId("composer-send").click();
      await expect(page.getByText("This model can’t read images.", { exact: true })).toBeVisible();
      await expect(input).toHaveValue("What is in this picture?");
      await expect(form).toHaveAttribute("data-has-text", "true");
      await expect(page.locator(".chat-att-img")).toBeVisible();
      expect(fake.requests).toHaveLength(0);
      await select("Reasoner Large");
      await page.getByTestId("composer-send").click();
      await expect(page).toHaveURL(/#\/chat\?.*id=ses_/);
      await expect(page.getByTestId("assistant-text").last()).toContainText("I can see the attached image");
      await expect(input).toHaveValue("");
      await expect(form).not.toHaveAttribute("data-has-text");
      expect(fake.requests).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally { await app.close(); await fake.close(); }
  });
}
