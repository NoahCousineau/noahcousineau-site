/**
 * "TAP TO ENTER" — THE MOTION QUESTION, BEFORE THE HOMEPAGE (2026-09-13).
 *
 * Noah: "Please have the motion request come up first thing on mobile, even
 * before the homepage loads."
 *
 * iOS shows its motion sheet only in answer to a tap, so this is the tap. It
 * covers everything, the loader included, on a phone that has never been
 * asked, and only there: a phone that has answered before, Android, and
 * anything wider than a phone never see it. Whether it shows is decided by
 * the inline script in lib/tiltInit, which marks <html data-tilt="ask"> before
 * first paint; globals.css does the showing. So this is plain server markup
 * with no React in it, and it works before the site's JavaScript has arrived.
 *
 * Either answer lets the reader in. The note is there because the answer
 * matters more than the tap: iOS will not ask a second time.
 */
export default function TiltAsk() {
  return (
    <button type="button" data-tilt-ask className="tilt-ask">
      <span className="tilt-ask__title">Tap to enter</span>
      <span className="tilt-ask__note">
        Then allow motion, and the page will move with your phone
      </span>
    </button>
  );
}
