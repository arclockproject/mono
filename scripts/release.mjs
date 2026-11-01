// Prepares a release of one package in packages/: picks the next version from
// the commits since its last tag, then updates its CHANGELOG.md and package.json.
// Committing, tagging and publishing are done by .github/workflows/release.yml.
//
// Usage: node scripts/release.mjs <folder in packages/> [--dry-run] [--notes-file <path>]
//   --dry-run     Print the version and notes. Changes no files.
//   --notes-file  Also write the notes to this file, for the GitHub release.
//
// Set GITHUB_TOKEN to look up PRs and authors without the API's low rate limit.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, "notes-file": { type: "string" } },
});
const folder = positionals[0];
const dryRun = !!values["dry-run"];
const notesFile = values["notes-file"] ?? null;

const root = path.resolve(import.meta.dirname, "..");
const pkgDir = path.join(root, "packages", folder ?? "");
if (!folder || !fs.existsSync(path.join(pkgDir, "package.json"))) {
  fail(`Usage: node scripts/release.mjs <package> [--dry-run]. Packages: ${fs.readdirSync(path.join(root, "packages")).join(", ")}`);
}

const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();

const branch = process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "dev" && !dryRun) fail(`Releases only run on dev, not "${branch}".`);

// ---------- Package ----------

const pkgJsonPath = path.join(pkgDir, "package.json");
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
const repo = pkgJson.repository?.url?.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];
if (!repo) fail(`No GitHub repository url in ${pkgJsonPath}.`);

const lastTag = `${pkgJson.name}@${pkgJson.version}`;
try {
  git("rev-parse", "--verify", "--quiet", `refs/tags/${lastTag}^{commit}`);
} catch {
  fail(`Tag ${lastTag} not found. Tag the commit of the last release first.`);
}

// ---------- Commits ----------

// One record per commit: hash, subject, body. Only commits whose scope is the package's
// folder name, e.g. `fix(common): …`. Several scopes are allowed: `fix(common,mmd-player): …`.
const SEP = "\x1f";
const END = "\x1e";
const commits = git("log", `${lastTag}..HEAD`, "--no-merges", `--format=%H${SEP}%s${SEP}%b${END}`)
  .split(END)
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [hash, subject, body] = r.split(SEP);
    const m = subject.match(/^(\w+)\(([^)]+)\)(!)?:\s*(.+)$/);
    return {
      hash,
      type: m?.[1].toLowerCase(),
      scopes: m ? m[2].split(",").map((s) => s.trim()) : [],
      breaking: !!m?.[3] || /^BREAKING[ -]CHANGE:/m.test(body ?? ""),
      text: m?.[4],
    };
  })
  .filter((c) => c.scopes.includes(folder));

if (commits.length === 0) fail(`Nothing to release: no commits with the scope "${folder}" since ${lastTag}.`);

// ---------- Version ----------

// Breaking → major, feat → minor, anything else → patch. Also below 1.0, so a breaking change moves 0.x.x to 1.0.0.
const [major, minor, patch] = pkgJson.version.split(/[.-]/).map(Number);
const level = commits.some((c) => c.breaking) ? "major" : commits.some((c) => c.type === "feat") ? "minor" : "patch";
const version =
  level === "major" ? `${major + 1}.0.0` : level === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
const tag = `${pkgJson.name}@${version}`;

// ---------- PRs and authors ----------

async function github(url) {
  const res = await fetch(`https://api.github.com/repos/${repo}/${url}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) fail(`GitHub API ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

for (const c of commits) {
  const prs = await github(`commits/${c.hash}/pulls`);
  const pr = prs.find((p) => p.merged_at);
  if (pr) {
    c.link = `[#${pr.number}](${pr.html_url})`;
    c.author = pr.user?.login;
  } else {
    c.link = `[${c.hash.slice(0, 7)}](https://github.com/${repo}/commit/${c.hash})`;
    c.author = (await github(`commits/${c.hash}`)).author?.login;
  }
}

// ---------- Notes ----------

// Emoji as commonly used by changelog tools like release-please and changelogen.
const SECTIONS = [
  ["breaking", "⚠️ Breaking Changes"],
  ["feat", "✨ Features"],
  ["fix", "🐛 Bug Fixes"],
  ["perf", "⚡ Performance"],
  ["docs", "📖 Documentation"],
  ["refactor", "♻️ Refactoring"],
  ["style", "🎨 Styles"],
  ["test", "✅ Tests"],
  ["chore", "🔧 Chores"],
  ["other", "📦 Other Changes"],
];
const known = new Set(SECTIONS.map(([key]) => key));
const sectionOf = (c) => (c.breaking ? "breaking" : known.has(c.type) ? c.type : "other");

// The @author mentions also make GitHub show the contributors' avatars under the release.
const entry = (c) => `- ${c.text} (${c.link})${c.author ? ` @${c.author}` : ""}`;

const body = SECTIONS.flatMap(([key, title]) => {
  const list = commits.filter((c) => sectionOf(c) === key);
  return list.length ? [`### ${title}`, "", ...list.map(entry), ""] : [];
}).join("\n");

const date = new Date().toISOString().slice(0, 10);
const section = `## ${version} (${date})\n\n${body}`;

// ---------- Write ----------

console.log(`${pkgJson.name}: ${pkgJson.version} → ${version} (${level}, ${commits.length} ${commits.length === 1 ? "commit" : "commits"})\n`);
console.log(section);

if (notesFile) fs.writeFileSync(notesFile, body);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`);
}
if (dryRun) process.exit(0);

// Only the version line changes, so the rest of package.json keeps its formatting.
const raw = fs.readFileSync(pkgJsonPath, "utf8");
fs.writeFileSync(pkgJsonPath, raw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));

const changelogPath = path.join(pkgDir, "CHANGELOG.md");
const old = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
fs.writeFileSync(changelogPath, `${section}\n${old}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
