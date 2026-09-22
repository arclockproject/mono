import type { ReactNode } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";
type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Quick",
    description: (
      <>
        Each package is expected to works right after installing it through NPM
        like any other package.
      </>
    ),
  },
  {
    title: "Small",
    description: (
      <>
        No one likes too many dependencies, everything is split into separate
        packages at <code>@arclockproject/*</code> No one package with gazillion
        dependencies.
      </>
    ),
  },
  {
    title: "Easy",
    description: (
      <>
        Although each element comes with TypeScript definitions to help with
        questions during development, this documentation contains live demos
        with usage examples!
      </>
    ),
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center text--italic text--light">{title}</div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
