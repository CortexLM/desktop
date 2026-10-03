# Run binding and invocation

The retained manifest/log identify the completed run and exact script, ASAR, revision,
output and canonical Mac root. They do not serialize argv, working directory or Node
version. The command below fills the prepared runbook with those bound values and the
byte-identical retained local member manifest; it is a **reconstruction**, not a shell log.

```sh
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/live-state-native.mjs \
  /tmp/opencode/live-state-native-760c4a0 \
  /tmp/opencode/desktop-live-state-760c4a0 \
  bbd6dbddd5103e63d076f0edfd8afe245da1c5b858fc4883d9bd06cc70bcfc0a \
  760c4a046ce454bc8b0ab2fd85c941fec321c3ea \
  /tmp/opencode/mac-760c4a0/members.json
```

The listed interpreter is from the [prepared runbook](../scripts/live-state-native-runbook.md),
not independently attested runtime metadata. `/tmp` and `/private/tmp` roots resolve to the
same isolated Mac directory; its canonical form is stored in both installed identities.
Member manifest SHA-256: `4163d8f5044dd5d7e906d45571f20a373acd892cdb8edc2a7eafa8621656cccb`.

[Exact driver](../scripts/live-state-native.mjs), [fixture](../scripts/live-state-native-backend.mjs),
[launcher/capture helper](../scripts/launch-live-state-native.py), [source review](../harness-review.md).
Driver/fixture/inspector hashes match the runtime manifest. Fixture health/runID agrees
with [launch](../launch.json) and [backend receipt](../backend-receipt.json).

The actual retained stdout is [run.log](run.log): passed, final stage`dark:bot-ownership`.
Sanitized receipts contain fixture sentinel text, owned IDs and authorization-validation
booleans. No authorization bytes, real credentials, raw system prompts or account data.
