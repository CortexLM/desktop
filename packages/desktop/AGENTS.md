# Electron host

`src/main.ts` owns engine lifetime and adapts IPC to `createServer(core).fetch`.
Keep `src/preload.ts` plain-data wire shapes aligned with `../app/src/api.ts`;
stream cancellation must release the sender's reader and listeners.
`src/credentials.ts` and `src/windows-credentials.ts` own storage and migration;
failed Windows migration must preserve the original ciphertext.
`src/remote-session.ts` owns authentication, encrypted native device pairs and refresh;
access-only web grants remain process-local. `src/remote-chat.ts`
adapts its account-epoch Chat binding. Read `../../docs/connection-modes.md`
before changing origin, cancellation, replay or ownership behavior.

`build.mjs` consumes `release-config.mjs`; staging configuration is compiled into
main. Tests live in `test/`: `bun run test -- packages/desktop/test` from root.
Host/bridge changes also need the built Electron suite under `../../tests/e2e`;
unit transport fixtures do not establish installed-native or real-account acceptance.
