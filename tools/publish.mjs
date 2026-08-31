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

/* "NOTHING TO PUBLISH" IS ONLY MEANINGFUL ONCE THERE IS SOMEWHERE TO
 * PUBLISH TO.
 *
 * This used to exit here whenever the working tree was clean and nothing was
 * waiting to go up — and with no remote configured, `unpushed` is zero for
 * the trivial reason that there is no origin to compare against. So on the
 * one run that matters most, the very first one, a fully committed project
 * was told it was already up to date and the script quit before it could ask
 * for the GitHub address. Which is exactly what happened to Noah on launch
 * morning.
 *
 * With no remote, everything is unpublished by definition. */
if (remote && changedFiles.length === 0 && unpushed === 0) {
  say(`  ${C.dim}Nothing has changed since your last publish.${C.reset}`);
  say(`\n${C.green}Your live site is already up to date.${C.reset}\n`);
  process.exit(0);
}
if (!remote) {
  say(`  ${C.dim}This project has never been published. Everything goes up this time.${C.reset}`);
}

if (changedFiles.length) {
  ok(`${changedFiles.length} changed file${changedFiles.length === 1 ? "" : "s"}:`);
  for (const line of describe(changedFiles)) note(line);
} else if (remote) {
  ok("No new edits, but there are saved changes waiting to go up.");
} else {
  ok(`${sh("git rev-list --count HEAD")} saved versions of the site, none of them published yet.`);
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

/* CHECK THE SIZE LIMIT BEFORE PUSHING, NOT AFTER.
 *
 * GitHub refuses any file over 100MB and checks every commit being sent, not
 * just the current files. Two large leftovers were committed early in this
 * project, so the very first push would be rejected until they are taken out
 * of the history. Finding that out from a failed push is a confusing way to
 * learn it, so look first and say plainly what to run.
 *
 * `%(rest)` in the format is required: paths here contain spaces, and without
 * it cat-file treats the whole line as an object name, silently reports
 * nothing, and this check would cheerfully pass on a repository it cannot
 * push. */
const oversized = shQuiet(
  "git rev-list --objects --all | git cat-file --batch-check=" +
    "'%(objecttype) %(objectname) %(objectsize) %(rest)' | " +
    "awk '$1==\"blob\" && $3 > 104857600 {print $4, $5, $6, $7, $8}'"
);
if (oversized) {
  const names = oversized.split("\n").filter(Boolean).slice(0, 4);
  stop("There are files in your history that GitHub won't accept.", [
    "GitHub refuses anything over 100MB, and it checks every save point,",
    "not just your current files. These are still in the history:",
    "",
    ...names.map((n) => `${C.dim}${n.trim()}${C.reset}`),
    "",
    "None of them are used by the site. To take them out, run this once:",
    "",
    `${C.bold}bash tools/purge-large-files-from-history.sh${C.reset}`,
    "",
    "It backs everything up first and leaves the files on your disk.",
    "Then publish again.",
  ]);
}

/* FIRST TIME: connect the GitHub repository, here, rather than sending
 * someone to Terminal to type `git remote add`. That was the only step of
 * the whole launch that had no button, and it is a one-liner. */
let target = remote;
if (!target) {
  say(`  ${C.dim}This project isn't connected to GitHub yet.${C.reset}`);
  say(`  ${C.dim}Create an empty private repository at github.com/new — don't tick${C.reset}`);
  say(`  ${C.dim}any of the "initialize with" boxes — then paste its address below.${C.reset}\n`);
  const url = await ask(`  ${C.dim}GitHub address (or press Enter to stop): ${C.reset}`);
  if (!url) {
    stop("Nothing published.", [
      "No problem — run this again once the repository exists.",
      "The steps are in your launch guide.",
    ]);
  }
  // Accept what GitHub actually shows you, in either of the two forms it
  // offers, and nothing else. A typo here would otherwise be discovered as a
  // confusing push failure several steps later.
  const looksRight =
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/.test(url) ||
    /^git@github\.com:[\w.-]+\/[\w.-]+?(\.git)?$/.test(url);
  if (!looksRight) {
    stop("That doesn't look like a GitHub address.", [
      "It should look like one of these:",
      `${C.dim}https://github.com/yourname/noahcousineau-site.git${C.reset}`,
      `${C.dim}git@github.com:yourname/noahcousineau-site.git${C.reset}`,
      "",
      "Copy it from the page GitHub shows you right after creating the repository.",
    ]);
  }
  const add = spawnSync("git", ["remote", "add", "origin", url], { encoding: "utf8" });
  if (add.status !== 0) {
    stop("Couldn't connect to that repository.", [`${(add.stderr || add.stdout || "").trim()}`]);
  }
  target = url;
  ok(`Connected to ${url}`);
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

/* STDIO IS INHERITED, NOT CAPTURED, AND THAT IS THE WHOLE POINT.
 *
 * The first push to a private repository has to authenticate, and git asks
 * for the username and token on the terminal. With the output piped — which
 * is what every other step here does, so it can read the errors — that prompt
 * is written into a pipe nobody is reading: the window sits there blank and
 * apparently frozen, with git waiting for an answer that cannot arrive.
 *
 * So this one command talks straight to the terminal. It costs the parsed
 * error text, which is why the file-size check above runs BEFORE the push
 * rather than reading its output afterwards. */
say(`  ${C.dim}If this is your first push, git will ask for your GitHub username${C.reset}`);
say(`  ${C.dim}and a personal access token — NOT your account password, which${C.reset}`);
say(`  ${C.dim}GitHub no longer accepts. It is remembered after the first time.${C.reset}\n`);
const push = spawnSync("git", ["push", "-u", "origin", branch], { stdio: "inherit" });
if (push.status !== 0) {
  stop("Couldn't send the changes up.", [
    "The message above says why. The usual two:",
    "",
    `${C.dim}Authentication failed${C.reset} — GitHub wants a personal access token, not`,
    "your password. Make one at github.com/settings/tokens, give it",
    "Contents access to this repository, and paste it when git asks",
    "for the password.",
    "",
    `${C.dim}Repository not found${C.reset} — the address is wrong, or the repository`,
    "hasn't been created yet.",
  ]);
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
