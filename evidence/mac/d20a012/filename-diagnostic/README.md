# Filename Range versus painted pixels

Same installed `d20a012`, fresh profile, one controlled PNG turn; actual light/System
appearance at960×640. Two whole-window native originals capture the normal filename,
then the same element with only temporary `overflow:visible`. All DOM rectangles,
font values, clip ancestry, viewport, native window/PID and filename coordinates remain
equal. The original inline style is restored before cleanup.

**Both PNG files are byte-identical:**
`f1152f2820297bf2d0764fbbc0687e39bd063f5e7da0eee55f68209506aeba8f`.
Padded filename crop `[383,58,551,86]` likewise has zero changed RGBA pixels.
Both originals were inspected full-size; one lossless canonical retains their pixels.
For this exact normal filename, the one-pixel nominal Range extension loses no glyph ink.

Status **observed**, not acceptance:36.883s flow/40.280s total, two captures/four native
samples, ten cleanup checks pass. One fixture inference, zero renderer/backend errors.
The launcher verifies owned exit, stops helpers and reopens ordinary Cortex in dark mode.
No Save, dark image, zoom or long-filename acceptance follows from this diagnostic.
The first native run remains failed. A collector correction must stay bound to these
exact filename/font/geometry conditions, preserving all other clipping and hit checks.
