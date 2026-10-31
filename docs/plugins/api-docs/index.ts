/**
 * Generates API reference pages from the JSDoc in the packages, so the JSDoc is
 * the single source for both IDE hovers and the website.
 *
 *   index.ts    plugin, options, files and cache
 *   extract.ts  TypeScript source → `Section`s (rules and JSDoc tags at the top)
 *   render.ts   `Section`s → MDX page (one `KINDS` entry per kind of export)
 *   types.ts    the `Section` data passed between them
 *
 * The generated pages are gitignored. The `_category_.json` files next to them
 * are not, so the sidebar structure lives in the repo.
 */
import fs from "node:fs";
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { type Analyzer, createAnalyzer } from "./extract";
import { renderPage } from "./render";
import type { Section } from "./types";

export type ApiDocsOptions = {
  /** Extensions of the source files to scan and watch for changes, without the dot, e.g. `["ts", "tsx"]`. */
  scanAndWatch: string[];
  packages: {
    /** Package folder, relative to the site directory, e.g. `../packages/common`. Its `tsconfig.json` is used. */
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
  title: string;
  /** Import path, relative to the package name. Empty for the package root. */
  importPath: string;
  /** Hand-written page to link to, relative to the site directory. Skipped if it does not exist. */
  guide?: string;
};

export default function apiDocs(context: LoadContext, options: ApiDocsOptions): Plugin {
  const { siteDir, siteConfig } = context;
  const selfDocsUrl = `${siteConfig.url}${siteConfig.baseUrl}docs/`; // e.g. https://arclockproject.org/docs/
  const packages = options.packages.map((pkg) => ({ ...pkg, root: path.resolve(siteDir, pkg.root) }));

  const generate = () => {
    const written = new Set<string>();
    for (const pkg of packages) {
      const sectionsOf = analyzePackage(pkg.root, selfDocsUrl, options.scanAndWatch);
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
    // Remove pages of modules that no longer exist.
    const outDirs = new Set(packages.flatMap((pkg) => pkg.modules.map((m) => path.dirname(path.resolve(siteDir, m.outFile)))));
    for (const dir of outDirs) {
      if (dir.includes("*") || !fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).map((name) => path.join(dir, name))) {
        if (file.endsWith(".mdx") && !written.has(file)) fs.rmSync(file);
      }
    }
  };

  // The docs plugin reads the docs folder while plugins load their content, so
  // the pages must exist before that, e.g. on a fresh clone.
  generate();

  return {
    name: "api-docs",
    // Re-run loadContent when a source file changes, so `docusaurus start` hot-reloads.
    getPathsToWatch: () => packages.map((pkg) => path.join(pkg.root, `src/**/*.{${options.scanAndWatch.join(",")}}`)),
    async loadContent() {
      generate();
    },
  };
}

/**
 * Analysis results per package, kept while the package's files are unchanged.
 * Docusaurus reloads content on every docs edit, and building the TypeScript
 * program is the slow part.
 */
const cache = new Map<string, { fingerprint: string; sections: Map<string, Section[]> }>();

/** Returns a function that gives the sections of an entry file, from the cache when possible. */
function analyzePackage(root: string, selfDocsUrl: string, extensions: string[]): (source: string) => Section[] {
  const srcDir = path.join(root, "src");
  const tsconfig = path.join(root, "tsconfig.json");
  const files = (fs.readdirSync(srcDir, { recursive: true }) as string[])
    .filter((name) => extensions.includes(name.split(".").pop() ?? ""))
    .sort()
    .map((name) => path.join(srcDir, name));
  const fingerprint = [tsconfig, ...files].map((file) => `${file}:${fs.statSync(file).mtimeMs}`).join("|");

  if (cache.get(root)?.fingerprint !== fingerprint) cache.set(root, { fingerprint, sections: new Map() });
  const { sections } = cache.get(root)!;
  let analyzer: Analyzer | undefined; // Only built when something is not cached.
  return (source) => {
    if (!sections.has(source)) {
      analyzer ??= createAnalyzer({ tsconfig, srcDir, selfDocsUrl });
      sections.set(source, analyzer.analyze(source));
    }
    return sections.get(source)!;
  };
}

/** Resolves the `*` in a module to every folder that has that entry file, and makes all paths absolute. */
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

/** Only writes on change, otherwise the docs plugin's file watcher loops. */
function writeIfChanged(file: string, content: string): void {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
