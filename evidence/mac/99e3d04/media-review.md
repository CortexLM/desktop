# Appearance native media reset — bounded source approval

**Approved for fresh confirmation. No source blocker found in this one-line correction; no corrected native pass claimed.**

## Exact pins
- Original driver: `230f312d902a00facc696264617629d94c20103fcdde164fadf67654d545daed` (93 lines).
- Corrected driver: `9cffda47c56978f012f6a405abe5fcdb81e3a2678c796046536ceae000e883c1` (94 lines).
- Retained diagnostic: `52e6c66604b8f32b24865dd96f45204dac4a030411fd7bf050ad6e45a1f55ace`; scratch and archived JSON are byte-identical.
- Initial failed manifest: `3075ce0c777b1c704f7a253d8b4189f5502587430b98109b5b502bc0352b5247`.

## Source and evidence findings
- Exact whole-file reconstruction passes: remove only new line36, `await page.emulateMedia({ colorScheme: null, reducedMotion: null, forcedColors: null, contrast: null });`, including its comment, and the archived original bytes are recovered. No assertion, target, action or cleanup was removed.
- Installed Playwright1.63.0 `lib/coreBundle.js:61700–61707` maps each explicit null to `"no-override"`; `:22645–22673` stores those values instead of falling back to default `"light"`/motion/contrast values.
- Chromium `coreBundle.js:38030–38043` converts each `"no-override"` into an empty feature value for `Emulation.setEmulatedMedia`. This clears emulation; it does not select a fixed light/dark theme or replace native appearance changes.
- `types/types.d.ts:2782–2813` explicitly accepts null for all four fields, including contrast, documenting that null disables each emulation.
- The reset is awaited after unique page/PID identification, before initial preference sampling and behavior actions. Watchers attach immediately afterward; their error observations cover the subsequent scenario, not pre-attachment initialization.
- Retained diagnostic records pre-reset `dark:false/theme:light/System`, then real System Events dark=true,false,true with matching renderer media/document and System selection throughout. It produced zero captures; it establishes the specific override diagnosis, not complete corrected-driver acceptance.
- Original run remains failed at `light:system-opposite-os`, **30.995 seconds**, three completed checks, zero captures. All five cleanup flags are true; stored engine reads are empty/local, fixture requests/failures/errors zero.
- Application binding remains `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`, ASAR `f0b5f9ee60b8170d69bdd7bc04fa636a44f3360bc90082d41437097b1c902aae`. Three original backend/launcher/cleanup hashes still match the failed manifest.
- Native OS assertions, unchanged group/keyboard/state checks, exact package/PID/window identity, two-capture budget and all five cleanup paths remain intact. Earlier source approval applies to original230f; this review separately approves corrected9cff.

Verification: offline byte/hash reconstruction, dependency-source/type inspection and retained JSON assertions only. No syntax rerun, helper import, runtime, device/network/CI/test/build execution or delegation. Sole write: this report. Coordinator owns the fresh-profile two-image confirmation and full-size review.
