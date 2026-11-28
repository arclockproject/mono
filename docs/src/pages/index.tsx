import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import CodeBlock from "@theme/CodeBlock";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import ThemedImage from "@theme/ThemedImage";
import clsx from "clsx";
import type { ReactNode } from "react";
import common from "../../../packages/common/package.json";
import mmdPlayer from "../../../packages/mmd-player/package.json";

import styles from "./index.module.css";

/** Name, version and description come from each package.json, so they stay up to date. */
const PACKAGES = [
  { pkg: common, guide: "/docs/common", api: "/docs/api/common" },
  {
    pkg: mmdPlayer,
    guide: "/docs/mmd-player",
    api: "/docs/api/mmd-player/component",
  },
];

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <ThemedImage
          className={styles.logo}
          alt="ArcLock Project logo"
          sources={{
            light: useBaseUrl("/img/favicon_light.ico"),
            dark: useBaseUrl("/img/favicon_dark.ico"),
          }}
        />
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Packages() {
  return (
    <section className={styles.packages}>
      <div className="container">
        <Heading as="h2" className="text--center">
          Packages
        </Heading>
        <div className="row">
          {PACKAGES.map(({ pkg, guide, api }) => (
            <div key={pkg.name} className="col col--6 margin-bottom--md">
              <div className={clsx("card", styles.card)}>
                <div className={clsx("card__header", styles.cardHeader)}>
                  <Heading as="h3" className="margin-bottom--none">
                    {pkg.name}
                  </Heading>
                  <Link
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    className={styles.npmBadge}
                    title={`${pkg.name} on NPM`}
                  >
                    <img
                      src={`https://img.shields.io/npm/v/${pkg.name}?label=latest`}
                      alt={`${pkg.name} on NPM`}
                      height={20}
                    />
                  </Link>
                </div>
                <div className={clsx("card__body", styles.cardBody)}>
                  <p>{pkg.description}</p>
                  <CodeBlock language="bash" className={styles.install}>
                    {`npm install ${pkg.name}`}
                  </CodeBlock>
                </div>
                <div className="card__footer">
                  <Link
                    className="button button--primary margin-right--sm"
                    to={guide}
                  >
                    Guides
                  </Link>
                  <Link className="button button--secondary" to={api}>
                    API
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Homepage"
      description="Main documentation website for ArcLock Project"
    >
      <HomepageHeader />
      <main>
        <Packages />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
