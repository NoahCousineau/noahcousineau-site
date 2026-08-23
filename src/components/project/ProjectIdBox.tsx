/*
 * ProjectIdBox — the white "ID card" that sits over the top of every
 * project page's hero image: client/project name (left) + staff credits
 * in N columns (right). Modeled 1:1 on the Sprouts artboard's header.
 *
 * Positioning: this component renders ONLY the white card itself. The
 * parent page absolutely-positions a wrapper over the hero image (see
 * work/[slug]/page.tsx) inset by 40u on the top/left/right (round 9,
 * was 65u) — this tightens the gap to the browser edges while keeping
 * the card's internal spacing generous. The card hugs closer to the top
 * and bottom of the title text with 20u padding (was 48u) so it's shorter
 * and reads as a tighter bounding box around the type and credits.
 *
 * Credits text sizing (round 10): role labels and names scaled 1.25x
 * per Noah's request, while the title "sprouts farmers market" stays at
 * its original --text-project-title size.
 *
 * Name capitalization (round 11): role labels stay lowercase via CSS
 * (creative director, design, photography) but names are properly
 * capitalized per the data (Summer Woodward, Hunter Somerville, etc.)
 * — removed the `lowercase` class from names while keeping it on roles.
 *
 * Per feedback: the card's internal spacing was too cramped vs. the
 * sketch — padding + gaps tuned so the whole card reads spread out,
 * closer to the artboard's own generous proportions (title ends ~x485,
 * credits start ~x1082 on a 1830-wide card).
 *
 * `credits` is a flexible list of {role, names[]} so future project pages
 * can have more/fewer roles than Sprouts' three (creative director /
 * design / photography) — columns just add or drop, per Noah's call to
 * keep this reusable rather than hard-coding three fixed roles.
 */
export type Credit = { role: string; names: string[] };

export function ProjectIdBox({
  title,
  credits,
  bare = false,
}: {
  /** Two-line title, e.g. ["sprouts", "farmers market"]. Pass 1 or 2 lines. */
  title: string[];
  credits: Credit[];
  /**
   * Drop the paper fill (2026-08-22). The card existed to hold the type off a
   * photograph; with the hero images gone — Noah: "I want the background
   * images at the top of the pages gone. These will be empty space." — a
   * white card on a white page is just an invisible rectangle, and one that
   * would block the falling objects from passing behind the type. The
   * padding stays, so nothing moves: "The header text will stay here it is."
   */
  bare?: boolean;
}) {
  return (
    <div
      className={`${bare ? "" : "bg-[color:var(--color-paper)]"} flex items-start justify-between`}
      style={{
        columnGap: "calc(var(--u) * 120)",
        padding: "calc(var(--u) * 20) calc(var(--u) * 56)",
      }}
    >
      {/* Title — lowercase, Akzidenz regular, matches the artboard's
          two-stacked-line lockup ("sprouts" / "farmers market"). Tighter
          leading so the two lines fill more of the card's height, like
          the sketch. `shrink-0`: its own intrinsic width, never squeezed by
          the credits column next to it. Letter-spacing (2026-08-23, Noah:
          "increase the tracking just slightly... keep it optical"): dropped
          Tailwind's `tracking-tight` (-0.025em, a flat value meant for body
          copy) for an explicit -0.01em — still snug at this size, just not
          as clenched, and set as its own value rather than a step up the
          Tailwind scale (next stop is `tracking-normal` at 0em, a bigger
          jump than "slightly" asked for). */}
      <h1
        className="lowercase leading-[1.02] m-0 shrink-0"
        style={{
          fontSize: "var(--text-project-title)",
          fontFamily: "var(--font-sans)",
          letterSpacing: "-0.01em",
        }}
      >
        {title.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </h1>

      {/* Credits — a real 2-column GRID, each cell: role label (sans,
          underlined) + names stacked beneath (Quinn Text italic, per the
          artboard). 2026-08-23, Noah, on Sprouts (five credit categories,
          the most of any project): "have the credit information to the
          right of the title... credit categories can be stacked below one
          another." That first pass used `flex flex-wrap`, which packs each
          column greedily into whatever space is left on its row — for five
          uneven-width columns that meant the row broke 2-then-3, so column 2
          of row 2 ("design") did NOT sit under column 2 of row 1
          ("Storyboards"), it just happened to be second in whatever the
          wrap left. 2026-08-23, round 2, Noah: "make sure the credits are
          aligned on a grid... design left aligned to storyboard." A CSS grid
          with a fixed column count fixes that architecturally: every column
          is a real track, so item N always lands under item N-2 regardless
          of label width. Two columns specifically because that is what
          lines "design" up under "Storyboards" (grid-auto-flow order: NASDAQ
          / Storyboards / creative directors / design / photography — row 2
          starts at "creative directors", so "design" falls directly under
          "Storyboards"). `min-w-0` still lets the grid shrink inside the
          outer no-wrap flex row instead of forcing the title to squeeze. */}
      <div
        className="grid min-w-0"
        style={{
          gridTemplateColumns: "repeat(2, max-content)",
          columnGap: "calc(var(--u) * 96)",
          rowGap: "calc(var(--u) * 40)",
        }}
      >
        {credits.map((c) => (
          <div key={c.role} className="min-w-[7rem]">
            <div
              className="lowercase pb-1 border-b border-[color:var(--color-ink)]"
              style={{ fontSize: "calc(var(--text-credit-role) * 1.25)", fontFamily: "var(--font-sans)" }}
            >
              {c.role}
            </div>
            <ul className="list-none m-0 p-0 mt-2">
              {c.names.map((n) => (
                <li
                  key={n}
                  className="italic leading-snug"
                  style={{ fontSize: "calc(var(--text-credit-name) * 1.25)", fontFamily: "var(--font-serif)" }}
                >
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

