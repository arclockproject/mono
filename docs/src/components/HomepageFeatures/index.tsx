import type { ReactNode } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  icon: string;
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    icon: "⚡",
    title: "Ready to use",
    description: <>Install a package from npm and import it. No setup or config needed.</>,
  },
  {
    icon: "📦",
    title: "Only what you need",
    description: (
      <>
        Every component and library has its own import path, so your app only bundles the parts you actually use.
      </>
    ),
  },
  {
    icon: "🧪",
    title: "Try before you install",
    description: (
      <>
        Every guide has live examples you can edit in the browser, and every export has types and docs in your editor.
      </>
    ),
  },
];

function Feature({ icon, title, description }: FeatureItem) {
  return (
    <div className="col col--4 margin-bottom--md">
      <div className={clsx("card", styles.card)}>
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
        <Heading as="h3">{title}</Heading>
        <p className="margin-bottom--none">{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          Why ArcLock?
        </Heading>
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
