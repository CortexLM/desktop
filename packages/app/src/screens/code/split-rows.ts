// Side-by-side rows from one file's unified diff: context on both sides, a removed run paired with the added run after it.
export type Half = { k: "ctx" | "add" | "del" | "empty"; text: string };
export function splitRows(text: string): { left: Half; right: Half }[] {
  const rows: { left: Half; right: Half }[] = [], body = (text ? text.replace(/\n$/, "").split("\n") : []).filter(l => !/^(diff --git|index |--- |\+\+\+ |@@|\\ )/.test(l));
  for (let i = 0; i < body.length;) {
    if (body[i].startsWith("-") || body[i].startsWith("+")) {
      const del: string[] = [], add: string[] = [];
      while (i < body.length && body[i].startsWith("-")) del.push(body[i++].slice(1));
      while (i < body.length && body[i].startsWith("+")) add.push(body[i++].slice(1));
      for (let j = 0; j < Math.max(del.length, add.length); j++) rows.push({ left: j < del.length ? { k: "del", text: del[j] } : { k: "empty", text: "" }, right: j < add.length ? { k: "add", text: add[j] } : { k: "empty", text: "" } });
    } else { const line = body[i++].slice(1); rows.push({ left: { k: "ctx", text: line }, right: { k: "ctx", text: line } }); }
  }
  return rows;
}
