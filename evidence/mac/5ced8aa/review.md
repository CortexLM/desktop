# Native artifact review — 5ced8aa

Scope: existing installed-app captures under `evidence/mac/5ced8aa/`; macOS window rendering,
native chrome and obvious blank-content failures. Application revision
`5ced8aa1d2eb04ed3131ffb40c0d360e5706526d`; recorded LaunchServices launch.
Recorded app SHA-256: `8b9cac0ca48e54622a7705ec237110a8b027663e5c7889c702be9566eeb7eedd`.

## Artifact checks already completed

426 manifest records, 426 unique capture names/routes, 426 WebP files; 213 light and 213 dark.
All decoded dimensions are **1024×685**. All WebP SHA-256 values matched the manifest;
the app hash matched `install.json`; manifest `errors` is empty. These are file/metadata
checks, not assertions about visual quality. Original PNGs are absent from this local folder,
so PNG-to-WebP RGBA equality was not independently repeated in this review.

## Final bounded visual assessment

**No new native-chrome defect or unexplained blank main-content area established.**
The known Work-board overflow remains visible in this baseline.

All eleven contact sheets were opened. Detailed contact-sheet review remains partial;
retained readable sheets `contact-02.jpg`, `contact-03.jpg`, `contact-08.jpg`,
`contact-09.jpg`, `contact-10.jpg` and `contact-11.jpg` support the conclusions here.
Opening an image is not counted as exhaustive review of its constituent frames.

Full-resolution observations used for the final assessment:
- `screens/home-light.webp` and `screens/home-dark.webp`.
- `screens/bot-studio-light.webp`.
- `screens/work-home~board-light.webp`.
- `screens/code-dark.webp`.

- Both Home frames visibly include native red/yellow/green window controls. Controls are
  separate from sidebar/history buttons; no overlap or broken titlebar is visible. Main
  heading, composer and suggestions render in both themes.
- Bot Studio, Work and Code also show native window controls separate from application
  navigation. Their main areas contain the mascot/editor, task board and coding composer/task
  list respectively. Bot Studio content continues below the captured viewport; this image
  does not establish reachability of every editor control.
- No unexplained blank main-content area established in these contact sheets. Sparse search,
  loading, error and notification states contain their expected state UI; that is not proof
  of functional completeness.
- The known Work board overflow is visible in this baseline: rightmost columns extend beyond
  the initial content viewport at 1024×685. It is the previously accepted issue, not a new
  finding. Specifically, `screens/work-home~board-light.webp` shows three columns while Done
  lies beyond the right edge. The coordinator reports a subsequent fix; these baseline images
  neither verify nor contradict that later result.

## Limits

Contact-sheet visual screening is lower-resolution than individual-frame inspection. Hashes,
decode success and zero recorded page errors do not prove control reachability, layout fidelity,
live workflows, translation quality or motion. This registered-route sweep contains no focus-mode
verification. Menus/native actions and later `8b90a8e` captures are outside this review.
Native control positions were visually screened, not measured against a pixel baseline.
No additional capture, app interaction, build or test was performed. Full original acceptance
is not claimed; this report finalizes the bounded review with its partial visual coverage explicit.
