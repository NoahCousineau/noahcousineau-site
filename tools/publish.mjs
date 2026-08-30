#!/usr/bin/env node
/*
 * PUBLISH — the "hit publish and it's live" button, the way Webflow has one.
 *
 * Noah: "create a platform of sorts that will make it very easy to publish a
 * site live, similar to how you can just hit publish on webflow."
 *
 * Run it with `npm run publish`, or by double-clicking "Publish Site.command"
 * in the project folder, which needs no Terminal knowledge at all.
 *
 * WHAT IT DOES, in order, stopping at the first thing that goes wrong:
 *
 *   1. Works out what you changed since the last publish, in plain words.
 *   2. Builds the site. This is the safety net — a build that fails here
 *      would have failed on the server, and stopping now means your live
 *      site is never the thing that breaks.
 *   3. Saves the changes and sends them up, which starts the deploy.
 *   4. Tells you where to watch it land.
 *
 * NOTHING IS SENT ANYWHERE UNTIL THE BUILD PASSES. If step 2 fails, the live
 * site is untouched and you are exactly where you started.
 *
 * Deliberately NOT clever. No auto-fixing, no force-pushing, no rewriting
 * history, no deleting. Everything it does is a thing you could do by hand
 * and undo afterwards.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

/* ---------- talking to a person, not a terminal ---------- */

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", blue: "\x1b[36m",
};
const say = (m = "") => console.log(m);
const step = (m) => say(`\n${C.blue}${C.bold}${m}${C.reset}`);
const ok = (m) => say(`  ${C.green}✓${C.reset} ${m}`);
const warn = (m) => say(`  ${C.yellow}!${C.reset} ${m}`);
const bad = (m) => say(`  ${C.red}✗${C.reset} ${m}`);
const note = (m) => say(`    ${C.dim}${m}${C.reset}`);

function stop(title, lines = []) {
  say(`\n${C.red}${C.bold}${title}${C.reset}`);
  for (const l of lines) say(`  ${l}`);
  say(`\n  ${C.dim}Your live site has not changed.${C.reset}\n`);
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const shQuiet = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

/* ---------- describing changes the way a person would ---------- */

/** Turn a list of changed files into something readable. */
function describe(files) {
  const buckets = new Map();
  const label = (f) => {
    if (f.startsWith("src/content/")) return "project content and captions";
    if (f.startsWith("public/assets/") || f.startsWith("public/images/")) return "images";
    if (f.startsWith("public/videos/")) return "videos (these are not published from here)";
    if (f.startsWith("src/app/about")) return "the about page";
    if (f.startsWith("src/app/work") || f.startsWith("src/components/project/")) return "project pages";
    if (f.startsWith("src/components/home/") || f === "src/app/page.tsx") return "the home page";
    if (f.startsWith("src/components/")) return "shared parts of the site";
    if (f.startsWith("src/app/globals.css")) return "site-wide styling";
    if (f === "src/app/not-found.tsx") return "the 404 page";
    if (f.startsWith("src/app/")) return "site pages";
    if (f.startsWith("src/lib/")) return "site plumbing";
    if (f.startsWith("tools/") || f.startsWith("qa/")) return "behind-the-scenes tooling";
    if (f.endsWith(".command")) return "the publish button itself";
    if (/^(package(-lock)?\.json|next\.config\.ts|tsconfig\.json|\.gitignore|\.env\.example)$/.test(f))
      return "project settings";
    if (f.endsWith(".md")) return "notes and documentation";
    return "other files";
  };
  for (const f of files) {
    const k = label(f);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([k, n]) => `${n} file${n === 1 ? "" : "s"} — ${k}`);
}

/* ---------- go ---------- */

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const messageArg = (() => {
  const i = args.indexOf("-m");
  return i >= 0 ? args[i + 1] : null;
})();

say(`\n${C.bold}Publishing noahcousineau.com${C.reset}`);
say(`${C.dim}${checkOnly ? "Check only — nothing will be published." : "Nothing goes live until the build passes."}${C.reset}`);

/* 1. What changed */
step("1. What you changed");

if (!existsSync(path.join(ROOT, ".git"))) {
  stop("This folder isn't set up for publishing yet.", [
    "It needs to be a git project before it can publish.",
    "Ask Claude to set this up — it's a one-time thing.",
  ]);
}

const branch = sh("git rev-parse --abbrev-ref HEAD");
const dirty = sh("git status --porcelain");
const changedFiles = dirty
  ? dirty.split("\n").map((l) => l.slice(3).replace(/^"|"$/g, "")).filter(Boolean)
  : [];

const remote = shQuiet("git remote get-url origin");
let unpushed = 0;
if (remote) {
  const count = shQuiet(`git rev-list --count origin/${branch}..${branch}`);
  unpushed = count ? Number(count) : 0;
}

if (changedFiles.length === 0 && unpushed === 0) {
  say(`  ${C.dim}Nothing has changed since your last publish.${C.reset}`);
  say(`\n${C.green}Your live site is already up to date.${C.reset}\n`);
  process.exit(0);
}

if (changedFiles.length) {
  ok(`${changedFiles.length} changed file${changedFiles.length === 1 ? "" : "s"}:`);
  for (const line of describe(changedFiles)) note(line);
} else {
  ok("No new edits, but there are saved changes waiting to go up.");
}
if (unpushed > 0) note(`${unpushed} earlier change${unpushed === 1 ? "" : "s"} also still waiting to publish.`);
if (branch !== "main") warn(`You're on the "${branch}" branch, not "main". That's usually not what you want.`);

/* 2. Build */
step("2. Checking the site builds");
note("This is the step that catches mistakes. It takes a minute.");

const build = spawnSync("npm", ["run", "build"], { encoding: "utf8" });
if (build.status !== 0) {
  const out = `${build.stdout || ""}${build.stderr || ""}`;
  const lines = out.split("\n").filter((l) => /error|Error|failed|Failed/.test(l)).slice(0, 8);
  stop("The site didn't build, so nothing was published.", [
    "That's the safety net doing its job — this would have failed on the server too.",
    "",
    ...(lines.length ? lines.map((l) => `${C.dim}${l.trim()}${C.reset}`) : [`${C.dim}Run "npm run build" to see the full error.${C.reset}`]),
    "",
    "Send these lines to Claude and it can tell you what broke.",
  ]);
}
ok("Builds cleanly.");

if (checkOnly) {
  say(`\n${C.green}${C.bold}All good.${C.reset} Nothing was published — that's what --check means.\n`);
  process.exit(0);
}

/* 3. Publish */
step("3. Publishing");

if (!remote) {
  stop("There's nowhere to publish to yet.", [
    "The site isn't connected to GitHub or Vercel.",
    "That's the one-time setup in your launch guide — do that first,",
    "then this button will work every time after.",
  ]);
}

if (changedFiles.length) {
  let message = messageArg;
  if (!message) {
    const typed = await ask(`  ${C.dim}Describe this update (or press Enter for a dated note): ${C.reset}`);
    message = typed || `Site update — ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  }
  execSync("git add -A", { stdio: "inherit" });
  const res = spawnSync("git", ["commit", "-m", message], { encoding: "utf8" });
  if (res.status !== 0 && !/nothing to commit/i.test(`${res.stdout}${res.stderr}`)) {
    stop("Couldn't save your changes.", [`${res.stderr || res.stdout}`.trim()]);
  }
  ok(`Saved: ${message}`);
}

const push = spawnSync("git", ["push", "origin", branch], { encoding: "utf8" });
if (push.status !== 0) {
  const out = `${push.stdout || ""}${push.stderr || ""}`;
  if (/exceeds .*file size limit|large files/i.test(out)) {
    stop("A file is too big to publish.", [
      "GitHub won't accept anything over 100MB.",
      'Run: bash tools/purge-large-files-from-history.sh',
      "then try publishing again.",
    ]);
  }
  stop("Couldn't send the changes up.", [`${C.dim}${out.trim().split("\n").slice(-4).join("\n  ")}${C.reset}`]);
}
ok("Sent.");

/* 4. Where to watch */
step("4. That's it");
say(`
  Your site is building now. It's usually live within about a minute.

  Watch it land:   ${C.blue}https://vercel.com/dashboard${C.reset}
  Then check:      ${C.blue}https://www.noahcousineau.com${C.reset}

  ${C.dim}If the deploy fails, your old site stays up — Vercel only swaps${C.reset}
  ${C.dim}them over once the new one has built successfully.${C.reset}
`);
