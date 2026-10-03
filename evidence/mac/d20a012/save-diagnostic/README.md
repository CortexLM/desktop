# Native Save shape — diagnostic, not acceptance

The exact installed `d20a012` package admitted one controlled PNG turn, opened its saved
image from Chat with the provider disabled and displayed the ordinary native Save sheet.
Playwright used `noDefaults:true`; no download handler, synthetic anchor or chosen-path
interception was installed. The filename field retained `Cortex native portrait.png`.

Command–Shift–G opened a nested sheet with a focused AXTextField. Its actual accessibility
tree has no **Go** button. The diagnostic's cancellation guard required that button, so
the run remains **failed**: 14.398 seconds flow, 19.609 seconds including cleanup.
All seven other cleanup checks passed; the native modal required coordinator recovery.
Raw bounded AX readbacks, their hashes and the executed source remain in `manifest.json`.

After visual inspection, the coordinator sent Escape to the exact foreground PID's
nested sheet, clicked the native Cancel button and verified the modal closed. Both
helpers stopped; the ordinary app reopened in the original dark appearance.
No Save click occurred; no original-download byte equality or acceptance capture claimed.
The subsequent four-capture collector uses a separate fresh profile and root.
