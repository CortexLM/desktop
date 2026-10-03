# Local Projects delivery

Baseline application `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`; documentary `0597848`
preserves its package inputs. Current Projects delivery has **CI/native acceptance pending**. Seven targeted
protocol/core cases and 252 integrated units pass, with one optional backend skip.
Production confirmation passes 16 targeted Electron cases, then the full **116-case suite /
426 render visits** in 284.141 seconds, zero retries/skips/flaky outcomes. Lint/types/i18n
pass; Linux production package/smoke matches all 90 build members. CI/native acceptance
and independent local artifact audit remain pending.

Existing frozen Projects/Project, Chat move selector, Library, Search and sidebar controls
are being wired to local SQLite records. Names may duplicate; routes and memberships use IDs.
Project instructions enter model context per admitted turn. Deletion preserves chats through
an atomic detach/document-removal projection; busy roots/descendants refuse the operation.
The optional prompt `expectedProjectID` closes deletion/move races at admission.

Source inspection identified an unblocked local feature; no G2/G3/backend input is needed for
this scope. The creation and overview images supplied during implementation match the existing
composition. Their displayed content is reference data, not seeded live content.

Design request 106 in `/root/cortex-ui/DESIGN-REQUESTS.md` asks for explicit incumbent-editor
reuse for Rename and archive/restore states. Project files, sharing, assigned Bot and metadata
editing remain separate incomplete scope. No newer canonical prototype is imported.

Prepared verification covers protocol/client persistence, strict inputs, atomic rollback,
busy/admission membership rules, instruction snapshots/token budgets; real Electron creation,
instructions, project sends, move/detach, discovery, two restarts and stale-owner/draft recovery.
[Initial attempts](initial/README.md) retain the failed collector and incorrectly configured
development build. [Engine review](engine-review.md) and [UI review](ui-review.md) approve
their bounded source contracts. Production build/member/input receipts live in `production/`;
the tested dirty source is explicitly identified. The 515 package inputs remain unchanged
after the final run; renderer fingerprint `6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4`.
Linux ASAR: `5a92b306afc07184af30404d3d04ae596554ea9800bf31e3a0e3f2fd5c74d9ad`.
Existing Appearance CI/native results
certify their original source and do not verify these changes.
