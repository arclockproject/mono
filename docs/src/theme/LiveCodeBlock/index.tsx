import BrowserOnly from "@docusaurus/BrowserOnly";
//@ts-expect-error Docosaurus does resolve this import.
import type { Props } from "@theme/LiveCodeBlock";
//@ts-expect-error Docosaurus does resolve this import.
import Playground from "@theme/Playground";
//@ts-expect-error Docosaurus does resolve this import.
import PlaygroundContainer from "@theme/Playground/Container";
//@ts-expect-error Docosaurus does resolve this import.
import PlaygroundLayout from "@theme/Playground/Layout";
//@ts-expect-error Docosaurus does resolve this import.
import PlaygroundProvider from "@theme/Playground/Provider";
import type { ReactNode } from "react";

/**
 * Shows the playground with its code, but never runs the code. Used as the
 * server render and until the scope has loaded, since running the code without
 * its scope only logs errors.
 */
function StaticPlayground({ children, metastring, ...props }: Props) {
  const noInline = metastring?.includes("noInline") ?? false;
  return (
    <PlaygroundContainer>
      <PlaygroundProvider
        code={children}
        metastring={metastring}
        {...props}
        transformCode={() => (noInline ? "render(null)" : "null")}
      >
        <PlaygroundLayout />
      </PlaygroundProvider>
    </PlaygroundContainer>
  );
}

/**
 * Renders the codeblock without running it as SSG (so no js clients see code).
 * Code Section will get the scope on client side so any client only code does not break the playground.
 */
export default function LiveCodeBlock(props: Props): ReactNode {
  return (
    <BrowserOnly fallback={<StaticPlayground {...props} />}>
      {() => {
        const ReactLiveScope = require("@theme/ReactLiveScope").default;
        return <Playground scope={ReactLiveScope} {...props} />;
      }}
    </BrowserOnly>
  );
}
