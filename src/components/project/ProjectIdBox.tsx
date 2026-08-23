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
      className={`${bare ? "" : "bg-[color:var(--color-paper)]"} flex flex-wrap items-start justify-between`}
      style={{
        columnGap: "calc(var(--u) * 120)",
        rowGap: "calc(var(--u) * 60)",
        padding: "calc(var(--u) * 20) calc(var(--u) * 56)",
      }}
    >
      {/* Title — lowercase, Akzidenz regular, matches the artboard's
          two-stacked-line lockup ("sprouts" / "farmers market"). Tighter
          leading so the two lines fill more of the card's height, like
          the sketch. */}
      <h1
        className="lowercase leading-[1.02] tracking-tight m-0"
        style={{ fontSize: "var(--text-project-title)", fontFamily: "var(--font-sans)" }}
      >
        {title.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </h1>

      {/* Credits — N columns, each: role label (sans, underlined) +
          names stacked beneath (Quinn Text italic, per the artboard). */}
      {/* `ml-auto` and not just the row's `justify-between`: once the two
          halves wrap onto separate lines (a long title, a narrow viewport)
          justify-between has nothing left to space apart and the credits fall
          back to the left. Noah: "make sure that the team credit information
          is to the right." */}
      <div
        className="flex flex-wrap ml-auto justify-end"
        style={{ columnGap: "calc(var(--u) * 96)", rowGap: "calc(var(--u) * 40)" }}
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

