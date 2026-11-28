import SourceFile from "@site/src/components/SourceFile";
import MDXComponents from "@theme-original/MDXComponents";

/** The theme's MDX components, plus `SourceFile` so MDX pages can use it without an import. */
export default {
  ...MDXComponents,
  SourceFile,
};
