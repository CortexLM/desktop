# Historical — test setup launch failure

- Two cases timed out at 25 seconds awaiting the first Electron window.
- Cause: test setup explicitly supplied empty `CORTEX_RENDERER_URL`; main accepts it through nullish fallback. The override was removed before the genuine negative.
- No provider interaction/assertion reached; this is not application-defect evidence.
- [Raw report](report.json.gz), [raw log](log.txt.gz), [run command](run.json).
- Original scratch: `/tmp/opencode/provider-draft-regression/setup-attempt-empty-renderer-url`.
