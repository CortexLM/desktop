import * as React from 'react';

export function SecurityView() {
  const [findings, setFindings] = React.useState<string[]>([]);

  React.useEffect(() => {
    void window.cortex.mcp
      .listPermissions({})
      .then((response) => {
        if (response.success) {
          setFindings(
            (response.data.permissions ?? []).map(
              (item: { toolName?: string; serverId?: string }) =>
                `${item.serverId ?? 'mcp'} / ${item.toolName ?? 'tool'}`
            )
          );
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="h-full p-6" data-testid="security-view">
      <h1 className="text-lg font-medium mb-2">Security</h1>
      <p className="text-sm text-text-secondary mb-4">
        Tool permissions, secret redaction, and workspace trust. Dangerous tools
        always go through the permission overlay.
      </p>
      <h2 className="text-sm font-medium mb-2">Granted MCP tools</h2>
      {findings.length === 0 ? (
        <p className="text-sm text-text-tertiary">No standing grants yet.</p>
      ) : (
        <ul className="text-sm font-mono space-y-1">
          {findings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
