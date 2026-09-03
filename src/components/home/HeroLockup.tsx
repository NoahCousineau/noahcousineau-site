/**
 * HeroLockup — the "noah cousineau graphic design" wordmark, embedded
 * directly from Noah's SVG (newly uploaded assets/other/home page lockup.svg)
 * so the exact kerning/tracking/baseline positions match the sketch pixel
 * for pixel — HTML text with CSS letter-spacing never reproduces hand-tuned
 * type like this reliably. viewBox is the SVG's native 713.29 x 288.01;
 * callers size it via a wrapping element (width 100%, height auto) so it
 * scales as one unit instead of being rebuilt from separate lines.
 */
export default function HeroLockup({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 713.29 288.01"
      /* Tagged so the scroll cue can measure where this ends and keep itself
         clear of it — see ScrollCue. */
      data-hero-lockup
      className={className}
      style={{ width: "100%", height: "auto", display: "block", fill: "var(--color-ink)" }}
      role="img"
      aria-label="noah cousineau graphic design"
    >
      <text
        transform="translate(0 129.85)"
        style={{ fontFamily: "var(--font-sans)", fontSize: "152.23px" }}
      >
        <tspan x="0" y="0">n</tspan>
        <tspan x="75.78" y="0">o</tspan>
        <tspan x="155.26" y="0">a</tspan>
        <tspan x="228.88" y="0">h</tspan>
      </text>
      <text
        transform="translate(7.22 273.37)"
        style={{ fontFamily: "var(--font-serif)", fontSize: "59.02px", fontStyle: "italic" }}
      >
        <tspan x="0" y="0">g</tspan>
        <tspan x="26.95" y="0">r</tspan>
        <tspan x="49.9" y="0">a</tspan>
        <tspan x="81.52" y="0">p</tspan>
        <tspan x="112.75" y="0">h</tspan>
        <tspan x="144.48" y="0">i</tspan>
        <tspan x="160.85" y="0">c </tspan>
        <tspan x="197.56" y="0">d</tspan>
        <tspan x="229.84" y="0">e</tspan>
        <tspan x="256.04" y="0">s</tspan>
        <tspan x="280.42" y="0">i</tspan>
        <tspan x="296.28" y="0">g</tspan>
        <tspan x="323.2" y="0">n</tspan>
      </text>
      <text
        transform="translate(75.51 214.77)"
        style={{ fontFamily: "var(--font-sans)", fontSize: "152.23px" }}
      >
        <tspan x="0" y="0">c</tspan>
        <tspan x="77.3" y="0">o</tspan>
        <tspan x="156.61" y="0">u</tspan>
        <tspan x="233.19" y="0">s</tspan>
        <tspan x="303.56" y="0">i</tspan>
        <tspan x="332.35" y="0">n</tspan>
        <tspan x="408.51" y="0">e</tspan>
        <tspan x="485.79" y="0">a</tspan>
        <tspan x="558.47" y="0">u</tspan>
      </text>
    </svg>
  );
}
