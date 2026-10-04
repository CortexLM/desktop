# Native Save — manual completion supplement

The a2 collector dispatched a genuine Download, then its AppleScript failed before
operating the native Save sheet (`-1700`, element-reference coercion). Its cancellation
path failed identically. The collector remains **failed**; its cleanup deleted the
owned Chat/key and restored the home route while the dispatched Save sheet remained open.

The coordinator inspected that sheet through the Mac GUI, verified foreground PID78150,
sent Command–Shift–G, entered the exact fresh directory, verified the focused path and
pressed Return. The GUI showed `native-download` and `Cortex native portrait.png`;
the coordinator clicked the visible Save button at608,409 and observed the sheet close.
No new Download, inference, fixture write or destination interception was introduced.
GUI guard screenshots were inspected in-session, not retained as archive originals.

[File readback](receipt.json) retains all393 downloaded bytes as base64, inode/device
and SHA-256 `35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf`.
The bytes equal the original fixture exactly, including its tEXt metadata. This proves
the pending native download's delivery, not successful automated Save-dialog execution.
[Cleanup](cleanup.json) removes only that regular single-link, exact-byte file; its
inode/device match the readback. The dispatched download outlived logical Chat deletion,
as documented. No physical-erasure claim follows.
