/**
 * Type declarations for Prism.js grammar side-effect modules.
 *
 * @types/prismjs only declares the main entry point. The per-language grammar
 * files under `prismjs/components/*` register themselves onto the global Prism
 * instance and export nothing, so they need explicit ambient declarations to be
 * importable under `noImplicitAny`.
 *
 * A wildcard covers the whole directory: lib/syntax-highlight.ts imports ~45 of
 * these and the set changes whenever a language is added, so enumerating them
 * here would just be a second list to keep in sync. The loader map is the
 * single source of truth for which grammars we actually ship.
 */

declare module 'prismjs/components/prism-*' {
  const grammar: void;
  export default grammar;
}
