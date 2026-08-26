import { render } from 'solid-js/web';

import { App } from './app.tsx';

const root = document.querySelector('#root');

if (!root) {
  // Failing loudly beats rendering nothing: a silent no-op here looks identical to a build
  // that produced no JavaScript at all.
  throw new Error('No #root element to mount into. Check index.html.');
}

render(() => <App />, root);
