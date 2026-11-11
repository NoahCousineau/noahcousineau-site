/*
 * Builds one share card per project: public/assets/<slug>/share-card.jpg.
 *
 * WHY (2026-11-11). Two problems with what the pages were sharing before.
 *
 *  1. FORMAT. A project's og:image was its `cover`, and four of the five
 *     covers are .webp — the format the image pass converted them to for the
 *     page itself. Browsers all read WebP; link unfurlers are a different
 *     population of software, and LinkedIn in particular has never been
 *     reliable with it. A share card is the one image on the site that is
 *     never fetched by a browser, so it is the one place to stay on JPEG.
 *
 *  2. SIZE AND SHAPE. The covers are whatever shape the artwork is — a
 *     portrait poster, a 3.3:1 logo lockup — and every platform crops to
 *     roughly 1.91:1 and wants at least 1200px across. Letting them crop
 *     means letting them choose what to cut off.
 *
 * So each card is rendered here at exactly 1200x630, and each project says
 * how its artwork should meet that frame:
 *
 *   cover   — the source is a photograph that reads full-bleed, and is wide
 *             enough that a 1.91:1 crop keeps the subject.
 *   contain — the source already sits on white (studio shots, a mockup, a
 *             poster, a logo), so the card extends that white rather than
 *             cutting into the artwork. `pad` leaves a margin so the subject
 *             is not jammed against the edge of the frame.
 *
 * TO REGENERATE: node tools/build-share-cards.mjs
 * (and `npm run build` afterwards, as with any asset change).
 *
 * This is the per-project card. tools/build_og_image.mjs builds the
 * site-wide one at src/app/opengraph-image.png, which /about, /work and the
 * home page still share.
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 630;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** slug -> how that project's card is made. `src` is relative to its own
 *  public/assets/<slug>/ folder, the same way `cover` is in projects.json. */
const CARDS = {
  "sprouts-farmers-market": {
    // The Times Square marquee, 2500x1667. A photograph, and the storefront
    // sits dead centre, so a 1.91:1 crop loses only sky and pavement.
    src: "sprouts-farmers-market_02_sprouts-marquee.webp",
    mode: "cover",
  },
  "corita-art-center": {
    // Stationery photographed on white at 2560x1507 — the card just
    // continues the sheet it is already lying on.
    src: "corita-art-center_02_cac-stationery-01.webp",
    mode: "contain",
    pad: 0.04,
  },
  "socal-earth": {
    // The site shown on a laptop and a phone, already on white.
    src: "digital-mockup.png",
    mode: "contain",
    pad: 0.04,
  },
  "cultural-olympiad-poster": {
    // The poster itself, and it is portrait (1733x2560). Cropping it to
    // 1.91:1 would show a band across the middle of someone's poster.
    src: "cultural-olympiad-poster_02_noah-cousineau-poster-online.webp",
    mode: "contain",
    pad: 0.06,
  },
  "valley-strong-credit-union": {
    // A 3.3:1 logo lockup. Contained, it sits across the card as a lockup
    // should; cropped, it would run off both ends.
    src: "valley-strong-credit-union_02_vscuhl-logo.webp",
    mode: "contain",
    pad: 0.16,
  },
  "more-work": {
    /* More Work has no `cover` of its own — it is six projects, not one —
       so until now it was the only page falling back to the site-wide card.
       The thesis book is the thing the page opens with. 1000x667 is under
       1200 wide, so this one is enlarged 1.2x; at the size a card is
       actually drawn in a feed that is invisible, and a 1200px card that
       platforms accept beats a 1000px one some of them reject. */
    src: "forced-perspective/forced-perspective_25_front-cover.png",
    mode: "cover",
  },
};

for (const [slug, card] of Object.entries(CARDS)) {
  const src = path.join(ROOT, "public", "assets", slug, card.src);
  if (!fs.existsSync(src)) {
    console.error(`MISSING  ${slug}: ${card.src}`);
    process.exitCode = 1;
    continue;
  }
  const out = path.join(ROOT, "public", "assets", slug, "share-card.jpg");
  const image =
    card.mode === "cover"
      ? sharp(src).resize(W, H, { fit: "cover", position: "centre" })
      : sharp(src)
          .resize(Math.round(W * (1 - 2 * card.pad)), Math.round(H * (1 - 2 * card.pad)), {
            fit: "inside",
            withoutEnlargement: true,
          })
          .flatten({ background: WHITE })
          .extend({
            top: 0, bottom: 0, left: 0, right: 0,
            background: WHITE,
          });

  const buf =
    card.mode === "cover"
      ? await image.flatten({ background: WHITE }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
      : await sharp({ create: { width: W, height: H, channels: 3, background: WHITE } })
          .composite([{ input: await image.png().toBuffer(), gravity: "centre" }])
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();

  fs.writeFileSync(out, buf);
  const { width, height } = await sharp(buf).metadata();
  console.log(
    `${slug.padEnd(28)} ${card.mode.padEnd(8)} ${width}x${height}  ${(buf.length / 1024).toFixed(0)}KB`
  );
}
