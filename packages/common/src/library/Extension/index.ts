const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "webm"];

/**
 * Finds out which file extension a URL has on the server, by trying to load it.
 * Useful when files are stored as `page-1.webp` or `page-1.png` and you only
 * know `page-1`.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Extension Guide} | {@link https://arclockproject.org/docs/api/common/library/Extension API}
 */
const Extension = {
  /**
   * Checks whether a URL loads. `mp4`, `mov`, `mkv` and `webm` are loaded as
   * videos (metadata only), anything else as an image. A `?query` or `#hash`
   * after the extension is ignored when choosing.
   *
   * @param url Full URL, with the extension.
   * @returns `true` once it loads, `false` if it fails.
   * @example
   * await Extension.probe("/cats/1.webp"); // true
   */
  probe: (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      const path = url.split(/[?#]/)[0] ?? "";
      const extension = path.split(".").pop()?.toLowerCase() ?? "";
      if (VIDEO_EXTENSIONS.includes(extension)) {
        const element = document.createElement("video");
        element.preload = "metadata";
        element.muted = true;
        element.onloadedmetadata = () => resolve(true);
        element.onerror = () => resolve(false);
        element.src = url;
        return;
      }
      const element = new Image();
      element.onload = () => resolve(true);
      element.onerror = () => resolve(false);
      element.src = url;
    }),
  /**
   * Tries each extension in order and returns the first URL that loads. The
   * extensions are tried one after another, not at the same time.
   *
   * @param urlWithNoExtension URL without the extension, like `/path/to/file`.
   * @param extensions Extensions to try. `"webp"` and `".webp"` both work.
   * @returns The URL with the first extension that loads, or `null` if none do.
   * @example
   * await Extension.resolve("/cats/1", ["webp", "png"]); // "/cats/1.png"
   * await Extension.resolve("/missing", ["webp"]); // null
   */
  resolve: async (
    urlWithNoExtension: string,
    extensions: string[],
  ): Promise<string | null> => {
    for (const extension of extensions) {
      const candidate = `${urlWithNoExtension}${extension.startsWith(".") ? "" : "."}${extension}`;
      if (await Extension.probe(candidate)) return candidate;
    }
    return null;
  },
};

export default Extension;
