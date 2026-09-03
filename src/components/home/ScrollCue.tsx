"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIsPhone } from "@/lib/useIsPhone";

/**
 * THE ARROW THAT SAYS THERE IS MORE (2026-09-01).
 *
 * Noah, relaying what people told him: "it wasn't obvious to scroll down on
 * the homepage... This arrow will appear fifteen seconds after the homepage is
 * loaded. It will look like it's coming from far back and then quickly reach
 * it's max size. It will then slowly bounce up and down slightly with ease."
 *
 * Fifteen seconds is a long time to wait, and deliberately so: it is meant for
 * the reader who has run out of things to look at, not for the one who is
 * already scrolling.
 *
 * IT BELONGS TO THE PAGE, NOT THE WINDOW (second pass). Noah: "when we scroll
 * down its a bit sticky and stays in the same relative position to the
 * monitor. This should just stay in the same location on the home screen."
 * It was `position: fixed`, so it rode along with the viewport and needed a
 * scroll listener to hide itself again. Now it is a box one screen tall pinned
 * to the top of the document with the arrow in its corner — so it sits on the
 * first screen, scrolls away with everything else, and no longer watches the
 * scroll at all. That listener is gone, which is one less thing running on a
 * phone mid-scroll.
 *
 * The artwork is Noah's own clay arrow, cut from the same photograph as the
 * résumé arrows and exported already pointing down — see
 * tools/resume-arrows/build_arrows.py for the cutout and de-fringing method.
 * That script deliberately SKIPS this arrow for the résumé, because its
 * direction cannot be read automatically from the shape; that does not matter
 * here, where the direction is chosen rather than inferred.
 *
 * It never takes a click: `pointer-events: none` throughout. Under
 * `prefers-reduced-motion` it simply appears and holds still — the arrow is
 * the message, the movement is only emphasis.
 */

/** How long the reader is left alone before the page offers a hint. */
const DELAY_MS = 15000;

/*
 * Placement, from Noah's "Downward Homepage Arrow Sizing" sketch.
 *
 * Desktop and in-between put it in the bottom-right corner of the first
 * screen, inset by the same amount the C mark and the theme toggle use for
 * their own corners, so all three sit on one margin. The size is capped at the
 * 1920 artboard scale for the same reason the rest of the chrome is: a wider
 * monitor should not get a bigger arrow.
 *
 * The phone frame in the sketch is not a corner at all — the lockup there is a
 * vertical stack and the arrow sits underneath it, pointing at the fold.
 *
 * 13vw/7vh -> 10vw/3.5vh. Noah: "The mobile version is conflicting with the
 * 'graphic design' text a bit. Let's nudge the arrow down and shrink it a bit."
 */
const DESKTOP_SIZE_UNITS = 96;
const PHONE_SIZE_VW = 10;

/*
 * IT HAS TO MOVE WITH THE LOCKUP, NOT WITH THE WINDOW (2026-09-01).
 *
 * Noah: "On mobile, I noticed that the arrow 'jumps' up a bit when we scroll
 * down." Scrolling on iOS collapses the URL bar and the viewport grows — and
 * the two things move at DIFFERENT RATES. Measured at 390 wide, growing the
 * viewport from 760 to 844: the lockup moved down 42px, the arrow moved down
 * 81px, and the gap between them swung from 76px to 115px. The hero is
 * `min-height: 100dvh` with its Stage centred inside, so the lockup travels
 * at HALF the rate the viewport changes, while an arrow pinned to the bottom
 * travels at the full rate.
 *
 * So the arrow is pinned to the hero's CENTRE instead, plus a fixed offset in
 * artboard units. The centre is what the lockup is centred on, so the two now
 * move together and the gap is constant at every URL-bar state — which is the
 * jump, gone at its cause rather than damped.
 *
 * The offset is chosen from the SHORT state rather than the tall one: at 390
 * wide it leaves the arrow 20px clear of the foot with the URL bar showing,
 * and 70px clear with it hidden. `min()` against the hero's own bottom is the
 * safety net for genuinely small phones, where there is not enough room below
 * a centred lockup for any constant gap to fit.
 */
/*
 * MEASURED AGAINST THE LOCKUP, NOT GUESSED (2026-09-03). Noah: "the red
 * downward arrow on the mobile homepage will still conflict with the
 * 'graphic design' text at times. Let's just ensure that this doesn't
 * happen."
 *
 * The previous version tracked the hero's centre with a hand-tuned offset,
 * which held the gap constant as the URL bar moved but had no idea where the
 * lockup actually ended — and its floor clamp measured against the HERO's
 * height, which on a short window is taller than the window itself. Mapped
 * across 42 phone viewports: the gap was a healthy 61-82px on tall ones and
 * went NEGATIVE at 375/390/414/430 x 568, with the arrow pushed 31-55px off
 * the bottom at the two widest. An iPhone SE showing Safari's chrome is about
 * 375x553, which is exactly that corner.
 *
 * So the lockup is measured and the arrow is placed below it. Two numbers come
 * out of that: an offset from the hero's CENTRE (so the gap survives the URL
 * bar moving, which was the earlier fix and still matters), and a width that
 * shrinks if the room below the lockup cannot take the full-size arrow. On a
 * screen too short even for the smallest, it steps aside rather than sit on
 * the headline — the hint is worth least exactly there, where the fold is
 * already inches away.
 */
/** Clear space between the foot of the lockup and the top of the arrow, and
 *  the least it may be squeezed to on a cramped screen before the arrow
 *  itself starts giving up size. Both are wanted: at the ideal gap alone an
 *  iPhone SE has no room at all and the arrow would never appear there, and
 *  at the minimum alone every roomy phone would look pinched. */
const PHONE_GAP_UNITS = 190;
const PHONE_MIN_GAP_UNITS = 70;
/** And between the foot of the arrow and the bottom of the window. */
const PHONE_FLOOR_UNITS = 52;
/** Below this the arrow is too small to read as a pointer; hide it instead. */
const PHONE_MIN_VW = 6;
/** The exported artwork's aspect, so the box matches the picture exactly. */
const ART_W = 387;
const ART_H = 380;

export default function ScrollCue() {
  /* Only the phone tier differs. The in-between band shares the desktop
     corner, which is what the sketch draws for it. */
  const phone = useIsPhone();
  const [entered, setEntered] = useState(false);
  /** {offsetFromHeroCentre, widthPx} once the lockup has been measured. */
  const [fit, setFit] = useState<{ top: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (!phone) {
      setFit(null);
      return;
    }
    const box = boxRef.current;
    const hero = box?.offsetParent as HTMLElement | null;
    const lockup = hero?.querySelector<SVGElement>("[data-hero-lockup]");
    if (!box || !hero || !lockup) return;
    const heroRect = hero.getBoundingClientRect();
    const u = heroRect.width / 1000; // the phone hero's own artboard unit
    if (!u) return;
    // Hero-relative, so the answer does not depend on where the page is
    // scrolled to at the moment of measuring.
    const lockupBottom = lockup.getBoundingClientRect().bottom - heroRect.top;
    const floor = PHONE_FLOOR_UNITS * u;
    /* The hero's top IS the top of the page, so the window's bottom edge sits
       one viewport height down it. */
    const avail = window.innerHeight - lockupBottom - floor;
    const full = (PHONE_SIZE_VW / 100) * heroRect.width;
    /* Spend the room in the order that keeps it looking right: the arrow gets
       its full size first, the gap gives way down to its minimum, and only
       then does the arrow shrink. */
    let gap = PHONE_GAP_UNITS * u;
    let height = full * (ART_H / ART_W);
    if (gap + height > avail) {
      gap = Math.max(PHONE_MIN_GAP_UNITS * u, avail - height);
      if (gap + height > avail) height = avail - gap;
    }
    const width = height * (ART_W / ART_H);
    if (width < (PHONE_MIN_VW / 100) * heroRect.width) {
      setFit(null);
      return;
    }
    setFit({ top: lockupBottom + gap - heroRect.height / 2, width });
  }, [phone]);

  const measuredWidth = useRef(-1);
  useLayoutEffect(() => {
    measure();
    /* WIDTH ONLY. A phone's URL bar collapsing fires `resize` with a new
       HEIGHT, and re-fitting on that would change the gap mid-scroll — the
       drift this component was rebuilt to remove. The position is anchored to
       the hero's centre, which moves with the lockup, so a height change needs
       no new measurement. A width change genuinely does: it changes the unit,
       the lockup's size and the arrow's own. */
    const onResize = () => {
      if (window.innerWidth === measuredWidth.current) return;
      measuredWidth.current = window.innerWidth;
      measure();
    };
    measuredWidth.current = window.innerWidth;
    window.addEventListener("resize", onResize);
    /* Fonts can change the lockup's box; it is an SVG here, but re-measuring
       once they land costs nothing and covers the case where it is not. */
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const width = phone
    ? `${fit ? fit.width : (PHONE_SIZE_VW / 100) * 390}px`
    : `calc(100vw / 1920 * ${DESKTOP_SIZE_UNITS})`;

  /* The picture's height, needed by the floor clamp below. */
  const height = `calc(${width} * ${ART_H} / ${ART_W})`;

  const place: React.CSSProperties = phone
    ? {
        left: "50%",
        // Centring by margin, so the inner transforms stay free for the
        // bounce and the arrival.
        marginLeft: `calc(${width} / -2)`,
        /* Off the hero's CENTRE, which is the point the lockup is centred on
           too — so the gap between them survives the URL bar collapsing
           without anything having to be measured again. */
        top: `calc(50% + ${fit ? fit.top : 0}px)`,
      }
    : {
        right: "calc(100vw / 40)",
        bottom: "calc(100vw / 40)",
      };

  return (
    /* Rendered INSIDE the hero (see Hero.tsx), so `50%` and `100%` here are
       the hero's own box — the same box the lockup is centred in, and the
       whole point of the anchoring note above. It also inherits the hero's
       `--u`, which is the phone artboard unit on a phone. */
    <>
      <div
        ref={boxRef}
        data-scroll-cue
        aria-hidden
        className="absolute z-30 pointer-events-none"
        style={{
          ...place,
          width,
          aspectRatio: `${ART_W} / ${ART_H}`,
          opacity: entered && (!phone || fit) ? 1 : 0,
          visibility: entered && (!phone || fit) ? "visible" : "hidden",
        }}
      >
        {/* Outer: the slow bounce. Inner: the arrival. Two elements because
            both are transforms and one would otherwise overwrite the other. */}
        <div className={`w-full h-full ${entered ? "nc-cue-bounce" : ""}`}>
          <div className={`w-full h-full ${entered ? "nc-cue-pop" : ""}`}>
            <Image
              src="/assets/home/scroll-cue-arrow.webp"
              alt=""
              width={ART_W}
              height={ART_H}
              /* Decoded long before it is ever shown. It is 22KB, and the
                 alternative is the browser fetching and decoding it at the
                 moment the animation starts, which is exactly when it must
                 not — that is half of why the growth looked choppy. */
              loading="eager"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
