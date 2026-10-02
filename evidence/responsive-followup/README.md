# Narrow-window corrections — 5610ee9

Application revision: `5610ee9ffedb6028d7a2fa2674d4abb53eb391db`.

CI screenshot review at `5ced8aa` identified two concrete defects:

- Work's four fixed-minimum columns overflowed the page at the 960×640 minimum.
  Native CSS grid now wraps columns; vertical wheel scrolling reaches every card/drop zone.
  1440-wide windows retain four columns.
- Refusal toasts covered model/send controls in bottom-docked Chat/Code composers.
  At widths up to 1100, those transcript toasts sit below the titlebar. The selector excludes
  nested Work computer docks so the computer's top controls remain accessible.

Verification: **46/46 local Electron tests**, zero retries/flaky/skips, **426 state renders**;
lint, types, i18n audit and packaged Linux smoke pass. The suite requires immediate recovery
control access while the refusal is still visible; Chat changes model without dropping its
draft/image. Six board cases cover both themes at 960/1024/1440.

`source.json` pins the renderer inputs. The targeted `compare/` run records 28 renders against
the original freeze (Chat, Code session, Work home/task), maximum difference 0.47%; source
matches this commit. It supplements the revision-scoped full 410-reference comparison, not
a recapture of the whole app. `screens/` contains six inspected correction captures.

Fresh CI/installed-Mac proof is tracked in `../STATUS.md`. Later fidelity corrections have
their own source scope; this directory preserves the responsive patch's actual results.

[CI 37021275153](https://github.com/CortexLM/desktop/actions/runs/37021275153) passes checks,
**46/46 Electron cases per Linux/macOS**, zero retries/flaky/skips, unsigned macOS packaging
and launch smoke. Uploaded Mac Work/Chat/Code correction screenshots were inspected.
All 84 targeted comparison PNGs are retained as pixel-identical WebP files; the original
PNG hashes remain in `compare/report.json`, conversion hashes in `compare/retained.json`.
