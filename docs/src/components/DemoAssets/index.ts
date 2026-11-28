/**
 * Where the demo files live. `base` is the demo-assets repo, `noname0310` is only for mmd-player.
 */
const REMOTE = {
  // Can change to https://example.com/demo-assets if moved offshore.
  base:
    process.env.NODE_ENV === "production"
      ? "https://arclockproject.github.io/demo-assets"
      : "/demo-assets", // git clone assets repo to static
  noname0310:
    "https://noname0310.github.io/web-mmd-viewer/melancholic_night/mmd_public",
};

/**
 * Demo helper: returns a URL to a short generated beep, so the audio examples
 * work without any sound files. Results are cached per frequency.
 */
const beepCache: Record<number, string> = {};
function beepUrl(frequency = 440): string {
  if (beepCache[frequency]) return beepCache[frequency];
  const rate = 22050;
  const length = Math.floor(rate * 0.2);
  const view = new DataView(new ArrayBuffer(44 + length * 2));
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  // WAV header: mono, 16-bit
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const fade = 1 - i / length;
    const sample = Math.sin((2 * Math.PI * frequency * i) / rate);
    view.setInt16(44 + i * 2, sample * fade * 12000, true);
  }
  beepCache[frequency] = URL.createObjectURL(
    new Blob([view], { type: "audio/wav" }),
  );
  return beepCache[frequency];
}

/**
 * Demo helper: returns a placehold.co image URL, for demos that need many
 * pictures of different sizes. Nothing is downloaded until the URL is used.
 *
 * @param width Pixels, from 10 to 4000.
 * @param height Pixels, from 10 to 4000. Leave it out for a square.
 * @param options.background Hex without `#` (e.g. `"1e293b"`) or a CSS name. Only used together with `color`.
 * @param options.color Text colour, same format as `background`.
 * @param options.text Shown in the middle. Defaults to the size, e.g. `600 x 400`.
 * @param options.format File format. SVG can't be used by every component, so it isn't offered.
 * @example
 * placeholder(600, 400); // "https://placehold.co/600x400.webp"
 * placeholder(800, 1200, { background: "1e293b", color: "fff", text: "Page 1" });
 */
function placeholder(
  width: number,
  height = width,
  options: {
    background?: string;
    color?: string;
    text?: string;
    format?: "png" | "jpeg" | "webp" | "avif";
  } = {},
): string {
  const colors =
    options.background && options.color
      ? `/${options.background}/${options.color}`
      : "";
  const query = options.text
    ? `?${new URLSearchParams({ text: options.text })}`
    : "";
  return `https://placehold.co/${width}x${height}${colors}.${options.format ?? "webp"}${query}`;
}

export { REMOTE, beepUrl, placeholder };
