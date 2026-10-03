# Projects native source review — BLOCKED

Reviewed `/tmp/opencode/projects-native.mjs` (114 lines), runbook, reused helpers, current Projects/Chat/schema/core source and installed Base UI source.
Driver SHA supplied by coordinator: `a1b93962907eb870b95d7d7629029759411feb2e4251f7755f9006d1f9aef76e` (not independently rehashed).
Application revision supplied: `8e3fd795b699c8ff07357544421d00f34dc2823c`; package/CI admission remains coordinator-owned.
Source inspection only; no execution, syntax recheck, builds, tests, CI query, network or device access.

## Blocking correction

**Final OS appearance restoration is undone by shared cleanup.** Driver lines 105–107 restore its starting OS/theme/route correctly, but `evidence/mac/99e3d04/scripts/cleanup-terminal-state-native.py:23` subsequently forces dark.
Runbook lines 158–174 call that helper, then release the lease; they acknowledge the override without restoring the original OS appearance. An initially light Mac remains dark.
Required: coordinator records pre-run OS appearance; after unchanged shared cleanup/ordinary-app reopen, restores and verifies that exact value before lease release. Record this final restoration separately from the driver's isolated-profile restoration. No helper modification needed.

## Source contracts accepted

- Exact English labels/selectors match `packages/app/src/screens/system/projects.tsx`; create/edit/delete use incumbent UI. Calendar→Rocket and Violet→Orange/Teal match source ordering.
- Per-theme root Chat POST matches strict `SessionCreateInput`; arbitrary keyless model references are accepted at creation. No prompt route or provider-key write exists in the driver.
- JSON response shape matches complete session comparison; Project deletion removes only `projectID`, preserving session/model/title/times and empty messages (`packages/core/src/storage.ts:92–95`).
- Seven empty-list guards/local signed-out guard precede writes; cleanup allows captured owned IDs only. Unknown IDs remain isolated and fail emptiness verification.
- Four capture requests maximum; originals retained before post-capture assertions; no capture retry. PID/window/ASAR/all distribution-member checks use future package arguments, not Linux hashes.
- CDP media defaults released; actual OS light/dark checked. Fourteen explicit targets per image retain clipping, opacity, text ranges and center hits. Native input/textarea self-scrollbox exception remains narrow, with value-fit checks.
- Base UI radio inputs are separate visually hidden siblings (`RadioRoot.mjs:148–156,217–220`); excluding them from visible target geometry preserves button hit checks. Counts/hidden attributes/Tab stops remain checked.

## Claim limits / documentation

- Font readiness establishes settled loading, not glyph/font correctness; original-pixel review remains required. Geometry covers listed targets, not every text node or descendant clipping/mask.
- Sidebar Chat verification proves exact URL and engine identity, not completed Chat-body rendering; it immediately clicks See all. Add a visible live Chat-title assertion only if body-render acceptance is claimed.
- Runbook lines 7–8 describe an earlier dirty preparation state; mark historical or update to the supplied committed revision before archiving.
- Approval here cannot establish native success, CI status, nonempty transcript preservation, inference, restart behavior or completion of the broader user goal.
