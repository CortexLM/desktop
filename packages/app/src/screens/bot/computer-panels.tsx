import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import type { ApiFilePreview, ApiFsEntry } from '@cortex-ide/cortex-api';

export function TerminalPanel(props: {
  log: string;
  onRun: (command: string) => void;
}): JSX.Element {
  let field: HTMLInputElement | undefined;
  return (
    <section class="cx-product-row" aria-label="Terminal">
      <div>
        <div class="cx-product-row__title">Terminal</div>
        <pre class="cx-product-row__meta">{props.log || 'A real shell on this mascot’s box.'}</pre>
        <input
          ref={field}
          class="cx-product-row"
          placeholder="ls"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const command = event.currentTarget.value.trim();
            if (!command) return;
            event.currentTarget.value = '';
            props.onRun(command);
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            const command = field?.value.trim() ?? '';
            if (!command) return;
            field!.value = '';
            props.onRun(command);
          }}
        >
          Run
        </Button>
      </div>
    </section>
  );
}

export function FilesPanel(props: {
  entries: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  onOpen: (path: string) => void;
}): JSX.Element {
  return (
    <section class="cx-product-row" aria-label="Files">
      <div>
        <div class="cx-product-row__title">Files</div>
        <Show
          when={props.entries.length > 0}
          fallback={<p class="cx-product-row__meta">No listing from this box yet.</p>}
        >
          <For each={props.entries}>
            {(entry) => (
              <button type="button" class="cx-product-row" onClick={() => props.onOpen(entry.path ?? entry.name)}>
                <span class="cx-product-row__title">{entry.name}</span>
              </button>
            )}
          </For>
        </Show>
        <Show when={props.preview}>
          {(file) => <pre class="cx-product-row__meta">{file().text ?? file().content ?? ''}</pre>}
        </Show>
      </div>
    </section>
  );
}
