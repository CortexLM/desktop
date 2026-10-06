# React renderer

Use the existing React 19/Base UI kit in `src/kit/ui.tsx` and shared components
in `src/components`; `src/kit/styles.css` owns theme tokens.
`src/registry.tsx` discovers `src/screens/*/index.tsx` exports. Preserve screen
IDs, variant IDs and design provenance when changing registration.
`src/api.ts` reconstructs fetch responses from the preload bridge. Keep local
engine calls there rather than introducing a second transport.
`src/preview.tsx` owns fixture and temporary Bot state; live/preview transitions
must not transfer fixture state or stale asynchronous results to a new owner.
Inspect `src/shell` and `src/state` before changing route or preference lifetime.

Run `bun run audit:i18n` from root for copy changes. Renderer acceptance uses
`bun run build && bun run test:e2e`; see `../../docs/testing.md` for targeted
cases and visual evidence. Rebuild before checking `cortex://app`.
