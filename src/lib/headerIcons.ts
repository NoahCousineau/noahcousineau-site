/**
 * The project-page header's per-project icon set — Noah's "pencil, clay,
 * paper" drawings, one folder of PNGs per project
 * (tools/header-icons/build_icons.py converts them into these WEBPs).
 *
 * 2026-08-23: "These pngs are meant to replace the placeholder circles that
 * are in the project header areas... Each project has three types of images:
 * pencil, clay, and paper. Each project should use the images in the
 * corresponding folder. They should only appear once in the header... By the
 * end of this, there should no longer be any placeholder circles."
 *
 * `kind` matters at render time: "For any of the pencil drawings, make sure
 * the black turns to white when we go from light to dark mode" — pencil
 * icons are flat greyscale linework (measured: zero saturation across every
 * pencil file), so a plain CSS invert reads correctly; clay and paper are
 * full-colour photographs of physical objects and must NOT invert.
 */

export type HeaderIconKind = "pencil" | "clay" | "paper";

export type HeaderIcon = {
  kind: HeaderIconKind;
  src: string;
  /** Intrinsic pixel size, for the physics' aspect ratio and silhouette scale. */
  width: number;
  height: number;
};

export const HEADER_ICONS: Record<string, HeaderIcon[]> = {
  "corita-art-center": [
    { kind: "clay", src: "/assets/home/header-icons/corita-art-center/clay-ball.webp", width: 504, height: 512 },
    { kind: "clay", src: "/assets/home/header-icons/corita-art-center/clay-flower.webp", width: 733, height: 759 },
    { kind: "clay", src: "/assets/home/header-icons/corita-art-center/clay-sign.webp", width: 497, height: 485 },
    { kind: "paper", src: "/assets/home/header-icons/corita-art-center/paper-arrow.webp", width: 367, height: 422 },
    { kind: "paper", src: "/assets/home/header-icons/corita-art-center/paper-ball.webp", width: 400, height: 437 },
    { kind: "paper", src: "/assets/home/header-icons/corita-art-center/paper-stop-sign.webp", width: 604, height: 637 },
    { kind: "pencil", src: "/assets/home/header-icons/corita-art-center/pencil-c.webp", width: 294, height: 410 },
    { kind: "pencil", src: "/assets/home/header-icons/corita-art-center/pencil-corita.webp", width: 439, height: 488 },
    { kind: "pencil", src: "/assets/home/header-icons/corita-art-center/pencil-k.webp", width: 209, height: 451 },
  ],
  "cultural-olympiad-poster": [
    { kind: "clay", src: "/assets/home/header-icons/cultural-olympiad-poster/clay-moulinrouge.webp", width: 541, height: 526 },
    { kind: "clay", src: "/assets/home/header-icons/cultural-olympiad-poster/clay-palmtree.webp", width: 672, height: 709 },
    { kind: "clay", src: "/assets/home/header-icons/cultural-olympiad-poster/clay-star.webp", width: 774, height: 695 },
    { kind: "paper", src: "/assets/home/header-icons/cultural-olympiad-poster/paper-croissant.webp", width: 344, height: 159 },
    { kind: "paper", src: "/assets/home/header-icons/cultural-olympiad-poster/paper-eiffel-tower.webp", width: 344, height: 419 },
    { kind: "paper", src: "/assets/home/header-icons/cultural-olympiad-poster/paper-oscar.webp", width: 181, height: 367 },
    { kind: "paper", src: "/assets/home/header-icons/cultural-olympiad-poster/paper-wine.webp", width: 134, height: 225 },
    { kind: "pencil", src: "/assets/home/header-icons/cultural-olympiad-poster/pencil-arc.webp", width: 360, height: 297 },
    { kind: "pencil", src: "/assets/home/header-icons/cultural-olympiad-poster/pencil-burger.webp", width: 334, height: 225 },
  ],
  "more-work": [
    { kind: "clay", src: "/assets/home/header-icons/more-work/clay-exclamationpoint.webp", width: 146, height: 581 },
    { kind: "clay", src: "/assets/home/header-icons/more-work/clay-poppy.webp", width: 392, height: 631 },
    { kind: "clay", src: "/assets/home/header-icons/more-work/clay-square.webp", width: 388, height: 368 },
    { kind: "paper", src: "/assets/home/header-icons/more-work/paper-hammer.webp", width: 297, height: 378 },
    { kind: "paper", src: "/assets/home/header-icons/more-work/paper-hat.webp", width: 449, height: 248 },
    { kind: "paper", src: "/assets/home/header-icons/more-work/paper-star.webp", width: 233, height: 240 },
    { kind: "pencil", src: "/assets/home/header-icons/more-work/pencil-book.webp", width: 325, height: 315 },
    { kind: "pencil", src: "/assets/home/header-icons/more-work/pencil-brush.webp", width: 187, height: 342 },
    { kind: "pencil", src: "/assets/home/header-icons/more-work/pencil-laptop.webp", width: 396, height: 284 },
  ],
  "socal-earth": [
    { kind: "clay", src: "/assets/home/header-icons/socal-earth/clay-bear.webp", width: 463, height: 434 },
    { kind: "clay", src: "/assets/home/header-icons/socal-earth/clay-cloud.webp", width: 965, height: 377 },
    { kind: "clay", src: "/assets/home/header-icons/socal-earth/clay-tree.webp", width: 711, height: 865 },
    { kind: "paper", src: "/assets/home/header-icons/socal-earth/paper-fish.webp", width: 337, height: 203 },
    { kind: "paper", src: "/assets/home/header-icons/socal-earth/paper-mountains.webp", width: 506, height: 240 },
    { kind: "paper", src: "/assets/home/header-icons/socal-earth/paper-water.webp", width: 132, height: 239 },
    { kind: "pencil", src: "/assets/home/header-icons/socal-earth/pencil-bird.webp", width: 240, height: 164 },
    { kind: "pencil", src: "/assets/home/header-icons/socal-earth/pencil-flower.webp", width: 161, height: 205 },
    { kind: "pencil", src: "/assets/home/header-icons/socal-earth/pencil-tree.webp", width: 248, height: 340 },
  ],
  "sprouts-farmers-market": [
    { kind: "clay", src: "/assets/home/header-icons/sprouts-farmers-market/clay-blueberry.webp", width: 370, height: 469 },
    { kind: "clay", src: "/assets/home/header-icons/sprouts-farmers-market/clay-lemon.webp", width: 627, height: 373 },
    { kind: "clay", src: "/assets/home/header-icons/sprouts-farmers-market/clay-spinach.webp", width: 417, height: 792 },
    { kind: "paper", src: "/assets/home/header-icons/sprouts-farmers-market/paper-banana.webp", width: 237, height: 268 },
    { kind: "paper", src: "/assets/home/header-icons/sprouts-farmers-market/paper-lime.webp", width: 464, height: 277 },
    { kind: "paper", src: "/assets/home/header-icons/sprouts-farmers-market/paper-mushroom.webp", width: 527, height: 383 },
    { kind: "pencil", src: "/assets/home/header-icons/sprouts-farmers-market/pencil-olive.webp", width: 421, height: 255 },
    { kind: "pencil", src: "/assets/home/header-icons/sprouts-farmers-market/pencil-onion.webp", width: 387, height: 377 },
    { kind: "pencil", src: "/assets/home/header-icons/sprouts-farmers-market/pencil-tomato.webp", width: 389, height: 318 },
  ],
  "valley-strong-credit-union": [
    { kind: "clay", src: "/assets/home/header-icons/valley-strong-credit-union/clay-mug.webp", width: 400, height: 319 },
    { kind: "clay", src: "/assets/home/header-icons/valley-strong-credit-union/clay-roof.webp", width: 858, height: 308 },
    { kind: "clay", src: "/assets/home/header-icons/valley-strong-credit-union/clay-table.webp", width: 523, height: 303 },
    { kind: "paper", src: "/assets/home/header-icons/valley-strong-credit-union/paper-door.webp", width: 333, height: 567 },
    { kind: "paper", src: "/assets/home/header-icons/valley-strong-credit-union/paper-house.webp", width: 421, height: 322 },
    { kind: "paper", src: "/assets/home/header-icons/valley-strong-credit-union/paper-key.webp", width: 226, height: 399 },
    { kind: "pencil", src: "/assets/home/header-icons/valley-strong-credit-union/pencil-cat.webp", width: 381, height: 386 },
    { kind: "pencil", src: "/assets/home/header-icons/valley-strong-credit-union/pencil-dog.webp", width: 573, height: 397 },
    { kind: "pencil", src: "/assets/home/header-icons/valley-strong-credit-union/pencil-toilet.webp", width: 449, height: 474 },
    { kind: "pencil", src: "/assets/home/header-icons/valley-strong-credit-union/pencil-window.webp", width: 441, height: 565 },
  ],
};

