import { expect, it } from "vitest";
import { splitRows } from "./split-rows";

it("pairs removed and added runs side by side and keeps context on both sides", () => {
  const diff = "diff --git a/g.txt b/g.txt\nindex 1..2 100644\n--- a/g.txt\n+++ b/g.txt\n@@ -1,3 +1,3 @@\n keep\n-old one\n-old two\n+new one\n end\n\\ No newline at end of file\n";
  expect(splitRows(diff)).toEqual([
    { left: { k: "ctx", text: "keep" }, right: { k: "ctx", text: "keep" } },
    { left: { k: "del", text: "old one" }, right: { k: "add", text: "new one" } },
    { left: { k: "del", text: "old two" }, right: { k: "empty", text: "" } },
    { left: { k: "ctx", text: "end" }, right: { k: "ctx", text: "end" } },
  ]);
  expect(splitRows("")).toEqual([]);
});
