# Files collector corrections — bounded native proof

**Use the 30-byte header-only WebP below for native-decode refusal. No application defect established.**
Exactly one Electron diagnostic launch/batch, six fixtures; Electron 44.5.1 / Chrome 152.0.7977.130, Linux. Native `function decode() { [native code] }`; no decoder override.
`/tmp/opencode/files-corrupt-fixture/receipt.json` SHA-256: `8b9332fc1d501f32fa16aba9993794bc85dac777c1ef2cd5b3411bb8c9646f62`.
Probe/fixtures: same directory, `probe.mjs`, `fixtures.json`, binary originals/mutations, `probe.log`. Before/after main/preload/all renderer files, raster source and E2E hashes match.

## Proven fixture
`webp-header-only.webp`, 30 bytes; SHA-256 `b1ab638798a6b0b3f6adddb524063a24820b32c830d6e7289b1d5b9cdb94b4f3`.
Original native-canvas WebP's 10-byte VP8 frame/dimension header retained; pixel payload removed, RIFF/chunk lengths rebuilt correctly. No new application validation.
Pure current `readRaster` import: **ok:true**, 240×120, bytes unchanged. Native Blob/image decode: **false**, `EncodingError`, “The source image cannot be decoded.”, natural dimensions **0×0**.
Raster source SHA-256: `3aaacb7094d26554ebb1e61973e026a05a4067fe0f13714ebca4f2f26388ced7` (pure function imported with Node 24 native TypeScript stripping; no transpilation/build).
Candidate E2E replacement for the current corrupt-image input only:
```ts
const unreadableWebP = "UklGRhYAAABXRUJQVlA4IAoAAAAQCgCdASrwAHgA";
const corrupt = await save(page, [{ type: "file", mime: "image/webp", data: unreadableWebP }]);
```
Keep existing native-decode-call count increase, cannot-open text and absent visible image assertions. Header-budget PNG and APNG cases remain distinct.
Valid controls JPEG (942 bytes) and WebP (624 bytes): preflight true, native decode true, 240×120. Removed JPEG quantization/all tables and zeroed WebP payload still decoded true; retain these negative experiments.
Earlier PNG receipt `/tmp/opencode/files-decode-probe/receipt.json` remains untouched (SHA-256 `7a3a72e681c23f104ab4f41ac341909995b78455e72a0742d9a187bc3a609cd3`): all four PNG variants decoded true. Structural preflight explicitly omits entropy/CRC guarantees.

## No-model setup correction
`packages/core/src/provider.ts:57–58,72–77` persists PATCH without publishing an event; mounted model selection need not refresh. After the prior accepted send clears input/files, PATCH disabled, **reload before entering “No-model draft”**, then retain every no-model/draft/Open assertion.
Minimal insertion: `await page.reload();` between provider PATCH and `toHaveText("No model")`. FileReader was already restored/disposed at original test `:274`; prior POST hold released. Main-owned IPC gate survives reload safely; no restoration required for reload. Transition handle is created afterward in the fresh realm.

## Binding
No application/E2E-source edits, build, app E2E, network endpoint, provider/session writes, CI/Mac or delegation. Renderer observed HTTP requests: none; catalog was empty data URI. Fresh isolated engine/profile initialization only.
Native fixture proof only; corrected engine-admission/UI execution remains coordinator-owned. Initial baseline/6-of-8 target remain bound to untouched E2E SHA `e28ddaece53de11cde6ed26581d085b2b002c2d3bf62ccb303f23e22938e327e`; no retroactive pass attribution.
A later read-only hash observed concurrent E2E source `0982831cc5fc8a569bdd0a08b5e13515cc3796de717283fb53ce6fd42ecdf1e6`; this post-probe revision was neither edited nor executed in this diagnostic.
