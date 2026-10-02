# Draft, runtime-copy and discovery corrections

Application revision: `0e63f876bbe3d0fe893c6c698ff3fadb6dcec702`.
CI: [36997513479](https://github.com/CortexLM/desktop/actions/runs/36997513479), all three
jobs green. CodeQL/analysis also pass; zero open PR alerts at this read-back.

- `units.log`: 131 pass, one optional backend skip. `real-backend.log`: 44 stub cases
  plus one real-backend discovery check pass through the SDK (45/45 total).
- `lint.log`, `types.log`, `audit.log`: no errors; two existing hook warnings. Copy audit:
  62 files, 1,743 used keys, 2,683 English keys, zero findings.
- `e2e-linux.log`: 12 pass, 426 registered preview state renders, no retries. The sweep
  now checks accessibility/tooltip attributes as well as visible text for raw catalog keys.
- `draft-regression.log`: final 960×640 light/dark regression; refused home/chat sends retain
  text/files, pending reads block send, failed reads preserve other files, historical retry
  resends its own image after a different intervening prompt. Four PNGs inspected.
- `linux-smoke.log`, `linux-packaged.png`: final packaged revision launches under Xvfb. An initial
  invocation without a display failed to open a window; the headless invocation passed.
- `ci.json`, `macos-packaged.png`: Blacksmith macOS 26 builds, packages unsigned arm64 and
  launches the binary. Both Linux and macOS pass all 12 Electron tests without retries,
  flakes or skips. Four macOS draft-regression screenshots and packaged renderer inspected;
  native CI capture still lacks Screen Recording permission. Existing titles remain intact.
- [Design report](../compare/README.md): 28 refreshed renders, 18 reference comparisons;
  all remain below 1%, maximum 0.78%. Ten Settings reference images remain absent.
- [Installed Mac](../mac/0e63f87/README.md): final GUI-launched artifact, 426 native
  screen captures and 14 distinct light/dark menus; fullscreen/minimize and native
  Gallery/Chat navigation observed. Launch-context failures retained in the action record.

Runtime fixes cover nine identified leaks, not all possible program dataflow. Existing
English session titles remain data because their authorship cannot be distinguished.
Remote discovery is still not authentication or inference. Missing designs and the remaining
acceptance gaps in [STATUS.md](../STATUS.md) prevent a complete-delivery claim.
