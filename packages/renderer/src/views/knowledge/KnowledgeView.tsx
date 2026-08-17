import * as React from 'react';

export function KnowledgeView({ workspacePath }: { workspacePath: string | null }) {
  const [pages] = React.useState([
    { id: 'agents', title: 'AGENTS.md', body: 'Project conventions auto-read into the agent system prompt.' },
    { id: 'droids', title: 'Droids', body: 'Markdown helpers in .cortex/droids or .factory/droids.' },
    { id: 'skills', title: 'Skills', body: 'Slash commands from .cortex/skills.' },
  ]);
  const [active, setActive] = React.useState(pages[0]);

  return (
    <div className="h-full flex" data-testid="knowledge-view">
      <div className="w-64 border-r border-border p-3">
        <h1 className="text-sm font-medium mb-3">Wiki / Knowledge</h1>
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => setActive(page)}
            className="block w-full text-left text-sm py-1"
          >
            {page.title}
          </button>
        ))}
        <p className="text-xs text-text-tertiary mt-4">{workspacePath ?? 'No folder'}</p>
      </div>
      <article className="flex-1 p-6">
        <h2 className="text-lg font-medium mb-2">{active.title}</h2>
        <p className="text-sm text-text-secondary">{active.body}</p>
      </article>
    </div>
  );
}
