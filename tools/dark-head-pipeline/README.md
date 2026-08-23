# Dark-mode head pipeline

Regenerates the dark-mode (sunglasses) head assets from the raw turntable
photography. Not part of the site build — run by hand when the source photos
or the treatment change, then commit the outputs.

## What it produces

| Output | Built by |
| --- | --- |
| `public/images/rotating-head/sprite-sheet-dark-staggered.webp` | `build_dark_frames_from_edit.py` → `assemble_sheet.py` |
| `public/assets/about/head-dark.png`, `eye-*-dark.png` | `build_dark_roll_from_edit.py` |
| `public/assets/about/head-noneck.png` | see "Light head" below — **not** generated here |

## 2026-08-22: Noah cut the dark heads himself

> "I also took the time to manually edit the images used for the dark mode
> head. I'm sharing a folder that has the darkmode silhouetted and color
> corrected heads. I also included a version of the head to use for the eye
> tracking in dark mode. I removed the eyes from this."

That retires everything below this heading that MAKES a cut-out — the
closed-form matting, the R−B shirt test, the exposure transfer, the sheen
repair. `matte.py`, `build_dark_frames.py` and `build_dark_roll.py` are kept
for the record; the `*_from_edit.py` pair is what runs. His sources:

- `02-edited-frames/dark-mode_NoahEdit/DarkMode{1..32}.psd` — turntable
- `01-raw-photos/DarkModeNoEyes.psd` — the rolling head, eye holes cut

What still has to happen is REGISTRATION, for the reason given under
"Running it": his crops are each tight to their own silhouette at a different
pixel size, so each is fitted back into the shared 2400×3600 frame over its
light counterpart. Measured over the skull, that lands at IoU 0.90–0.97, and
the neck's end wanders less than the old automatic set did (σ 80px against
147px, against the light set's own 69px) — so no collar trimming is applied
and his silhouette ships untouched.

The old notes on matting, exposure and sheen follow.

Sources live outside this repo, in `~/Desktop/portfolio/rotating-head-turntable/`.

## Why it is not just "run rembg"

The dark-mode shoot was done with the flash OFF, which creates three
problems that look like one problem ("the clipping is bad") and need three
different fixes. `matte.py` documents each in detail; the short version:

1. **Soft edge.** A plain u2net mask is binary, so hair wisps are all-in or
   all-out. Closed-form matting over a trimap recovers fractional alpha, and
   `estimate_foreground_ml` recovers true foreground colour at those pixels,
   undoing the wall's contribution to them.

2. **Exposure.** A Reinhard transfer fitted from the light-mode frames over
   warm pixels only (skin and hair, excluding the grey wall and black tee,
   which would drag the fit). The dark shoot needs roughly 1.19–1.29x per
   channel. Coefficients are baked into `colour_transfer.npy`; regenerate
   them if either shoot is re-shot or re-graded.

3. **Blown sheen.** The ambient blew out the top of the hair — flat, no
   strand texture. Colour correction alone turns it cream rather than grey,
   and a global highlight rolloff strong enough to fix it flattens every
   face. Handled by cutting the unrecoverable band and then SMOOTHING the
   contour, plus `tame_blowouts` for what survives, which judges each blown
   patch by the luminance of the ring around it (hair < 130, skin 140–190)
   so real specular highlights on a nose are left alone.

**Order matters.** Shirt removal runs BEFORE the exposure transfer: the
transfer scales channels unequally and pushes even a pure black tee to a
warmth of ~12, which defeats the R−B test that identifies it.

## Running it

```bash
cd ~/Desktop/portfolio/noahcousineau-site
python3 tools/dark-head-pipeline/build_dark_frames_from_edit.py   # 31 turntable frames
python3 tools/dark-head-pipeline/assemble_sheet.py \
  ~/Desktop/portfolio/rotating-head-turntable/02-edited-frames/dark-mode-noah \
  public/images/rotating-head/sprite-sheet-dark-staggered.webp DarkMode
python3 tools/dark-head-pipeline/build_dark_roll_from_edit.py     # the rolling head
```

`build_dark_frames.py` writes PNGs to
`rotating-head-turntable/02-edited-frames/dark-mode/`. Assemble them into the
sprite sheet with a 6×6 grid of 960×1440 cells, in the order
`[1..27, 29..32]` — frame 28 is skipped because the light set is missing it,
and the two sets must stay index-aligned.

Each dark frame is registered onto its LIGHT counterpart rather than merely
centred, because the light frames were hand-aligned and `RotatingHead`'s
per-frame corrections (`lightModeStaggeredAdjustments`) are calibrated
against them. Scale is locked to the median across all frames and only
translation is fitted per frame — the camera distance was fixed, so
per-frame scale estimates are noise that would pulse the head's size through
the loop.

## Light head

`public/assets/about/head-noneck.png` is NOT generated here. It is Noah's own
export — `design/02-about-me/AboutMeHead - Light Mode - No Eyes No Neck.png`
— cropped to its opaque bounds. His clipping is cleaner than anything
automatic. `make_head.py` is kept only for the superellipse neck cap it
implements, which `build_dark_roll.py` reuses.

If either head is re-exported, re-measure and update `src/lib/headAssets.ts`:
the aspect ratio, and the eye socket centres as fractions of the cropped box.
Both build scripts print those numbers.
