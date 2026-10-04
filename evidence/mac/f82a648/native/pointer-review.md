# Projects native toast correction — APPROVED, source only

Current driver SHA-256 independently verified: `d5f261e5ea8ebb5ccb278a4a9cc4c4f4fe93679a300fe375ed087c10c986cc2c`.
Retained `/tmp/opencode/projects-native-before-toast.mjs` verified: `43f443aeca84688ef867eae89c629878f592e2bcd3601f17fef3be1ffdd57584`.
Diff changes only line 95: hover `.systeme-phead h1`, await zero `.toast` elements, then perform the existing Edit instructions click.

`/tmp/opencode/projects-native-f82a648-confirm/manifest.json:863` literally records `<div class="t-body">` intercepting pointer events while Edit instructions is visible, enabled and stable; click times out after 10000 ms.
That manifest records 47.147 s, one passed 960×640 native create capture, fourteen passing geometry/hit targets, six successful cleanup checks, owned Project deletion and zero inference/errors.
`kit/ui.tsx:186–190` binds `.t-body` to the toast. `projects.tsx:50` creates the success toast before navigation.
`App.tsx:45` explicitly sets 4000 ms lifetime; Base UI's unused default is 5000 ms. `ToastViewport.mjs:111–141` pauses on mouse enter/move and resumes on leave while focused.
Moving to the heading therefore addresses the observed obstruction without force-clicking, deleting UI or relaxing assertions. Manifest proves interception; hover-paused lifetime is source-supported diagnosis, not a captured timer trace.

4000 ms lifetime plus 460 ms exit transition fits the existing 10000 ms toast-count wait. Both theme waits remain bounded; the partial 47.147 s failure does not prove full-flow completion within 120 s.
Four-capture budget, fourteen targets, geometry/fonts/focus checks, 120-second stage budget, ownership cleanup and all subsequent assertions remain unchanged.
The earlier `/tmp/opencode/projects-native-f82a648/manifest.json` separately records HTTP 500, no retained original, 29.782 s and five successful cleanup checks. Capture-host/TCC attribution is coordinator-provided, not proven by HTTP 500 alone.
Both failed attempts remain failed evidence; both manifests bind the same `f82a648` revision, ASAR and 90-member manifest.

Only source/retained-manifest inspection, local diff and hashing performed. No driver execution, device/network access, tests or new screenshots.
Fresh-root execution and four-image acceptance remain pending; coordinator owns host permission provenance, lease and final OS restoration receipts.
