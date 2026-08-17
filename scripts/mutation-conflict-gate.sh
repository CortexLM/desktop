#!/usr/bin/env bash
# Mutation harness for the conflict save gate.
#
# Applies one mutation at a time to product code, runs the renderer store +
# editor suites, records whether the suite went red, and reverts. A mutation that
# SURVIVES a green suite is a hole in the tests.
#
# The control mutation is the point of the whole exercise: a semantically neutral
# comment reformulation must SURVIVE. A harness that kills 32 of 32 might be
# killing noise, and would report the same 100% either way.
set -uo pipefail
cd /root/projects/cortex-ide

STORE=packages/renderer/src/store
EDITOR=packages/renderer/src/views/editor
PRISTINE=/tmp/mutation-pristine
rm -rf "$PRISTINE" && mkdir -p "$PRISTINE"
cp "$STORE/conflict-resolution.ts" "$PRISTINE/"
cp "$STORE/editor-store.ts" "$PRISTINE/"
cp "$EDITOR/save-actions.ts" "$PRISTINE/"
cp "$EDITOR/ConflictResolutionDialog.tsx" "$PRISTINE/"
cp "$EDITOR/TabManager.tsx" "$PRISTINE/"

revert() {
  cp "$PRISTINE/conflict-resolution.ts" "$STORE/conflict-resolution.ts"
  cp "$PRISTINE/editor-store.ts" "$STORE/editor-store.ts"
  cp "$PRISTINE/save-actions.ts" "$EDITOR/save-actions.ts"
  cp "$PRISTINE/ConflictResolutionDialog.tsx" "$EDITOR/ConflictResolutionDialog.tsx"
  cp "$PRISTINE/TabManager.tsx" "$EDITOR/TabManager.tsx"
}
trap revert EXIT

run_suite() {
  bunx vitest run --project renderer \
    src/store src/views/editor >/tmp/mutation-run.txt 2>&1
}

#
# Guards against the harness's own worst failure mode: a substitution whose
# pattern does not match changes nothing, the suite stays green, and the result is
# reported as SURVIVED — indistinguishable from a genuine hole in the tests. M6
# did exactly this on the first run. Every mutation is now checked to have
# actually altered the file before its result is believed.
assert_applied() {
  local id="$1"
  if diff -rq "$PRISTINE" /tmp/mutation-current >/dev/null 2>&1; then
    printf '  FAIL %-4s NOT-APPLIED  the pattern did not match; result would be meaningless\n' "$id"
    return 1
  fi
  return 0
}

snapshot_current() {
  rm -rf /tmp/mutation-current && mkdir -p /tmp/mutation-current
  cp "$STORE/conflict-resolution.ts" /tmp/mutation-current/
  cp "$STORE/editor-store.ts" /tmp/mutation-current/
  cp "$EDITOR/save-actions.ts" /tmp/mutation-current/
  cp "$EDITOR/ConflictResolutionDialog.tsx" /tmp/mutation-current/
  cp "$EDITOR/TabManager.tsx" /tmp/mutation-current/
}

# $1 = id, $2 = expectation (killed|survives), $3 = description
report() {
  local id="$1" expect="$2" desc="$3"

  snapshot_current
  if ! assert_applied "$id"; then
    revert
    return
  fi

  if run_suite; then
    local outcome=SURVIVED
  else
    local outcome=KILLED
  fi
  local failed
  failed=$(grep -oE 'Tests +[0-9]+ failed' /tmp/mutation-run.txt | head -1 || true)
  if [ "$expect" = killed ] && [ "$outcome" = KILLED ]; then
    printf '  OK   %-4s %-9s %s  (%s)\n' "$id" "$outcome" "$desc" "${failed:-n/a}"
  elif [ "$expect" = survives ] && [ "$outcome" = SURVIVED ]; then
    printf '  OK   %-4s %-9s %s\n' "$id" "$outcome" "$desc"
  else
    printf '  FAIL %-4s %-9s %s  <-- expected %s\n' "$id" "$outcome" "$desc" "$expect"
  fi
  revert
}

echo "Baseline (no mutation, must be green):"
if run_suite; then
  echo "  OK   green: $(grep -oE 'Tests +[0-9]+ passed' /tmp/mutation-run.txt | head -1)"
else
  echo "  FAIL baseline is red; mutation results would be meaningless"
  exit 1
fi

echo
echo "Mutations that must be KILLED:"

# M1 — remove the save gate entirely. The mission, deleted.
perl -0pi -e "s/if \(tab\.diskState === 'conflict'\) return \{ save: false, reason: 'conflict', tabId: tab\.id \};/\/\/ M1: gate removed/" "$STORE/conflict-resolution.ts"
report M1 killed "planSave no longer blocks a conflict"

# M2 — invert keep-mine / take-disk in the planner. Destroys user work silently.
perl -0pi -e "s/return action === 'take-disk' \? \{ apply: 'adopt', file: result\.file \} : \{ apply: 'write' \};/return action === 'take-disk' ? { apply: 'write' } : { apply: 'adopt', file: result.file };/" "$STORE/conflict-resolution.ts"
report M2 killed "planResolutionApply swaps keep-mine and take-disk"

# M3 — invert the same pair one level up, in the sequencing.
perl -0pi -e "s/if \(plan\.apply === 'adopt'\) \{/if (plan.apply === 'write') {/" "$EDITOR/save-actions.ts"
report M3 killed "resolveConflict treats a write plan as an adopt"

# M4 — swap the two labels. The buttons now lie about what they destroy.
perl -0pi -e "s/  keepMine: 'Keep my version \(overwrite the file on disk\)',\n  takeDisk: 'Use the file on disk \(discard my unsaved edits\)',/  keepMine: 'Use the file on disk (discard my unsaved edits)',\n  takeDisk: 'Keep my version (overwrite the file on disk)',/" "$STORE/conflict-resolution.ts"
report M4 killed "the two destructive labels are swapped"

# M5 — apply the resolution to the wrong tab.
perl -0pi -e "s/  const saved = await attemptSave\(deps, tab\.id, \{ force: true \}\);/  const saved = await attemptSave(deps, tabId === tab.id ? tab.id : tabId, { force: true });\n  \/\/ M5 placeholder/" "$EDITOR/save-actions.ts"
perl -0pi -e "s/    deps\.applyDiskVersion\(tab\.id, plan\.file\.content, plan\.file\.mtime\);/    deps.applyDiskVersion(deps.getTab(tab.id) ? 'tab-1' : tab.id, plan.file.content, plan.file.mtime);/" "$EDITOR/save-actions.ts"
report M5 killed "take-disk adopts into a hard-coded tab id"

# M6 — applyDiskVersion hits every tab, not the named one.
#
# The `applyDiskVersion` body is matched via its unique `unsavedContentDropped`
# field so the substitution cannot silently miss (an unmatched regex reports
# SURVIVED, which is indistinguishable from a real test hole — this mutation was
# a false SURVIVED on the first run for exactly that reason).
perl -0pi -e "s/(applyDiskVersion: \(tabId, content, mtime\) => \{.*?)tab\.id === tabId/\${1}true || tab.id === tabId/s" "$STORE/editor-store.ts"
report M6 killed "applyDiskVersion discards edits on every tab"

# M7 — drop the re-read staleness check before applying.
perl -0pi -e "s/  if \(changedAgain\) return \{ apply: 'refuse', reason: 'changed-again' \};/  \/\/ M7: staleness check dropped/" "$STORE/conflict-resolution.ts"
report M7 killed "a stale diff is written without re-checking disk"

# M8 — the missing panel gets the conflict panel's discard button.
perl -0pi -e "s/    case 'missing':\n      return MISSING_PANEL;/    case 'missing':\n      return CONFLICT_PANEL;/" "$STORE/conflict-resolution.ts"
report M8 killed "the missing panel offers to discard the only copy"

# M9 — a failed write is reported as a success.
perl -0pi -e "s/  if \(!written\.ok\) return \{ status: 'failed', tabId: tab\.id \};/  if (!written.ok) return { status: 'saved', tabId: tab.id, mtime: 0 };/" "$EDITOR/save-actions.ts"
report M9 killed "a failed write clears the dirty flag"

# M10 — the blur autosave stops going through the gate.
perl -0pi -e "s/  if \(!options\.force\) \{/  if (false) {/" "$EDITOR/save-actions.ts"
report M10 killed "attemptSave always forces, bypassing the gate"

# M11 — the indicator no longer opens the dialog.
perl -0pi -e "s/    openConflictDialog\(tabId\);/    \/\/ M11: indicator no longer opens the dialog/" "$EDITOR/TabManager.tsx"
report M11 killed "clicking the indicator does nothing"

# M12 — the dialog opens for a tab with nothing to resolve.
perl -0pi -e "s/        if \(!planResolutionPanel\(tab\.diskState\)\) return;/        \/\/ M12: guard removed/" "$STORE/editor-store.ts"
report M12 killed "openConflictDialog accepts a clean tab"

# M13 — cancel silently clears the conflict flag.
perl -0pi -e "s/  if \(action === 'cancel'\) \{\n    \/\/ Deliberately leaves/  if (action === 'cancel') {\n    deps.acknowledgeDiskState(tabId);\n    \/\/ Deliberately leaves/" "$EDITOR/save-actions.ts"
report M13 killed "cancel clears the conflict it declined to resolve"

# M14 — a successful save no longer advances the baseline.
perl -0pi -e "s/                  baselineMtime: mtime \?\? tab\.baselineMtime,/                  baselineMtime: tab.baselineMtime,/" "$STORE/editor-store.ts"
report M14 killed "a save does not move the conflict baseline"

# M15 — destructive buttons become clickable before the diff loads.
perl -0pi -e "s/                  isApplying \|\| \(spec\.destroys !== 'nothing' && panel\.showsDiff && !diffReady\)/                  isApplying/" "$EDITOR/ConflictResolutionDialog.tsx"
report M15 killed "destructive actions are enabled with no comparison shown"

# M16 — a hand-merge is silently dropped before the write.
perl -0pi -e "s/        deps\.updateTabContent\(tab\.id, merged\);/        \/\/ M16: merge dropped/" "$EDITOR/ConflictResolutionDialog.tsx"
report M16 killed "the hand-merged pane is discarded before writing"

echo
echo "Control mutation, must SURVIVE (proves the harness is not killing noise):"

# C1 — reword a comment. Semantically neutral: nothing observable changes.
perl -0pi -e "s/\/\*\* The subset of a tab the save gate reads\. Satisfied structurally by \`EditorTab\`\. \*\//\/** The part of a tab that the save gate looks at; \`EditorTab\` satisfies it structurally. *\//" "$STORE/conflict-resolution.ts"
report C1 survives "a comment is reworded"

# C2 — rename a local variable. Also neutral.
perl -0pi -e "s/  const \{ content, mtime \} = result\.file;\n  const changedAgain =/  const { content, mtime } = result.file;\n  const wasReplacedSince =/; s/  if \(changedAgain\) return/  if (wasReplacedSince) return/" "$STORE/conflict-resolution.ts"
report C2 survives "a local variable is renamed"

echo
echo "Done."
