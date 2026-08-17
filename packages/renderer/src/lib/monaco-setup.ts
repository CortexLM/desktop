/**
 * Monaco loader configuration.
 *
 * `@monaco-editor/react` defaults to fetching Monaco from the jsDelivr CDN. In a
 * packaged desktop app that is wrong twice over: the editor never loads without
 * internet access (it sits on "Loading..." forever, since the request neither
 * resolves nor rejects quickly), and it reaches out to a third party for code we
 * already ship.
 *
 * Pointing the loader at the bundled `monaco-editor` package makes the editor
 * work offline and keeps everything local.
 *
 * Import this module for its side effect before rendering any <Editor />.
 */

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Vite resolves these worker imports and bundles them, so no CDN and no
// separate worker-file copying step.
// Paths are relative to the package's exports map, which already roots subpaths
// at `esm/vs` ("./*": "./esm/vs/*.js"). Repeating the `esm/vs/` prefix does not
// resolve.
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(workerId: string, label: string): Worker;
    };
  }
}

window.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Use the bundled instance rather than downloading one.
loader.config({ monaco });

// Expose the namespace the way the CDN loader used to. Some Monaco
// contributions and tooling look for `window.monaco`, and the loader no longer
// sets it when handed a pre-bundled instance.
(window as unknown as { monaco?: typeof monaco }).monaco = monaco;

export { monaco };
