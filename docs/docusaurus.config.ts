import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

import npm2yarn from "@docusaurus/remark-plugin-npm2yarn";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)
const config: Config = {
  title: "ArcLock Project",
  tagline: "An easy solution for difficult problems.",
  favicon: "img/favicon.ico",
  themes: ["@docusaurus/theme-live-codeblock"],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://arclockproject.org",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",
  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "arclockproject", // Usually your GitHub org/user name.
  projectName: "mono", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  plugins: [
    async function MMDDocusaurusFix(context, options) {
      return {
        name: "mmd-docusaurus-fix",
        configureWebpack: () => ({
          resolve: {
            fallback: { path: false, fs: false },
            extensions: [".jsx", ".js", ".tsx", ".ts"],
          },
        }),
      };
    },
  ],
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          onInlineTags: "warn",
          remarkPlugins: [[npm2yarn, { sync: true }]],
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
          remarkPlugins: [[npm2yarn, { sync: true }]],
        },
        pages: {
          remarkPlugins: [[npm2yarn, { sync: true }]],
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "ArcLock Project",
      logo: {
        alt: "ArcLock Project Logo",
        src: "img/favicon_light.ico",
        srcDark: "img/favicon_dark.ico",
        style: {
          imageRendering: "pixelated",
        },
      },
      hideOnScroll: true,
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        { to: "/blog", label: "Blog", position: "left" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
            {
              label: "@arclockproject/common",
              to: "/docs/common",
            },
            {
              label: "@arclockproject/mmd-player",
              to: "/docs/mmd-player",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Issues",
              href: "https://github.com/ArcLockProject/mono/issues",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "NPM",
              href: "https://www.npmjs.com/org/arclockproject",
            },
            {
              label: "GitHub",
              href: "https://github.com/ArcLockProject/mono",
            },
          ],
        },
      ],
      copyright: `Copyright © 2025-${new Date().getFullYear()} Artur Wagner. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
