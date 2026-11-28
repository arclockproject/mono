/**
 * Copies each package's `CHANGELOG.md` into the docs as a "Changelog" page.
 * The pages are gitignored and update when a changelog changes.
 */
import fs from "node:fs";
import path from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";

export type ChangelogPageOptions = {
  pages: {
    /** Changelog file, relative to the site directory. */
    source: string;
    /** Generated page, relative to the site directory. */
    outFile: string;
  }[];
};

export default function changelogPage(
  { siteDir }: LoadContext,
  { pages }: ChangelogPageOptions,
): Plugin {
  const generate = () => {
    for (const { source, outFile } of pages) {
      const file = path.resolve(siteDir, outFile);
      const content = `---\ntitle: Changelog\nsidebar_position: 10\n---\n\n${fs.readFileSync(path.resolve(siteDir, source), "utf8")}`;
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content)
        continue;
      fs.writeFileSync(file, content);
    }
  };
  generate();

  return {
    name: "changelog-page",
    getPathsToWatch: () =>
      pages.map(({ source }) => path.resolve(siteDir, source)),
    async loadContent() {
      generate();
    },
  };
}
