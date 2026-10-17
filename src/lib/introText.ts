/**
 * PROJECT INTROS CAN HAVE PARAGRAPHS AND LINKS (2026-10-16).
 *
 * Noah's rewritten project descriptions arrive as several paragraphs, two of
 * them with bulleted lines, and the Corita one ends with a link out to the
 * PRINT Awards announcement. The `intro` field used to be one plain string
 * rendered into a single <p>, which could express none of that.
 *
 * So the field keeps being a plain string — easy to edit, and the content
 * file stays readable — and gains two conventions:
 *
 *   a blank line    starts a new paragraph
 *   a single line   break inside a paragraph stays a line break, which is
 *                   what the bulleted lists in "More Work" need
 *   [label](url)    becomes a link
 *
 * Nothing else is interpreted: this is deliberately not Markdown, because the
 * only thing the copy needs is a link, and a full parser would be a far
 * bigger surface for a page that renders a paragraph of text.
 */

export type IntroSpan = { text: string; href?: string };
/** A paragraph is lines; a line is spans of text, some of them links. */
export type IntroParagraph = IntroSpan[][];

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function parseLine(line: string): IntroSpan[] {
  const spans: IntroSpan[] = [];
  let at = 0;
  for (const m of line.matchAll(LINK)) {
    if (m.index > at) spans.push({ text: line.slice(at, m.index) });
    spans.push({ text: m[1], href: m[2] });
    at = m.index + m[0].length;
  }
  if (at < line.length) spans.push({ text: line.slice(at) });
  return spans.length ? spans : [{ text: line }];
}

export function parseIntro(intro: string): IntroParagraph[] {
  return intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("\n").map((line) => parseLine(line.trim())));
}

/** The same words with the markup taken out — for <meta description>, which
 *  must not show a reader "[here](https://…)". */
export function introPlainText(intro: string): string {
  return intro
    .replace(LINK, "$1")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}
