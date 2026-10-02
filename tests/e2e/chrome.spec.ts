import { test, expect } from "@playwright/test";
import { launch } from "./fixtures";

for (const [locale, file, edit, newChat] of [
  ["en", "File", "Edit", "New Chat"],
  ["fr", "Fichier", "Édition", "Nouveau chat"],
]) {
  test(`native window chrome and ${locale} menu`, async () => {
    const { app } = await launch({ env: { CORTEX_LOCALE: locale } });
    try {
      const chrome = await app.evaluate(({ BrowserWindow, Menu }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return {
          title: win.getTitle(),
          bounds: win.getBounds(),
          minimum: win.getMinimumSize(),
          traffic: process.platform === "darwin" ? win.getWindowButtonPosition() : null,
          menu: Menu.getApplicationMenu()?.items.map((item) => ({ label: item.label, children: item.submenu?.items.map((child) => child.label) })),
        };
      });
      expect(chrome.title).toBe("Cortex");
      expect(chrome.minimum).toEqual([960, 640]);
      expect(chrome.bounds.width).toBeGreaterThanOrEqual(960);
      expect(chrome.bounds.height).toBeGreaterThanOrEqual(640);
      if (process.platform === "darwin") expect(chrome.traffic).toEqual({ x: 20, y: 15 });
      expect(chrome.menu?.map((item) => item.label)).toEqual(expect.arrayContaining([file, edit]));
      expect(chrome.menu?.find((item) => item.label === file)?.children).toContain(newChat);
    } finally {
      await app.close();
    }
  });
}
