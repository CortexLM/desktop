# Initial native geometry collector failure

The initial 24.388-second run failed before its first capture at `assert(b.visible)`.
Actual Save A, Disable and Enable had already passed: replacement B remained masked,
stored hint stayed `1111`, no extra key write occurred. All seven driver cleanup checks
passed; no native image or complete-run acceptance follows from this attempt.

A single controlled diagnosis repeated that flow and recorded every ancestor clip.
The password input's border box was `[631,358,831,392]`; its own `overflow: clip` client
box was `[632,359,830,391]`. The collector incorrectly required the control's border
inside its own content clip, rejecting its 1px border. All six targets were hit-testable;
other targets passed geometry. Original measurements and restored keyless state are in
`diagnostic.json`; no application/CSS modification was made.

The corrected collector applies clipping ancestors only when `node !== el`; opacity
still includes the element itself. Viewport bounds, ancestor clipping, text geometry,
hit tests, draft assertions and package identity checks remain active. The original
driver, failed manifest/log and diagnostic bytes stay retained here.
