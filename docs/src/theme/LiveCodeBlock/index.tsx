import React, { type ReactNode } from "react";
//@ts-ignore Docosaurus does resolve this import.
import Playground from "@theme/Playground";
import BrowserOnly from "@docusaurus/BrowserOnly";
//@ts-ignore Docosaurus does resolve this import.
import type { Props } from "@theme/LiveCodeBlock";

/**
 * Here we render the codeblock with no scope as SSG (so no js clients see code)
 * Code Section will get the scope on client side so any client only code does not break the playground.
 */
export default function LiveCodeBlock(props: Props): ReactNode {
  return (
    <BrowserOnly fallback={<Playground {...props} />}>
      {() => {
        const ReactLiveScope = require("@theme/ReactLiveScope").default;
        return <Playground scope={ReactLiveScope} {...props} />;
      }}
    </BrowserOnly>
  );
}
