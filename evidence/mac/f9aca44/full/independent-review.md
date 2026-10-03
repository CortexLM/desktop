# Installed Cortex f9aca44 — independent retained-capture audit

## Scope and provenance

- Read-only audit of `evidence/mac/f9aca44/full/{capture-manifest.json,manifest.json,screens/*.webp,contact-*.jpg}`, corresponding originals in `/tmp/opencode/current-full-native-f9aca44`, and its `menus/` capture set. Only this report is written.
- Application revision: `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`. Capture manifests identify installed ASAR SHA-256 `23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77`, native window `8012`, timestamp `2026-10-03T00:42:33.775Z`.
- Coordinator supplied the ASAR/application mapping to CI `37080136101`, artifact `11258159964`, separately retained package/member proof. This audit does not independently re-establish that package chain or query CI.
- Read `AGENTS.md`, all nine `.rules/*.md`, registry and registration inputs. Terminal auditor; no delegation, app/source/retention edits, build, test suite, recapture, Mac/CDP access or native actions.

## Integrity and coverage — verified locally

| Check | Result |
| --- | --- |
| Original PNG SHA-256 against retention manifest | 426/426 match |
| Retained WebP SHA-256 against retention manifest | 426/426 match |
| Decoded original/retained pixel equality | 426/426 exact RGBA byte equality, including transparent RGB and alpha |
| Image dimensions | 426/426 PNG and WebP pairs: 1024×686 |
| Image modes and alpha | All originals/retained images RGBA; every alpha channel spans 0–255 |
| Unique images | 426 distinct original file hashes; 426 distinct decoded RGBA hashes; no duplicate pixel images |
| Capture names/routes | 426 unique names; 426 unique routes; original/retained manifest order and route identity match |
| Original capture manifest | Byte-identical to retained `capture-manifest.json` |
| Registry coverage | Exact 213 registered states × light/dark; zero missing/extra state-theme routes |
| Page errors | Both capture manifests record `errors: []`; no independent runtime observation |
| Menus | 14/14 PNG hashes match menu manifest; 14 unique files; all 1024×768 |

Registry coverage was derived with static TypeScript AST inspection, without executing the app: Bots 5 screens/11 states; Chat 12/47; Code 9/30; Files 10/34; System 16/56; Work 9/35. Total 61 screens/213 states. All 11 registration inputs read were byte-identical to the application revision in local Git.

The source PNG directory is concurrently used by the coordinator. An extra `fullscreen.png` appeared during enumeration; it is outside the 426-row manifest and this audit, not a missing registry capture. Retained `screens/` had no extra WebPs.

### Fingerprints

- `capture-manifest.json` and original `manifest.json`: `db107cd975d614dfb839f6e7863fea8525061c170429fc94b8d27c09ce893af6`
- Retained `manifest.json`: `fe0d7463edb2f641dffff086e969ff5d0c9148c489d12a66ac87b07c3e2caeb6`
- Original `menus/manifest.json`: `33b905e9f5e50194bf140779c50c924e2244aae781848fe691e8072b60b5a91d`

Contact-sheet hashes were computed, not compared against a supplied independent digest:

```text
contact-01.jpg ac84b9b64d0d92517a9a6b417f01ba1b617406bf28dffd9d4f2c1cd727a191e5
contact-02.jpg 9692fab51a47e1c6a0e099ae76a01bc57974ebe0253cb9f8d4989bb9eca02bc7
contact-03.jpg aa96a390753c58a7bd5b36145ed5f75e803198040645be059e2730b82af57b03
contact-04.jpg 41abb670562d618c3483cace6412cfafbcbead7111cb4c715535e6348eba983b
contact-05.jpg e98b79407ecb6bae36eb0ec0c380233030d6a4ecb820093143cc29b8db90320d
contact-06.jpg f6488e77d2dd29fb5bb7c1d197f09df69622cb6aad2cdcdb334aa8fbb208af5b
contact-07.jpg 01bb7e5cb8194c106e1ed561692315829b16d59f555fa2c17ff22a1bf55eb532
contact-08.jpg 62eebe3fd1c261459ebad7d3ff3ce8b6cfbe75917fbf6cb4c90a82ee17baaf4e
contact-09.jpg 95e3d7d000e3381fca5368374236b99ec60dc5f98fc8fe3acda53fdf435f3e51
contact-10.jpg f6ef8a514874d4fcd5a97a3e522556f3a245e3af69ec1ae6903cf145063301fa
contact-11.jpg 3482fd4ef3ebdd0f8eb62a803e68967561c18ced2d6b08293b90a85b3cd12bbb
```

## Visual review — complete, bounded to retained f9aca44 captures

Inspected all **11 contact sheets**, **74 distinct full-resolution WebPs spanning all 61 registered screen families**, **4 original PNG counterparts**, and **all 14 full-resolution native-menu PNGs**. Counts are unique files, not repeated opens. The 426-pair integrity check is exhaustive; the full-resolution visual sample is not all 426 states.

### Concrete findings at 1024×686

1. **DOCX Comments: comment pane cut off horizontally.** `file-docx~comments-light.webp` and `file-docx~comments-dark.webp`: the document occupies nearly the entire content pane; only a narrow strip of the comment cards remains at the right window edge. Names, comment text and Reply controls are cut off. The original PNG counterparts reproduce the same pixels. This is a visible preview-layout defect at the captured size. A static image does not establish whether horizontal scrolling or hiding the sidebar can recover the pane.
2. **Code Settings → Approvals: labels run into descriptions.** `code-settings~approvals-light.webp` and `code-settings~approvals-dark.webp`: the first row reads `modelFor new tasks and reviews`; the notification row reads `waitingDesktop and phone notification`. Label and explanatory text lack visual separation after wrapping. Both themes show the defect; no runtime interaction is needed to observe it.
3. **Code diff → Side by side: incomplete comparison in the initial viewport.** `code-diff~split-light.webp` and `code-diff~split-dark.webp`: the captured pane shows the old/removed-code column; the second comparison column is outside the visible pane, with long lines cut off at its right edge. Record as a viewport limitation requiring a scrolling/layout check, **not proof that the second column is unreachable**. No such check was performed here.

### Interpretation boundaries

- Bottom-edge truncation of long document pages, settings lists, Bot Studio choices, Work boards and transcripts is not by itself an unreachable-control defect. The capture records one scroll position. These cases do not receive minimum-window acceptance from this review.
- Loading skeletons, empty results, blocked/refused/error states and dark modal backdrops are intentional registered preview states. Their presence is not a blank-render failure or evidence of a live API failure.
- White document pages and media artwork inside dark shells are not wrong-theme evidence. No additional whole-screen blank or wrong-theme defect is established by this bounded review.
- Exact mascot pose/activity differences are excluded: the sweep retains shared preview state across hash navigation. These captures cannot establish a live-state leak.
- Settings → Providers shows its preview provider/key form; the lower rows continue below the captured viewport. This is not proof of live key handling or model-row responsiveness.

### Native menus

All seven menu families were opened as retained images in both themes: Cortex, File, Edit, View, Go, Window, Help. All 14 image hashes match. Each light/dark pair has identical `accessibleItems` strings in the manifest.

The retained Go screenshot visibly dims **Space**, **Scheduled**, **Plugins and Skills**, consistent with the f9aca44 blocked-surface policy. The manifest includes their labels but no enabled-state fields. Its `missing value` entries are not sufficient evidence of unnamed actionable controls: separators and the Help search element can occur in this flattened listing. No menu command execution, shortcut response, focus order or complete accessibility-tree conformance is established.

### Exact visual inventory

Contact sheets: `evidence/mac/f9aca44/full/contact-01.jpg` through `contact-11.jpg` inclusive. Sheets 01–10 are 1280×2460; sheet 11 is 1280×1722.

Full-resolution WebPs below are relative to `evidence/mac/f9aca44/full/screens/` (**74 files**):

```text
about-light.webp
activity~filtered-light.webp
approvals~detail-dark.webp
automation-edit~event-dark.webp
automations~failed-light.webp
bot-dark.webp
bot-new-light.webp
bot-roster~hierarchy-light.webp
bot-settings~permissions-dark.webp
bot-studio-dark.webp
bot-studio-light.webp
canvas~document-dark.webp
canvas~selection-light.webp
chat-light.webp
chat-states~rich-dark.webp
chat-states~sources-light.webp
code-dark.webp
code-diff~split-dark.webp
code-diff~split-light.webp
code-env~error-dark.webp
code-pr~failed-light.webp
code-review~review-dark.webp
code-session-light.webp
code-settings~approvals-dark.webp
code-settings~approvals-light.webp
code-tasks~attempts-dark.webp
code-terminal~approval-light.webp
command~submenu-dark.webp
components-dark.webp
connectors~error-light.webp
deep-research~done-dark.webp
error~maintenance-light.webp
file-audio~transcribing-dark.webp
file-code~diff-light.webp
file-docx~comments-dark.webp
file-docx~comments-light.webp
file-image~view-dark.webp
file-pdf~reading-light.webp
file-pdf~summary-dark.webp
file-pdf~summary-light.webp
file-pptx~editing-light.webp
file-video~paused-light.webp
file-xlsx~chart-dark.webp
file-zip~tree-dark.webp
history-dark.webp
home-dark.webp
home-light.webp
image-gen~results-light.webp
inbox~normal-light.webp
library-light.webp
login~locked-dark.webp
memory~list-dark.webp
memory~list-light.webp
notifications~settings-dark.webp
offline~offline-dark.webp
onboarding~2-light.webp
pricing~plans-light.webp
profile~delete-dark.webp
project~sharing-dark.webp
projects~create-light.webp
search-results~results-light.webp
search~results-light.webp
settings~connection-dark.webp
settings~providers-dark.webp
settings~providers-light.webp
share~disabled-dark.webp
shortcuts-light.webp
temp-chat~active-light.webp
update~ready-dark.webp
upload~errors-light.webp
voice~listening-dark.webp
work-home~board-dark.webp
work-home~board-light.webp
work-task~blocked-dark.webp
```

Original full-resolution PNGs opened visually, relative to `/tmp/opencode/current-full-native-f9aca44/` (**4 files**, duplicating retained WebP compositions):

```text
file-docx~comments-light.png
file-docx~comments-dark.png
code-diff~split-light.png
settings~providers-light.png
```

Native menus opened visually, relative to `/tmp/opencode/current-full-native-f9aca44/menus/` (**14 files**):

```text
cortex-light.png
cortex-dark.png
file-light.png
file-dark.png
edit-light.png
edit-dark.png
view-light.png
view-dark.png
go-light.png
go-dark.png
window-light.png
window-dark.png
help-light.png
help-dark.png
```

## Disposition

Retention integrity and registry coverage pass. Visual review establishes two concrete preview defects plus a bounded side-by-side-diff viewport concern. This report closes the retained-image audit; it does not approve every screen/control or newer application revisions. Later recovery/authentication work and native-action evidence remain separate from this original f9aca44 set.

## Claim limits

- These are static native-window captures of preview/shot routes, not proof of live control behavior, persistence, backend availability or motion.
- A 1024×686 image does not establish complete 960×640 minimum-window acceptance, larger-window acceptance, keyboard/scroll reachability or responsive correctness of hidden content.
- Preview shared state persists across hash navigation; Bot pause/activity can carry into later Home captures. Dynamic mascot pose differences are not independently a defect.
- No frozen-reference pixel comparison or all-screen full-resolution review is claimed. Contact-sheet inspection supplements explicitly listed full-resolution inspections.
- Menu accessibility strings are a retained label listing, not a complete accessibility tree, enabled-state assertion or proof that commands execute.
- New-memory reproduction belongs to a separate agent; this audit does not reproduce it.
