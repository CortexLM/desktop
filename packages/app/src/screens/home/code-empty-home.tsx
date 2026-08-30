import { For, Show, type JSX } from 'solid-js';

import { Button, Segmented } from '@cortex-ide/ui';
import type { Capabilities, RuntimeKind } from '@cortex-ide/cortex-api';

import { copy } from '../../i18n/copy.ts';

import './code-empty-home.css';

export interface EmptyHomeDraft {
  prompt: string;
  runtime: RuntimeKind;
  repo?: string;
  branch?: string;
  model?: string;
}

export interface CodeEmptyHomeProps {
  capabilities: Capabilities;
  draft: EmptyHomeDraft;
  onDraftChange: (draft: EmptyHomeDraft) => void;
  onStart: (draft: EmptyHomeDraft) => void;
}

const HOSTS: readonly { id: RuntimeKind; label: string }[] = [
  { id: 'local', label: copy['code.empty.host.local'] },
  { id: 'ssh', label: copy['code.empty.host.ssh'] },
  { id: 'cloud', label: copy['code.empty.host.cloud'] },
];

/** Honest lock copy: what is missing, not a generic "needs an account". */
export function hostLockMessage(allowed: readonly RuntimeKind[]): string | undefined {
  const local = allowed.includes('local');
  const remote = allowed.includes('cloud') && allowed.includes('ssh');
  if (local && remote) return undefined;
  if (!local && !remote) return copy['code.empty.host.locked.web'];
  if (!local) return copy['code.empty.host.locked.desktop'];
  return copy['code.empty.host.locked'];
}

/**
 * Code home when no session is open and none have run yet.
 *
 * Structure follows the empty-state pattern: a framed session preview, a
 * headline about shipping on the real codebase, and a CTA that starts a
 * session on This PC, SSH, or Cloud — not a download.
 */
export function CodeEmptyHome(props: CodeEmptyHomeProps): JSX.Element {
  const allowed = () => props.capabilities.runtimes;
  const lock = () => hostLockMessage(allowed());

  const pickHost = (id: string) => {
    if (!allowed().includes(id as RuntimeKind)) return;
    props.onDraftChange({ ...props.draft, runtime: id as RuntimeKind });
  };

  const start = () => {
    const prompt = props.draft.prompt.trim() || copy['code.empty.starter'];
    props.onStart({ ...props.draft, prompt });
  };

  return (
    <div class="cx-code-empty">
      <TuiPreview />
      <h1 class="cx-code-empty__headline">{copy['code.empty.headline']}</h1>
      <p class="cx-code-empty__body">{copy['code.empty.body']}</p>
      <Segmented
        class="cx-code-empty__hosts"
        label={copy['code.empty.host']}
        value={props.draft.runtime}
        onChange={pickHost}
        options={HOSTS.map((host) => ({
          id: host.id,
          label: host.label,
          disabled: !allowed().includes(host.id),
        }))}
      />
      <Show when={lock()}>
        {(message) => <p class="cx-code-empty__lock">{message()}</p>}
      </Show>
      <Button
        variant="primary"
        class="cx-code-empty__cta"
        disabled={!allowed().includes(props.draft.runtime)}
        onClick={start}
      >
        {copy['code.empty.cta']}
      </Button>
    </div>
  );
}

/** Decorative CLI frame. Hidden from assistive tech — the copy below is the content. */
function TuiPreview(): JSX.Element {
  const rows = [
    ['session', 'this-pc', 'running'],
    ['editor', 'src/app.tsx', 'open'],
    ['preview', 'localhost', 'ready'],
  ];

  return (
    <div class="cx-code-empty__stage" aria-hidden="true">
      <div class="cx-code-empty__tui">
        <div class="cx-code-empty__tui-chrome">
          <span class="cx-code-empty__dot" />
          <span class="cx-code-empty__dot" />
          <span class="cx-code-empty__dot" />
          <span class="cx-code-empty__tui-title">Cortex Code</span>
        </div>
        <div class="cx-code-empty__tui-body">
          <For each={rows}>
            {(row) => (
              <div class="cx-code-empty__tui-row">
                <span class="cx-code-empty__tui-key">{row[0]}</span>
                <span class="cx-code-empty__tui-val">{row[1]}</span>
                <span class="cx-code-empty__tui-ok">{row[2]}</span>
              </div>
            )}
          </For>
        </div>
        <div class="cx-code-empty__tui-footer">
          <span class="cx-code-empty__tui-star">★</span>
          <span>8s · 13.3k tokens</span>
          <span class="cx-code-empty__tui-input">{copy['code.empty.preview.prompt']}</span>
          <span class="cx-code-empty__tui-model">{copy['code.empty.preview.model']}</span>
        </div>
      </div>
    </div>
  );
}
