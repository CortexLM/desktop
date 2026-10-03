# Memory native collector correction — source-only review

**APPROVED.** No blocking defect found in this bounded collector correction.
Reviewed `/tmp/opencode/memory-native-corrected.mjs`, 111 lines.
SHA256: `d1eaeea3ae44d0b32fc0903e67c860a0d8c2444b93ab23a0a997f4c1f17c4b8e`.
Baseline `/tmp/opencode/memory-native.mjs`, 104 lines, SHA256 `370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9`.

- Exact diff: usage filename, native appearance/sample collection, executing-file self-hash. Everything from member-manifest checks through actions/captures/cleanup is byte-identical.
- Lines 23–30 retain Swift CoreGraphics/AppKit window/PID/bounds/foreground sampling; only its UserDefaults appearance field is removed.
- Python invokes fixed executable argv, passing Swift as `sys.argv[1]`; shell quoting preserves both scripts as single arguments. `String.raw` content uses Python 3.9-compatible syntax/APIs.
- System Events exit status must equal zero; stdout must be exactly `true\n` or `false\n`. JSON preserves that embedded newline despite SSH output trimming. No default, fallback or truthiness conversion replaces OS validation.
- Up to 12 decoded samples are saved before validation. Successful four-image flow makes exactly eight calls, two per image; invalid status/output/rows remain in the manifest.
- Active window, installed PID, one-window count, 960×640 bounds and expected OS theme assertions remain. Stable window ID plus full before/after window equality remain enforced.
- Window and appearance reads are sequential, not atomic: Swift ≤10 seconds, System Events ≤3 seconds, SSH ≤15 seconds. Small sampling interval remains; pre/post-image identity checks are preserved. Actual timing remains unproven.
- Four captures/120-second staged flow, original-image byte budgets, native screenshot helper, text clipping/hit/focus checks and owned-data cleanup are unchanged. No new API, credential, inference or screenshot route.
- Line 37 hashes the executing `import.meta.url` file under its corrected basename; all three helper hash checks remain unchanged.
- Retained initial receipt confirms failure at 20.330 seconds, zero requested images, eight cleanup passes. Separate light diagnostic proves conflicting appearance readbacks; the missing original sample leaves its failing conjunct unknown.
- Coordinator-reported launch refusals remain separate preflight evidence; they do not establish collector success or invalidate prior exact-package admission.

Approval covers source only, for the separately admitted `96df66c` package and coordinator-owned fresh attempt. Native results require their own receipts/pixels.
Performed local reads, diff/byte comparison and hashes only. No import/runtime, syntax-check rerun, Mac, CI/network, build/test or capture executed. Only this review written.
