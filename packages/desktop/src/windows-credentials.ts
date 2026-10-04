// Main-only bridge. Secret material travels only through bounded anonymous pipes.
import childProcess from "node:child_process";
import path from "node:path";

// ponytail: 2 MiB pipe messages bound MCP configuration; raise only with measured need.
const limit = 2 * 1024 * 1024;
const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
      -not [Environment]::Is64BitProcess -or $ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') { exit 1 }
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
  Add-Type -AssemblyName System.Security
  $buffer = New-Object char[] (2097153)
  $count = 0
  while ($count -lt $buffer.Length) {
    $n = [Console]::In.Read($buffer, $count, $buffer.Length - $count)
    if ($n -eq 0) { break }
    $count += $n
  }
  if ($count -gt 2097152) { exit 1 }
  $message = [string]::new($buffer, 0, $count)
  $separator = $message.IndexOf([char]10)
  if ($separator -lt 1) { exit 1 }
  $operation = $message.Substring(0, $separator)
  $value = $message.Substring($separator + 1)
  if ($operation -eq 'acl') {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.FileSecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
    [System.IO.File]::SetAccessControl($value, $acl)
    [Console]::Out.Write('OK')
  } else {
    $bytes = [Convert]::FromBase64String($value)
    if ($operation -eq 'protect') {
      $result = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    } elseif ($operation -eq 'unprotect') {
      $result = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else { exit 1 }
    [Console]::Out.Write([Convert]::ToBase64String($result))
  }
} catch { exit 1 }
`;

function invoke(operation: "protect" | "unprotect" | "acl", value: string): string {
  try {
    const root = process.env.SystemRoot;
    if (process.platform !== "win32" || process.arch !== "x64" || !root || !/^[a-z]:\\/i.test(root) || !path.win32.isAbsolute(root)) throw new Error();
    const input = `${operation}\n${value}`;
    if (Buffer.byteLength(input) > limit) throw new Error();
    const result = childProcess.spawnSync(path.win32.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      { input, encoding: "utf8", windowsHide: true, timeout: 15_000, maxBuffer: limit, stdio: ["pipe", "pipe", "ignore"] });
    if (result.error || result.status !== 0 || result.signal || typeof result.stdout !== "string" || Buffer.byteLength(result.stdout) > limit) throw new Error();
    if (operation === "acl") {
      if (result.stdout !== "OK") throw new Error();
    } else if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.stdout) || (operation === "protect" && !result.stdout)) throw new Error();
    return result.stdout;
  } catch { throw new Error("Credential protection unavailable"); }
}

export const windowsCredentials = {
  protect: (value: string): string => invoke("protect", Buffer.from(value, "utf8").toString("base64")),
  unprotect: (value: string): string => Buffer.from(invoke("unprotect", value), "base64").toString("utf8"),
  restrict: (file: string): void => { invoke("acl", file); },
};
