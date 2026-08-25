/**
 * The Home composer's draft, held above the route that renders it.
 *
 * `HomeRoute` used to own this in a local signal. Solid disposes a route's scope when you
 * navigate away, so typing a task, glancing at Sessions and coming back lost the text — which
 * is exactly the moment someone checks a repository name or an earlier run before sending.
 * There was no error and no warning; the box was simply empty again.
 *
 * Module scope rather than a context provider: there is one composer in the app, its draft is
 * not derived from anything, and nothing else needs to read it. A provider would add a layer
 * whose only job is to outlive a route.
 *
 * Deliberately *not* persisted to disk. An unsent prompt reappearing on the next launch, with
 * no indication of when it was written, is worse than an empty box.
 */

import { createSignal } from 'solid-js';

import type { RuntimeKind } from '@cortex-ide/cortex-api';

// The screen's own prop type is the canonical shape. Declaring a parallel one here would give
// the draft two definitions free to drift apart.
import type { SessionDraft } from '../screens/home/home-screen.tsx';

const [draft, setDraft] = createSignal<SessionDraft>({ prompt: '', runtime: 'local' });

export { draft as composerDraft, setDraft as setComposerDraft };

/**
 * Clears the draft once a session has actually been started from it.
 *
 * Takes the runtime rather than resetting to `local`, so the choice the user just made is not
 * silently undone between one session and the next.
 */
export function resetComposerDraft(runtime: RuntimeKind): void {
  setDraft({ prompt: '', runtime });
}
