/**
 * Generates API reference pages from the JSDoc in the packages, so the JSDoc in
 * the source is the single source of truth for both the IDE hover docs and the
 * website.
 *
 * For each module it writes one page, which documents every export: functions,
 * components and their props, classes, objects and types. Local types the API
 * uses but does not export are documented too.
 *
 * The generated pages are gitignored. The `_category_.json` files next to them
 * are not, so the sidebar structure lives in the repo.
 *
 * JSDoc conventions:
 * - Links to the docs site itself are dropped, since they only exist so IDE
 *   hovers can link to the website.
 * - `@internal`, `@hidden` or `@ignore` leave a declaration out.
 * - `@default` sets the default shown for a prop or property.
 */
import fs from "node:fs";
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { createAnalyzer } from "./extract";
import { renderPage } from "./render";
import type { Section } from "./types";

export type ApiDocsOptions = {
  packages: {
    /** Package folder, relative to the site directory. Its `tsconfig.json` is used. */
    root: string;
    /** Package name, used for the import line, e.g. `@arclockproject/common`. */
    name: string;
    modules: Module[];
  }[];
};

type Module = {
  /**
   * Entry file, relative to `root`. A `*` matches any one folder name, so new
   * modules are picked up without changing the config. In the options below,
   * `*` is replaced with the folder it matched.
   * @example "src/library/* /index.ts" (without the space)
   */
  source: string;
  /** Generated page, relative to the site directory. */
  outFile: string;
  /** Page title. */
  title: string;
  /** Import path, relative to the package name. Empty for the package root. */
  importPath: string;
  /** Hand-written page to link to, relative to the site directory. Skipped if it does not exist. */
  guide?: string;
};

/**
 * Analysis results per package, kept while the package's source files are
 * unchanged. Docusaurus reloads content on every docs edit, and building the
 * TypeScript program is the slow part.
 */
const cache = new Map<string, { fingerprint: string; sections: Map<string, Section[]> }>();

export default function apiDocs(context: LoadContext, options: ApiDocsOptions): Plugin {
  const { siteDir, siteConfig } = context;
  const selfDocsUrl = `${siteConfig.url}${siteConfig.baseUrl}docs/`;
  const packages = options.packages.map((pkg) => ({ ...pkg, root: path.resolve(siteDir, pkg.root) }));

  const generate = () => {
    const written = new Set<string>();
    for (const pkg of packages) {
      const sectionsOf = analyzePackage(pkg.root, selfDocsUrl);
      for (const module of pkg.modules.flatMap((m) => expand(pkg.root, siteDir, m))) {
        const guide = module.guide && fs.existsSync(module.guide) ? module.guide : undefined;
        const content = renderPage(sectionsOf(module.source), {
          title: module.title,
          sourceLabel: path.relative(siteDir, module.source),
          importPath: [pkg.name, module.importPath].filter(Boolean).join("/"),
          guideLink: guide && path.relative(path.dirname(module.outFile), guide).split(path.sep).join("/"),
        });
        writeIfChanged(module.outFile, content);
        written.add(module.outFile);
      }
    }
    removeStalePages(packages.flatMap((pkg) => pkg.modules.map((m) => path.resolve(siteDir, m.outFile))), written);
  };

  // The docs plugin reads the docs folder while plugins load their content, so
  // the pages must exist before that, e.g. on a fresh clone.
  generate();

  return {
    name: "api-docs",
    // Re-run loadContent when a source file changes, so `docusaurus start` hot-reloads.
    getPathsToWatch: () => packages.map((pkg) => path.join(pkg.root, "src/**/*.{ts,tsx}")),
    async loadContent() {
      generate();
    },
  };
}

/** Returns a function that gives the sections of an entry file, from the cache when possible. */
function analyzePackage(root: string, selfDocsUrl: string): (source: string) => Section[] {
  const srcDir = path.join(root, "src");
  const tsconfig = path.join(root, "tsconfig.json");
  const fingerprint = [tsconfig, ...sourceFiles(srcDir)].map((file) => `${file}:${fs.statSync(file).mtimeMs}`).join("|");

  let entry = cache.get(root);
  if (entry?.fingerprint !== fingerprint) {
    entry = { fingerprint, sections: new Map() };
    cache.set(root, entry);
  }
  const { sections } = entry;
  let analyzer: ReturnType<typeof createAnalyzer> | undefined;
  return (source) => {
    if (!sections.has(source)) {
      analyzer ??= createAnalyzer({ tsconfig, srcDir, selfDocsUrl });
      sections.set(source, analyzer.analyze(source));
    }
    return sections.get(source)!;
  };
}

function sourceFiles(dir: string): string[] {
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((name) => /\.tsx?$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

/** Resolves the `*` in a module entry to every folder that has that entry file. */
function expand(root: string, siteDir: string, module: Module): Module[] {
  const fill = (match: string): Module => {
    const replace = (text: string) => text.replaceAll("*", match);
    return {
      source: path.resolve(root, replace(module.source)),
      outFile: path.resolve(siteDir, replace(module.outFile)),
      title: replace(module.title),
      importPath: replace(module.importPath),
      guide: module.guide && path.resolve(siteDir, replace(module.guide)),
    };
  };
  if (!module.source.includes("*")) return [fill("")];

  const [before, after] = path.resolve(root, module.source).split("*") as [string, string];
  if (!fs.existsSync(before)) return [];
  return fs
    .readdirSync(before, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(`${before}${entry.name}${after}`))
    .map((entry) => fill(entry.name));
}

function writeIfChanged(file: string, content: string): void {
  // Only write on change, otherwise the docs plugin's file watcher loops.
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Removes pages of modules that no longer exist, from the folders the `outFile` patterns write to. */
function removeStalePages(outFilePatterns: string[], written: Set<string>): void {
  for (const dir of new Set(outFilePatterns.map((p) => path.dirname(p)))) {
    if (dir.includes("*") || !fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (name.endsWith(".mdx") && !written.has(file)) fs.rmSync(file);
    }
  }
}
