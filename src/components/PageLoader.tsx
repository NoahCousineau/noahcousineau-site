"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import LoadingWorm from "./LoadingWorm";
import { usePathname } from "next/navigation";
import { getLenis } from "./SmoothScroll";
import { markPageLoading, markPageReady } from "@/lib/pageReady";

/**
 * PageLoader — full-viewport loading overlay that covers the screen while
 * a page's images/videos finish loading, then fades out.
 *
 * WHY THIS EXISTS: Noah wants every project image served at full native
 * resolution (no compression) for visual fidelity, which means pages can
 * take a real, noticeable amount of time to finish loading all their
 * media — especially project pages with 60+ full-res images. Rather than
 * let the page "pop in" piecemeal while images trickle in (looking
 * broken/unfinished), this shows a deliberate full-screen loading state
 * — the same pattern used by many high-production portfolio sites
 * (an animated mark while assets load, then a reveal).
 *
 * THE VISUAL IS NOW NOAH'S OWN (2026-08-23) — a red clay worm crawling
 * across the floor with the word "loading" warped along its back, see
 * LoadingWorm.tsx. It replaced the placeholder pulsing wordmark and
 * percentage bar. Note that it deliberately shows NOTHING about progress:
 * "it always keeps the same speed and never slows if the loading is taking
 * some time." The gating logic below is untouched by that — it still waits
 * on real asset loading; it just no longer reports how far along it is.
 *
 * HOW IT WORKS:
 * 1. Mounted with `key={pathname}` by the parent (see layout.tsx) — this
 *    is the React-idiomatic way to "reset on route change": rather than
 *    manually calling setState inside an effect to reset state (which
 *    triggers a lint error, `react-hooks/set-state-in-effect`, and an
 *    extra render pass), changing the `key` prop makes React unmount the
 *    old instance and mount a brand-new one with fresh initial state
 *    every time the route changes. No manual reset logic needed here.
 * 2. On mount, poll the DOM for every <img> and <video> currently
 *    rendered in <main> and count how many have finished loading
 *    (img.complete / video.readyState >= 3), updating a percentage.
 * 3. New <img>/<video> elements that appear after the initial scan
 *    (e.g. from client-side rendering) are picked up via a
 *    MutationObserver so the count doesn't lock in stale early.
 * 4. Once 100% of currently-known media has loaded (or a MAX_WAIT_MS
 *    safety timeout elapses, so a single broken/slow asset can't hang
 *    the loader forever), fade the overlay out and unmount it.
 * 5. Respects prefers-reduced-motion: skips the fade transition (instant
 *    show/hide) but the gating logic itself is unaffected.
 *
 * USAGE: mount near the root of the tree, keyed by pathname, as a sibling
 * to the actual page content (see layout.tsx) — it's a fixed-position
 * overlay, not a wrapper, so it doesn't affect layout.
 */

/* 8000 -> 14000 (2026-08-30). Noah: "I'm okay with the loading screen taking
 * longer if it equates to a smoother experience once the loading finishes."
 * The cap is a safety net for a page that will never settle, not a target —
 * almost every load finishes well before it. */
const MAX_WAIT_MS = 14000;
/* The layout must ALSO have stopped changing. See the note in checkProgress:
 * this is what stops the curtain lifting on a page that is about to grow to
 * five times its height. Three consecutive quiet polls at 100ms. */
const STABLE_POLLS_REQUIRED = 3;

/*
 * HOW MUCH OF THE PAGE IS "READY TO SCROLL" (2026-09-03).
 *
 * Noah, on bad wifi: "the website isn't functioning as well. Let's make sure
 * that the loading page gets the main page ready to scroll down."
 *
 * The wait used to cover one and a half screens, and below that nothing was
 * even FETCHED — a lazy image only starts loading when it nears the viewport,
 * and nothing nears the viewport while the curtain is up and the page cannot
 * scroll. So on a fast connection the reader scrolled into images that
 * arrived instantly and never noticed; on a slow one they scrolled into
 * blanks. Waiting longer alone would not have helped, because there was
 * nothing in flight to wait for.
 *
 * So the first few screens are PRIMED — told to fetch now, while the curtain
 * is still up. Priming and WAITING are deliberately different distances,
 * because making them the same was the first attempt and it was worse than
 * the problem: waiting three screens deep put the loader at 16.9s on fast 3G
 * and 44.8s on slow 3G. Nobody watches a worm for forty-five seconds to be
 * told a page is ready.
 *
 * Priming three screens and waiting one and a half means the curtain lifts on
 * the same terms it always did — everything the reader can actually SEE is
 * there — while the next two screens are already in flight behind it. By the
 * time a thumb gets to them they have had the whole loader plus the scroll to
 * arrive, instead of starting from nothing at the moment they are reached.
 * That is the difference Noah is feeling on bad wifi, and it costs the fast
 * case nothing.
 */
const PRIME_SCREENS = 3;
const WAIT_SCREENS = 1.5;
const POLL_INTERVAL_MS = 100;

export default function PageLoader() {
  const pathname = usePathname();
  /* NOT ON THE GATE. The password screen ends by fading its thumbs up into
   * the loading screen (see PasswordHand), so showing the worm on the way IN
   * would play it twice in one sequence — once over a hand that is about to
   * fly up, and again thirty seconds later when the project actually loads. */
  if (pathname === "/password") return null;
  // Keying by pathname forces React to unmount/remount PageLoaderInner on
  // every route change, giving it fresh initial state for free (see the
  // component doc comment above for why this is preferred over manually
  // resetting state inside an effect).
  return <PageLoaderInner key={pathname} />;
}

function PageLoaderInner() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const startTimeRef = useRef<number>(0);

  /* Announce that a page is behind the curtain again, before anything paints.
   * A layout effect rather than the main effect below because this has to
   * beat the page's own components to the store — see lib/pageReady.ts for
   * why the header's falling objects wait on it. This component is keyed by
   * pathname (see PageLoader above) and so remounts per navigation, which is
   * what makes a plain mount-time call correct here. */
  useLayoutEffect(() => {
    markPageLoading();
  }, []);

  useEffect(() => {
    // Every mount of this component (one per route, thanks to the
    // `key={pathname}` wrapper above) starts its own fresh timer — no
    // manual state reset needed since useState's initial values above
    // already give us visible=true/fading=false on mount.
    startTimeRef.current = Date.now();

    // ALWAYS LAND AT THE TOP OF A NEW PAGE (2026-08-23, per Noah, as a
    // general site-wide rule: "whenever a page finishes loading, please
    // always make sure it starts at the top of the page"). This overlay is
    // opaque and full-viewport while it's up, so doing this immediately on
    // mount — rather than waiting for `finish()` — is invisible to the
    // reader and means the page is already correctly positioned by the
    // moment the fade-out reveals it.
    //
    // Plain `window.scrollTo` alone isn't enough: Lenis (see
    // SmoothScroll.tsx) intercepts wheel/touch input and drives the
    // document scroll itself from its own internal target/animated
    // position, which this jump does not touch. Left alone, Lenis's next
    // rAF tick can pull the page back toward whatever position it still
    // thinks is current — reproducible by navigating away from a scrolled
    // page and back. `immediate: true` snaps Lenis's own state to 0 in the
    // same frame instead of easing there.
    /* AND STOP THE BROWSER PUTTING IT BACK (2026-08-30). Noah: "make sure
       all pages load at the top."
       
       The jump below was already here and was already correct — but on a
       RELOAD, and on back/forward, the browser restores the previous scroll
       position itself, and it does that after this runs. So the one case
       where landing at the top matters most, someone refreshing a page they
       had scrolled down, was the one case still broken. Turning restoration
       off hands the decision to us, which is what the next two lines are. */
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    getLenis()?.scrollTo(0, { immediate: true });

    /* THE TAB SAYS SOMETHING WHILE IT LOADS (2026-08-30). Noah's tab names
       are per-moment rather than per-route: "Loading" belongs to the worm,
       and "Woah, Partner!" belongs to the password hand (see GateOverlay).
       Captured and restored so the page's own name comes back the instant
       the curtain lifts. */
    const titleBeforeLoading = document.title;
    document.title = "Loading";

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    // If this unmounts mid-load (a route change while the curtain is up),
    // the tab must not be left saying "Loading" forever.
    const restoreTitle = () => {
      if (document.title === "Loading") document.title = titleBeforeLoading;
    };
    let observer: MutationObserver | null = null;

    /* WHAT THE CURTAIN IS ACTUALLY WAITING FOR (2026-08-30).
     *
     * Everything in the page used to count, and that could never finish: 26
     * of the home page's 55 images are loading="lazy" and sit thousands of
     * pixels down, so the browser will not fetch them until someone scrolls
     * there — which cannot happen while the curtain is up. Measured on
     * desktop, they were still pending after eight seconds, unchanged, and
     * the loading screen was simply running out its safety timeout on every
     * single visit. That is why it always felt like a fixed wait rather than
     * a real one.
     *
     * So the wait is for what the reader is about to SEE: everything eager,
     * plus anything lazy that is close enough to the top to be fetched
     * anyway. The rest is deferred on purpose, and honouring that is the
     * whole point of marking it lazy. */
    function getMediaElements(): (HTMLImageElement | HTMLVideoElement)[] {
      const root = document.querySelector("main") || document.body;
      const all = Array.from(
        root.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")
      );
      const primeTo = window.innerHeight * PRIME_SCREENS;
      const waitTo = window.innerHeight * WAIT_SCREENS;
      return all.filter((el) => {
        if (el instanceof HTMLImageElement && el.loading === "lazy") {
          const top = el.getBoundingClientRect().top;
          /* Flipping this off `lazy` is what actually starts the fetch. Left
             lazy, an image three screens down waits for a scroll that cannot
             happen yet — so it was not merely late, it had not been asked
             for. */
          if (top < primeTo) el.loading = "eager";
          // ...but only the near ones are worth HOLDING the curtain for.
          return top < waitTo;
        }
        return true;
      });
    }

    function isMediaLoaded(el: HTMLImageElement | HTMLVideoElement): boolean {
      if (el instanceof HTMLImageElement) {
        // naturalWidth === 0 on a "complete" image usually means it
        // failed to load (404, etc.) — count it as done anyway so a
        // single broken image can't block the whole page forever.
        return el.complete;
      }
      /* A VIDEO THAT HAS BEEN TOLD NOT TO LOAD IS NOT SOMETHING TO WAIT FOR
       * (2026-08-30). The grids now set preload="none", so a video fetches
       * nothing until it scrolls into view and plays — which means readyState
       * stays 0 forever while the loader sits there waiting for it. Measured:
       * the curtain held for the full safety-net timeout on every project
       * page, for videos that were never going to load until long after it
       * lifted. Deliberately lazy is not the same as pending. */
      if (el.preload === "none") return true;
      // HAVE_FUTURE_DATA (3) or better means enough of the video is
      // buffered to start playing — good enough to reveal the page;
      // we don't need the whole video downloaded.
      return el.readyState >= 3;
    }

    /* WAIT FOR THE LAYOUT TO STOP MOVING, NOT JUST FOR THE MEDIA (2026-08-30).
     *
     * Noah: "the mobile homepage is acting very strange. If you scroll right
     * when the page loads, it seems to be broken and the user can see the
     * footer way too early."
     *
     * Measured on a 390px viewport: the home page is 1481px tall at first
     * paint and 7086px a moment later — and every image is already loaded at
     * both readings, so waiting on media said "ready" while the page was
     * still five sixths shorter than it was about to be. The reason it grows
     * is that the phone layout is not the first thing rendered: useIsPhone
     * answers false for the server render and for the first client render by
     * design, so the page briefly lays itself out as a very narrow desktop
     * before swapping. In that window, .site-content is shorter than two
     * screens, so any scroll runs straight past it and lands on the footer —
     * which is fixed behind the page and meant to be reached at the very end.
     *
     * So the curtain now also waits for the document's own height to hold
     * still. Noah, on being asked to trade seconds for smoothness: "I'm okay
     * with the loading screen taking longer if it equates to a smoother
     * experience once the loading finishes." */
    let lastHeight = -1;
    let stableFor = 0;

    function checkProgress() {
      if (cancelled) return;
      const elements = getMediaElements();
      const elapsed = Date.now() - startTimeRef.current;

      const height = document.documentElement.scrollHeight;
      if (height === lastHeight) stableFor += 1;
      else {
        lastHeight = height;
        stableFor = 0;
      }
      const settled = stableFor >= STABLE_POLLS_REQUIRED;

      if (elements.length === 0) {
        if (settled || elapsed >= MAX_WAIT_MS) finish();
        return;
      }
      const loadedCount = elements.filter(isMediaLoaded).length;

      if ((loadedCount === elements.length && settled) || elapsed >= MAX_WAIT_MS) {
        finish();
      }
    }

    function finish() {
      if (cancelled) return;
      cancelled = true;
      // Hand the tab back its real name — see the note at the top of this
      // effect. Guarded so a title Next has set in the meantime wins.
      if (document.title === "Loading") document.title = titleBeforeLoading;
      if (pollId) clearInterval(pollId);
      if (observer) observer.disconnect();
      // The curtain is going up: anything that has been holding an entrance
      // back until it can actually be seen may start now. Signalled at the
      // START of the fade rather than after it, so a 400ms cross-fade reveals
      // a page that is already in motion instead of one that begins moving
      // once the fade has finished.
      /* The page is about to be seen: make sure it is at the top of itself.
         The jump on mount already ran, but the layout has changed shape since
         then and a phone can carry swipe momentum through the reveal. */
      window.scrollTo(0, 0);
      getLenis()?.scrollTo(0, { immediate: true });
      markPageReady();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setVisible(false);
        return;
      }
      setFading(true);
      // Match the CSS transition duration below (400ms) before unmounting.
      window.setTimeout(() => setVisible(false), 400);
    }

    // Give the DOM a tick to render the new page's <img>/<video> tags
    // before the first measurement (avoids a false "0 elements = 100%"
    // reading on the very first frame of a route change).
    const initialDelay = window.setTimeout(() => {
      checkProgress();
      pollId = setInterval(checkProgress, POLL_INTERVAL_MS);

      // Watch for media elements added after our initial scan (e.g. a
      // component that mounts more <img> tags slightly later).
      observer = new MutationObserver(() => checkProgress());
      observer.observe(document.querySelector("main") || document.body, {
        childList: true,
        subtree: true,
      });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
      if (pollId) clearInterval(pollId);
      if (observer) observer.disconnect();
      restoreTitle();
    };
  }, []);

  /* NOTHING SCROLLS BEHIND THE CURTAIN (2026-08-30).
   *
   * The second half of "you can see the footer way too early". Holding the
   * curtain until the layout settles fixes the cause, but the curtain is only
   * a painted sheet — the document behind it scrolls perfectly well, and a
   * phone that has already taken a swipe will carry that momentum straight
   * through the reveal and land somewhere down the page. The site is supposed
   * to open at the top.
   *
   * Lenis has to be stopped as well as the document: it drives scrolling from
   * its own animated position and would simply put the page back. Started
   * again on the way out, along with everything this touched. */
  useEffect(() => {
    if (!visible) return;
    const body = document.body;
    const prev = { overflow: body.style.overflow, touchAction: body.style.touchAction };
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    const lenis = getLenis();
    lenis?.stop();
    return () => {
      body.style.overflow = prev.overflow;
      body.style.touchAction = prev.touchAction;
      lenis?.start();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--color-paper, #fff)",
        opacity: fading ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Noah's crawling worm — replaced the pulsing "Cousineau" wordmark
          and the percentage bar on 2026-08-23: "I would like for this to
          replace the 'cousineau' type and the loading bar." It shows no
          progress by design; see the note in LoadingWorm.tsx. */}
      <LoadingWorm />
    </div>
  );
}
