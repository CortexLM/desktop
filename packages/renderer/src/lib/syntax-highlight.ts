/**
 * Lazy syntax highlighting
 *
 * Prism.js (~120KB with languages) and DOMPurify are only needed once a code
 * block is actually rendered, so nothing here is imported statically. Everything
 * loads on first use and is cached for the lifetime of the renderer.
 *
 * Why an explicit loader map instead of `import(\`prismjs/components/prism-${lang}\`)`:
 * a template-literal dynamic import makes the bundler emit a chunk for *every*
 * file matching the pattern (all ~290 Prism languages), which defeats the point.
 * Listing the languages we support keeps each one a separate, on-demand chunk.
 */

type PrismModule = typeof import('prismjs');

/**
 * Languages we ship grammars for. Values load the grammar into Prism.
 *
 * Each entry becomes its own on-demand chunk, so adding a language costs
 * nothing until a code block actually uses it. Keep this list to languages
 * that plausibly appear in chat answers, notes or workspace docs.
 */
const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  // `javascript`, `css`, `markup` and `clike` ship inside Prism core, so they
  // need no loader. `clike` matters because many grammars below extend it.
  javascript: async () => undefined,
  css: async () => undefined,
  markup: async () => undefined,
  clike: async () => undefined,

  // Web / JS ecosystem
  typescript: () => import('prismjs/components/prism-typescript'),
  jsx: () => import('prismjs/components/prism-jsx'),
  tsx: () => import('prismjs/components/prism-tsx'),
  scss: () => import('prismjs/components/prism-scss'),
  // Sass's indented syntax is a separate grammar, not an alias of scss.
  sass: () => import('prismjs/components/prism-sass'),
  less: () => import('prismjs/components/prism-less'),
  graphql: () => import('prismjs/components/prism-graphql'),

  // Data / config / markup
  json: () => import('prismjs/components/prism-json'),
  yaml: () => import('prismjs/components/prism-yaml'),
  toml: () => import('prismjs/components/prism-toml'),
  ini: () => import('prismjs/components/prism-ini'),
  markdown: () => import('prismjs/components/prism-markdown'),
  diff: () => import('prismjs/components/prism-diff'),
  sql: () => import('prismjs/components/prism-sql'),
  http: () => import('prismjs/components/prism-http'),
  protobuf: () => import('prismjs/components/prism-protobuf'),
  hcl: () => import('prismjs/components/prism-hcl'),

  // Shell / ops
  bash: () => import('prismjs/components/prism-bash'),
  powershell: () => import('prismjs/components/prism-powershell'),
  docker: () => import('prismjs/components/prism-docker'),
  makefile: () => import('prismjs/components/prism-makefile'),
  nginx: () => import('prismjs/components/prism-nginx'),
  git: () => import('prismjs/components/prism-git'),

  // General purpose
  python: () => import('prismjs/components/prism-python'),
  rust: () => import('prismjs/components/prism-rust'),
  go: () => import('prismjs/components/prism-go'),
  java: () => import('prismjs/components/prism-java'),
  kotlin: () => import('prismjs/components/prism-kotlin'),
  scala: () => import('prismjs/components/prism-scala'),
  c: () => import('prismjs/components/prism-c'),
  cpp: () => import('prismjs/components/prism-cpp'),
  csharp: () => import('prismjs/components/prism-csharp'),
  objectivec: () => import('prismjs/components/prism-objectivec'),
  swift: () => import('prismjs/components/prism-swift'),
  dart: () => import('prismjs/components/prism-dart'),
  ruby: () => import('prismjs/components/prism-ruby'),
  php: () => import('prismjs/components/prism-php'),
  perl: () => import('prismjs/components/prism-perl'),
  lua: () => import('prismjs/components/prism-lua'),
  r: () => import('prismjs/components/prism-r'),
  groovy: () => import('prismjs/components/prism-groovy'),
  zig: () => import('prismjs/components/prism-zig'),
  solidity: () => import('prismjs/components/prism-solidity'),
  elixir: () => import('prismjs/components/prism-elixir'),
  erlang: () => import('prismjs/components/prism-erlang'),
  haskell: () => import('prismjs/components/prism-haskell'),
  clojure: () => import('prismjs/components/prism-clojure'),

  // Prerequisite for `php`; also valid on its own for templated markup.
  'markup-templating': () => import('prismjs/components/prism-markup-templating'),
};

/**
 * Grammars that must be present before another grammar can be registered.
 * Prism extends existing languages, so order matters (tsx builds on jsx +
 * typescript). Mirrors the `require` field of Prism's own components.json.
 */
const LANGUAGE_DEPENDENCIES: Record<string, string[]> = {
  typescript: ['javascript'],
  jsx: ['markup', 'javascript'],
  tsx: ['jsx', 'typescript'],
  scss: ['css'],
  sass: ['css'],
  less: ['css'],
  markdown: ['markup'],
  'markup-templating': ['markup'],
  php: ['markup-templating'],
  go: ['clike'],
  java: ['clike'],
  scala: ['java'],
  c: ['clike'],
  cpp: ['c'],
  csharp: ['clike'],
  objectivec: ['c'],
  dart: ['clike'],
  ruby: ['clike'],
  groovy: ['clike'],
  protobuf: ['clike'],
  solidity: ['clike'],
  kotlin: ['clike'],
};

/** Common aliases mapped onto the grammar that actually handles them. */
const LANGUAGE_ALIASES: Record<string, string> = {
  // JS/TS
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  // Shell
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ksh: 'bash',
  console: 'bash',
  ps1: 'powershell',
  pwsh: 'powershell',

  // Markup
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  // `vue` and `mdx` are deliberately absent: mapping them onto markup/markdown
  // mis-highlights their embedded script and JSX. Plain text is more honest.

  // Data / config
  yml: 'yaml',
  webmanifest: 'json',
  jsonc: 'json',
  json5: 'json',
  cfg: 'ini',
  conf: 'ini',
  dockerfile: 'docker',
  tf: 'hcl',
  terraform: 'hcl',
  make: 'makefile',
  proto: 'protobuf',
  patch: 'diff',
  gql: 'graphql',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  plsql: 'sql',

  // General purpose
  py: 'python',
  python3: 'python',
  rs: 'rust',
  golang: 'go',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  dotnet: 'csharp',
  objc: 'objectivec',
  rb: 'ruby',
  kt: 'kotlin',
  kts: 'kotlin',
  hs: 'haskell',
  sol: 'solidity',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  cljs: 'clojure',
  pl: 'perl',
  rscript: 'r',
};

let prismPromise: Promise<PrismModule> | null = null;
let sanitizerPromise: Promise<typeof import('dompurify').default> | null = null;
let themePromise: Promise<unknown> | null = null;

/** In-flight/settled grammar loads, keyed by canonical language name. */
const grammarPromises = new Map<string, Promise<void>>();

/** Resolve an alias (or raw language tag) to a canonical grammar name. */
export function normalizeLanguage(language: string): string {
  const lower = (language || '').trim().toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

/** True when we have a grammar available for this language tag. */
export function isLanguageSupported(language: string): boolean {
  return normalizeLanguage(language) in LANGUAGE_LOADERS;
}

/** List of canonical languages we can highlight. */
export function supportedLanguages(): string[] {
  return Object.keys(LANGUAGE_LOADERS);
}

/** Load Prism core exactly once. */
function loadPrism(): Promise<PrismModule> {
  if (!prismPromise) {
    prismPromise = import('prismjs').then((mod) => {
      const prism = ((mod as unknown as { default?: PrismModule }).default ??
        mod) as PrismModule;
      // Prism's grammar files register themselves against the global instance,
      // so expose it before any component module is imported.
      (globalThis as unknown as { Prism?: PrismModule }).Prism = prism;
      return prism;
    });
  }
  return prismPromise;
}

/** Load DOMPurify exactly once. */
function loadSanitizer() {
  if (!sanitizerPromise) {
    sanitizerPromise = import('dompurify').then(
      (mod) => (mod as unknown as { default: typeof import('dompurify').default }).default ?? mod
    );
  }
  return sanitizerPromise;
}

/**
 * Load the colour theme stylesheet exactly once.
 *
 * Uses our token-driven theme rather than one of Prism's shipped themes:
 * those hardcode a single palette (prism-tomorrow is dark-only), which broke
 * in light mode. syntax-theme.css resolves its colours from tokens.css and so
 * follows the `.dark` class automatically.
 */
export function loadHighlightTheme(): Promise<unknown> {
  if (!themePromise) {
    themePromise = import('../styles/syntax-theme.css');
  }
  return themePromise;
}

/** Ensure a grammar (and its prerequisites) is registered with Prism. */
async function loadGrammar(language: string): Promise<void> {
  const existing = grammarPromises.get(language);
  if (existing) return existing;

  const loader = LANGUAGE_LOADERS[language];
  if (!loader) {
    // Nothing to load; caller falls back to plain text.
    return;
  }

  const task = (async () => {
    await loadPrism();
    for (const dep of LANGUAGE_DEPENDENCIES[language] ?? []) {
      await loadGrammar(dep);
    }
    await loader();
  })();

  grammarPromises.set(language, task);

  try {
    await task;
  } catch (error) {
    // Allow a later attempt to retry rather than caching the failure forever.
    grammarPromises.delete(language);
    throw error;
  }
}

export interface HighlightResult {
  /** Sanitized HTML safe to inject, or null when highlighting was unavailable. */
  html: string | null;
  /** Canonical language actually used for highlighting. */
  language: string;
}

/**
 * Highlight a code string, loading Prism, the grammar and DOMPurify on demand.
 *
 * Returns `html: null` when the language is unsupported or highlighting fails,
 * in which case the caller must render the raw code as plain text. The returned
 * HTML is always sanitized, so it is safe for `dangerouslySetInnerHTML`.
 */
export async function highlightCode(
  code: string,
  language: string
): Promise<HighlightResult> {
  const canonical = normalizeLanguage(language);

  if (!isLanguageSupported(canonical)) {
    return { html: null, language: canonical };
  }

  try {
    // Theme is requested alongside the grammar so styles land with the markup.
    const [prism] = await Promise.all([
      loadPrism().then(async (p) => {
        await loadGrammar(canonical);
        return p;
      }),
      loadHighlightTheme().catch(() => undefined),
    ]);

    const grammar = prism.languages[canonical];
    if (!grammar) {
      return { html: null, language: canonical };
    }

    const highlighted = prism.highlight(code, grammar, canonical);

    const sanitizer = await loadSanitizer();
    const html = sanitizer.sanitize(highlighted, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class', 'style'],
      ALLOW_DATA_ATTR: false,
    });

    return { html, language: canonical };
  } catch (error) {
    console.error(`Syntax highlighting failed for "${canonical}":`, error);
    return { html: null, language: canonical };
  }
}
