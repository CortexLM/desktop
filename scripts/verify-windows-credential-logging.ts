// Bundle for Node, then run on Windows x64. Raw events/transcripts never become receipts.
import childProcess from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { windowsCredentials } from "../packages/desktop/src/windows-credentials";

const spawnSync = childProcess.spawnSync;
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const host = path.win32.join(process.env.SystemRoot ?? "", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"];
// A CLR callback needs no PowerShell runspace; subscription is active before READY.
const watcherScript = `
$ErrorActionPreference = 'Stop'
try {
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics.Eventing.Reader;
using System.Text;
public static class CredentialLogWatch {
  static readonly object Gate = new object();
  static EventLogWatcher watcher;
  static int count;
  public static void Start() {
    var query = new EventLogQuery("Microsoft-Windows-PowerShell/Operational", PathType.LogName, "*[System[(EventID=4103 or EventID=4104)]]");
    watcher = new EventLogWatcher(query);
    watcher.EventRecordWritten += Receive;
    watcher.Enabled = true;
  }
  public static void Stop() { watcher.Enabled = false; watcher.Dispose(); }
  static void Receive(object sender, EventRecordWrittenEventArgs e) {
    lock (Gate) {
      if (e.EventException != null || e.EventRecord == null) { Console.WriteLine("ERROR"); return; }
      using (var record = e.EventRecord) {
        if (++count > 10000) { Console.WriteLine("ERROR"); return; }
        Console.WriteLine("EVENT " + Convert.ToBase64String(Encoding.UTF8.GetBytes(record.ToXml())));
      }
    }
  }
}
'@
[CredentialLogWatch]::Start()
[Console]::Out.WriteLine('READY')
$null = [Console]::In.ReadLine()
[CredentialLogWatch]::Stop()
} catch { [Console]::Out.WriteLine('ERROR'); exit 1 }
`;

async function verify() {
  if (process.platform !== "win32" || process.arch !== "x64" || !/^[a-z]:\\/i.test(process.env.SystemRoot ?? "")) throw new Error();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-credential-logging-"));
  const children: { pid: number; before: string; after: string; transcript: string }[] = [];
  const records: string[] = [];
  let watcher: ReturnType<typeof childProcess.spawn> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let events4103 = 0, events4104 = 0, controls = 0, hits = 0, transcriptCount = 0;
  try {
    // Empty directory becomes owner-only before any transcript can contain synthetic material.
    const setup = spawnSync(host, [...args, `
$ErrorActionPreference = 'Stop'
try {
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [System.Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
[System.IO.Directory]::SetAccessControl(${quote(dir)}, $acl)
} catch { exit 1 }
`], { stdio: "ignore", timeout: 15000, windowsHide: true });
    if (setup.error || setup.status !== 0) throw new Error();
    const secret = randomBytes(32).toString("hex");
    const bytes = Buffer.from(secret, "utf8");
    const needles = [secret, bytes.toString("base64"), [...bytes].join(","), [...bytes].join(", "), [...bytes].join(" ")];
    const decimal = new RegExp([...bytes].join("[\\s,;]+"));
    const exposed = (text: string) => needles.some(needle => text.includes(needle)) || decimal.test(text);
    watcher = childProcess.spawn(host, [...args, watcherScript], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true, timeout: 90000 });
    const observer = watcher;
    let readyResolve!: () => void, completeResolve!: () => void;
    let readyReject!: () => void, completeReject!: () => void;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = () => reject(new Error()); });
    const complete = new Promise<void>((resolve, reject) => { completeResolve = resolve; completeReject = () => reject(new Error()); });
    // Completion can fail while synchronous native calls occupy this process.
    void complete.catch(() => {});
    let observerFailed = false;
    const fail = () => { observerFailed = true; readyReject(); completeReject(); observer.kill(); };
    const seen = new Set<string>();
    let pending = "", total = 0, triggered = false;
    observer.on("error", fail);
    observer.stdin?.on("error", fail);
    const exited = new Promise<void>(resolve => observer.once("close", code => { if (seen.size !== 6 || code !== 0) fail(); resolve(); }));
    observer.stdout?.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 16 * 1024 * 1024) { fail(); return; }
      pending += chunk.toString("utf8");
      let end: number;
      while ((end = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (line === "READY") { readyResolve(); continue; }
        if (!line.startsWith("EVENT ")) { fail(); return; }
        const xml = Buffer.from(line.slice(6), "base64").toString("utf8");
        records.push(xml);
        const pid = Number(/\bProcessID=['"](\d+)['"]/.exec(xml)?.[1]);
        const child = children.find(item => item.pid === pid);
        if (!child || !/<EventID(?:\s[^>]*)?>4103<\/EventID>/.test(xml)) continue;
        // HostApplication contains both marker literals: only bound cmdlet values count.
        const payload = /<Data Name=['"]Payload['"]>([\s\S]*?)<\/Data>/.exec(xml)?.[1] ?? "";
        for (const marker of [child.before, child.after]) {
          if (payload.includes(`value="${marker}"`) || payload.includes(`value=&quot;${marker}&quot;`)) seen.add(marker);
        }
        controls = seen.size;
      }
      if (triggered && seen.size === 6) completeResolve();
    });
    timer = setTimeout(fail, 75000);
    await ready;
    childProcess.spawnSync = ((file: string, argv: string[], options: childProcess.SpawnSyncOptions) => {
      if (file !== host || argv.at(-2) !== "-Command") throw new Error();
      const marker = `cortex_logging_${randomBytes(12).toString("hex")}`;
      const transcript = path.join(dir, `${children.length}.txt`);
      const before = `${marker}_before`, after = `${marker}_after`;
      const instrumented = `
$ErrorActionPreference = 'Stop'
$module = Import-Module Microsoft.PowerShell.Utility -PassThru
$module.LogPipelineExecutionDetails = $true
Start-Transcript -LiteralPath ${quote(transcript)} -Force | Out-Null
Write-Output ${quote(before)} | Out-Null
try {
${argv.at(-1)}
} finally {
Write-Output ${quote(after)} | Out-Null
Stop-Transcript | Out-Null
}
`;
      const result = spawnSync(file, [...argv.slice(0, -1), instrumented], options);
      children.push({ pid: result.pid, before, after, transcript });
      return result;
    }) as typeof childProcess.spawnSync;
    const file = path.join(dir, "restricted.bin");
    fs.writeFileSync(file, "", { flag: "wx" });
    windowsCredentials.restrict(file);
    const encrypted = windowsCredentials.protect(secret);
    if (windowsCredentials.unprotect(encrypted) !== secret) throw new Error();
    childProcess.spawnSync = spawnSync;
    triggered = true;
    await complete;
    observer.stdin?.end("STOP\n");
    await exited;
    clearTimeout(timer);
    if (observerFailed || pending.trim()) throw new Error();
    for (const xml of records) {
      const pid = Number(/\bProcessID=['"](\d+)['"]/.exec(xml)?.[1]);
      if (!children.some(child => child.pid === pid)) continue;
      if (/<EventID(?:\s[^>]*)?>4103<\/EventID>/.test(xml)) events4103++;
      if (/<EventID(?:\s[^>]*)?>4104<\/EventID>/.test(xml)) events4104++;
      if (exposed(xml)) hits++;
    }
    for (const child of children) {
      const raw = fs.readFileSync(child.transcript);
      if (!raw.length || raw.length > 16 * 1024 * 1024) throw new Error();
      if (exposed(raw.toString("utf8")) || exposed(raw.toString("utf16le"))) hits++;
      transcriptCount++;
    }
    if (controls !== 6 || events4103 < 6 || transcriptCount !== 3 || hits) throw new Error();
    console.log(JSON.stringify({ verdict: "PASS", children: children.length, controls, events4103, events4104, transcripts: transcriptCount, secretHits: hits, scriptBlockLogging: events4104 ? "observed" : "unverified" }));
  } catch {
    console.log(JSON.stringify({ verdict: hits ? "FAIL" : "INCONCLUSIVE", children: children.length, controls, events4103, events4104, transcripts: transcriptCount, secretHits: hits, scriptBlockLogging: "unverified" }));
    process.exitCode = 1;
  } finally {
    childProcess.spawnSync = spawnSync;
    if (timer) clearTimeout(timer);
    watcher?.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

void verify().catch(() => {
  // Never print exception objects: assertions, process errors and transcripts may carry secrets.
  console.log('{"verdict":"INCONCLUSIVE","scriptBlockLogging":"unverified"}');
  process.exitCode = 1;
});
