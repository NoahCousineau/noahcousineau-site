# CLAUDE.md — noahcousineau.com

@AGENTS.md

## What this project is

Portfolio site rebuild (Next.js 16, App Router, TypeScript, Tailwind v4).
Migrating off Webflow. Content for ~13 project case-study pages lives in
`src/content/projects.json`; `src/components/project/ProjectGroup.tsx` is the
generic renderer that turns that JSON into the image/video grids on each
`/work/[slug]` page.

## Artboard-unit system (critical — read before touching layout)

Everything is sized in a custom unit `--u` = 1/1920 of the container width,
NOT px/vw/vh. `calc(var(--u) * N)` is the standard pattern throughout the
codebase. When asked to resize/reposition something, convert to this unit
system rather than using raw pixels.

Key constants in `ProjectGroup.tsx`:
- `GRID_MARGIN_UNITS = 40` — left/right page margin for project grids.
- `GAP_UNITS = 48` — gap width in "gapped" rows (poster-style rows).
- `IMAGE_QUALITY = 100` — next/image quality param used site-wide.

## Project grid content model (`projects.json`)

Each project's `pageData.groups[]` is a named section (e.g. "Gallery
Material", "Social Media") containing `rows[]`. Each row has an `aspect`
("w/h" string) and `cells[]`. Two rendering paths per cell:

- **`fit: true`** — cell height is driven by the image's OWN natural aspect
  ratio at its column width; the row's declared `aspect` is ignored. Used
  when you want the grid to hug the image exactly.
- **`scale: N`** (20–200) — image renders inside a box locked to the row's
  `aspect`, scaled via CSS transform from center. Use for intentionally
  under/oversized images inside a fixed-size cell.

### The "gap under image" bug and its fix

When two `fit: true` cells sit side-by-side in a row and their SOURCE
images have even slightly different aspect ratios (or the columns end up
a few px different in width, e.g. because of a border), each cell computes
its own height independently — the shorter one leaves a visible gap below
it before the row's bottom rule.

**Fix:** add `cropAspect: "W/H"` (a locked shared aspect ratio, usually
matching one of the two source images' actual pixel dimensions) to BOTH
cells in the row. This makes `object-cover` top-aligned crop each image to
the exact same height regardless of column-width rounding.

Also: prefer an absolutely-positioned overlay div for the divider line
between cells over a CSS `border-left` on the second cell — a border steals
a few px of that cell's width from the grid track and reintroduces the
mismatch this fix is trying to solve.

### Drop shadows on images

Use `shadow: true` on a cell + `fit: true` (not `scale`) so the shadow is
applied to an element whose box IS the actual visible image — applying a
shadow to a `scale`+`fill`+`object-contain` wrapper creates visible dead
space around the "shadow" that doesn't track the image's real edges.

## Password gate

Protected `/work/*` pages require `SITE_PASSWORD` (see `.env.local`,
template in `.env.example`). The gate cookie does not always persist across
fresh page loads in automated browser sessions — if you're testing with a
headless browser and hit a password wall unexpectedly, just re-submit
`/password`.

## Commands

```bash
npm run dev             # http://localhost:3000
npm run build            # production build — run this after any layout change
npm run lint
npm run qa:responsive    # overflow + JS errors at 3 breakpoints (needs dev/start running)
npm run qa:assets        # every image decodes on every project page (needs dev/start running)
```

## Verification habit

After any visual/layout change: run `npm run build` (must exit 0), then
load the live page and measure the actual DOM (`getBoundingClientRect`,
`getComputedStyle`) rather than trusting a description of the fix — several
past "fixes" looked right in code but didn't change on-page pixels because
the wrong element in the render tree was being targeted.
