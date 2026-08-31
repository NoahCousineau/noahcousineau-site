"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/**
 * SITE-WIDE DARK MODE (2026-08-21, per Noah: "The website will eventually
 * have a dark mode. When this is turned on, all the white parts of the site
 * turn black and all the black parts turn white. I want this to have a
 * humorous twist as well. I want my head (both spinning and the rolling
 * head) to go into darkmode as well where I have sunglasses.")
 *
 * The colour half of that is done entirely in CSS by swapping the values of
 * the two tokens the whole site is already built on — see the
 * `:root[data-theme="dark"]` block in globals.css. Nothing downstream needs
 * to know about themes, because every surface already reads --color-ink or
 * --color-paper rather than a literal.
 *
 * This provider owns only the STATE: which theme is active, persisting the
 * reader's choice, and mirroring it onto <html data-theme> so the CSS can
 * act on it. Components that need more than a colour swap — the two heads,
 * which switch to the sunglasses photography — read `useTheme()`.
 *
 * First visit follows the OS setting; after that an explicit choice wins and
 * is remembered. The `hydrated` flag lets components that must not guess
 * (the heads, which would otherwise load the wrong image and re-measure)
 * wait one tick for the real value.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nc-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  /** False until the client has read the stored/OS preference. */
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
  hydrated: false,
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Runs before first paint (injected into <head> in layout.tsx) so the page
 * never flashes the wrong theme. Kept as a string because it has to be a
 * plain inline script, not a React effect — an effect runs after paint,
 * which is exactly the flash we're avoiding.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    /* LIGHT UNLESS THE VISITOR HAS ASKED FOR DARK (2026-08-30). Noah: "I
       want to make sure that the site always starts in light mode."

       This used to fall back to the operating system's setting, so anyone
       whose Mac or phone is in dark mode met the dark version of the site
       first — which is a large share of people, and not the way the work is
       designed to be seen. The OS preference is no longer consulted at all.

       An explicit choice still persists: someone who presses the toggle gets
       dark, on this and every later visit, until they press it back. That is
       their decision rather than their laptop's. */
    var s = localStorage.getItem('${THEME_STORAGE_KEY}');
    document.documentElement.setAttribute('data-theme', s === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

/* The <html data-theme> attribute is the single source of truth, not React
 * state. It has to be, because the pre-paint script sets it before React
 * exists and the CSS reads it directly — mirroring it into useState as well
 * would mean two copies that can disagree. So this subscribes to the
 * attribute as an external store: the DOM holds the value, React observes
 * it. That also makes hydration correct by construction, since
 * getServerSnapshot can report the neutral default while the client reads
 * whatever the script actually chose. */
function subscribeToThemeAttr(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

const readThemeAttr = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

const noopSubscribe = () => () => {};

/** Must match --dur-theme in globals.css. */
export const THEME_FADE_MS = 330;
let fadeTimer = 0;

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToThemeAttr, readThemeAttr, () => "light" as Theme);
  // True only after hydration — server says false, client says true — so
  // components can avoid rendering a theme-dependent guess on the first pass.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const setTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    // Arm the crossfade for exactly the length of the switch, then disarm it
    // — the transition rule in globals.css is keyed off this attribute, and
    // leaving it on would put a 0.33s colour transition on every element on
    // the site for the rest of the session.
    root.setAttribute("data-theme-transition", "");
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => {
      root.removeAttribute("data-theme-transition");
    }, THEME_FADE_MS);

    // Writing the attribute IS the state update; the observer above turns it
    // back into a render.
    root.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* private mode / storage disabled — the theme still applies for this
         session, it just won't be remembered. */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(readThemeAttr() === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, hydrated }),
    [theme, setTheme, toggle, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
