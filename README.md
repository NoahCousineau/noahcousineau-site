# noahcousineau.com

Portfolio rebuild — migrating off Webflow to Next.js.

**Status:** Phase 2 scaffold. Structure, routing, and content are real; visual
design and motion are placeholders awaiting Illustrator direction.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind v4 + CSS custom properties |
| Scroll | Lenis |
| Animation | GSAP + ScrollTrigger |
| 3D | Three.js / React Three Fiber |
| Hosting | Vercel |

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
npm run qa:responsive   # overflow + JS errors at 3 breakpoints
npm run qa:assets       # every image decodes on every project page
```

Both QA scripts need a server running (`npm run dev` or `npm run start`).

## Structure

```
src/
  app/
    page.tsx              HOME — unique, fully custom (placeholder)
    about/page.tsx        ABOUT — unique, fully custom (placeholder)
    work/page.tsx         WORK INDEX — project grid
    work/[slug]/page.tsx  PROJECT SCAFFOLD — drives all 13 projects
    globals.css           DESIGN TOKENS — colors, type scale, motion vocabulary
  components/
    SmoothScroll.tsx      Lenis + GSAP ticker sync, reduced-motion aware
    project/
      ProjectScaffold.tsx ProjectHero / ProjectSection / MediaGrid /
                          MediaFull / VideoEmbed
  content/
    projects.json         Generated content for all 13 projects
  lib/
    projects.ts           Types + helpers (getProject, getAdjacent, assetPath)
public/assets/            Web-optimized WebP derivatives (44 MB)
```

## Assets

Original-resolution masters live in `~/Desktop/portfolio/assets` (505 MB) and are
**not** in this repo. `public/assets` holds WebP derivatives capped at 2560px
(44 MB, 91% smaller).

To regenerate after adding new masters:

```bash
cd ~/Desktop/portfolio && .venv/bin/python build_assets.py
```

## The project scaffold

Every project page shares one skeleton, composed from `ProjectScaffold.tsx`:

```
ProjectHero      title · disciplines · intro
ProjectSection   heading · caption · media
  MediaFull      full-bleed single image
  MediaGrid      1 / 2 / 3-up responsive grid
  VideoEmbed     video moment
ProjectNav       prev · all work · next
```

Adding a project = add an entry to `projects.json` and drop assets into
`public/assets/<slug>/`. No new route file needed.

## Password gate

All project pages (`/work`, `/work/[slug]`) sit behind a single password. Enter
it once, all 13 projects unlock, and you move freely between them. Return from
any project goes to Home or About — exactly the flowchart.

**Where the password lives:** `SITE_PASSWORD` env var on Vercel (and locally for
dev). Set it before deploy. Default locally is unset, which makes `/api/unlock`
return 500 until configured — that's intentional, not a bug.

**How it works:**

- `src/proxy.ts` — Next.js 16 "Proxy" (the renamed Middleware). Runs before any
  gated request and 307-redirects to `/password` if the cookie is missing or
  invalid. No un-gated content ever renders.
- `src/app/api/unlock/route.ts` — checks the password (constant-time compare)
  and, on success, has `src/lib/gate.ts` issue a signed (HMAC) httpOnly cookie.
- `src/lib/gate.ts` — signing + verification. A forged cookie fails the HMAC
  check and is rejected.

**Honest limitation:** this is a portfolio gate, not real authorization. The
cookie stops casual browsing and can't be forged, but the image files in
`/public/assets` remain reachable by direct URL. That's the normal tradeoff for
a portfolio and matches what the old Webflow password did. If you ever need
genuine protection for a specific client project, that's a different
conversation (private storage + signed expiring URLs).

**To change the password:** set `SITE_PASSWORD` on Vercel. Old cookies keep
working until they expire (1 year) — bump `GATE_SECRET` to invalidate everyone.

- [ ] Home page design + load animation (9 letter SVGs are vectors, individually animatable)
- [ ] About page design
- [ ] Per-project section layouts and custom moments
- [ ] Self-hosted video to replace the 10 Vimeo/YouTube embeds
- [ ] Page transitions
- [ ] 3D / WebGL moments
- [ ] Real typefaces
- [ ] DNS cutover from Webflow
