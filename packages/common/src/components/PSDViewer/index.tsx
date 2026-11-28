import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  SvgIcon,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Group, Layer, NodeChild } from "@webtoon/psd";
import Psd from "@webtoon/psd";
import type { LayerProperties } from "@webtoon/psd/dist/sections";
import {
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JSX } from "react/jsx-runtime";

enum BlendMode {
  PassThrough = "pass",
  Normal = "norm",
  Dissolve = "diss",
  Darken = "dark",
  Multiply = "mul ",
  ColorBurn = "idiv",
  LinearBurn = "lbrn",
  DarkerColor = "dkCl",
  Lighten = "lite",
  Screen = "scrn",
  ColorDodge = "div ",
  LinearDodge = "lddg",
  LighterColor = "lgCl",
  Overlay = "over",
  SoftLight = "sLit",
  HardLight = "hLit",
  VividLight = "vLit",
  LinearLight = "lLit",
  PinLight = "pLit",
  HardMix = "hMix",
  Difference = "diff",
  Exclusion = "smud",
  Subtract = "fsub",
  Divide = "fdiv",
  Hue = "hue ",
  Saturation = "sat ",
  Color = "colr",
  Luminosity = "lum ",
}

const blendModeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(BlendMode).map(([name, key]) => [
    key,
    name.replace(/([a-z])([A-Z])/g, "$1 $2"),
  ]),
);

type PsdNode = Layer | Group;

type ExtraProperties = Record<
  string,
  { fillOpacity?: number; blendMode?: string } | undefined
>;

/**
 * Reads the private `layerFrame` of a layer or group. It holds the blend
 * mode, clipping and hidden flags, which the public API doesn't expose.
 */
function getProperties(node: PsdNode): LayerProperties | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: Force extract private internal property
  return (node as any).layerFrame?.layerProperties as
    | LayerProperties
    | undefined;
}

type NodeInfo = {
  blendMode: BlendMode;
  opacity: number;
  fill: number;
  hidden: boolean;
  clipped: boolean;
  hasMask: boolean;
  extra: ExtraProperties;
};

const nodeInfoCache = new WeakMap<PsdNode, NodeInfo>();

function getNodeInfo(node: PsdNode): NodeInfo {
  const cached = nodeInfoCache.get(node);
  if (cached) return cached;
  const properties = getProperties(node);
  const extra = (properties?.additionalLayerProperties ??
    {}) as ExtraProperties;
  let blendMode = (properties?.blendMode as unknown as BlendMode) ?? "norm";
  if (node.type === "Group") {
    const divider = extra.lsct ?? extra.lsdk;
    if (divider?.blendMode) blendMode = divider.blendMode as BlendMode;
  }
  if (!Object.values(BlendMode).includes(blendMode)) {
    blendMode = BlendMode.Normal;
  }
  const mask = properties?.maskData;
  const info: NodeInfo = {
    blendMode,
    opacity: (properties?.opacity ?? 255) / 255,
    fill: (extra.iOpa?.fillOpacity ?? 255) / 255,
    hidden: properties?.hidden ?? false,
    clipped: (properties?.clippingMask as unknown as number) === 1,
    hasMask:
      mask !== undefined &&
      mask.right > mask.left &&
      mask.bottom > mask.top &&
      !mask.flags.layerMaskDisabled,
    extra,
  };
  nodeInfoCache.set(node, info);
  return info;
}

type Pixels = {
  data: Uint8ClampedArray<ArrayBuffer>;
  left: number;
  top: number;
  width: number;
  height: number;
};

type Mask = {
  data: Uint8Array | Uint8ClampedArray;
  stride: number;
  left: number;
  top: number;
  width: number;
  height: number;
  outside: number;
  density: number;
};

type Coverage = {
  data: Float32Array;
  left: number;
  top: number;
  width: number;
  height: number;
};

function blankPixels(
  left: number,
  top: number,
  width: number,
  height: number,
): Pixels {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    left,
    top,
    width,
    height,
  };
}

function maskValue(mask: Mask, x: number, y: number): number {
  const mx = x - mask.left;
  const my = y - mask.top;
  const value =
    mx < 0 || my < 0 || mx >= mask.width || my >= mask.height
      ? mask.outside
      : mask.data[(my * mask.width + mx) * mask.stride]! / 255;
  return 1 - (1 - value) * mask.density;
}

function masksValue(masks: Mask[], x: number, y: number): number {
  let value = 1;
  for (const mask of masks) value *= maskValue(mask, x, y);
  return value;
}

function coverageValue(coverage: Coverage, x: number, y: number): number {
  const cx = x - coverage.left;
  const cy = y - coverage.top;
  if (cx < 0 || cy < 0 || cx >= coverage.width || cy >= coverage.height) {
    return 0;
  }
  return coverage.data[cy * coverage.width + cx]!;
}

function dissolveNoise(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type Separable = (b: number, s: number) => number;

const colorDodge: Separable = (b, s) =>
  b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s));
const colorBurn: Separable = (b, s) =>
  b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
const hardLight: Separable = (b, s) =>
  s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);

const separableModes: Partial<Record<BlendMode, Separable>> = {
  [BlendMode.Darken]: (b, s) => Math.min(b, s),
  [BlendMode.Multiply]: (b, s) => b * s,
  [BlendMode.ColorBurn]: colorBurn,
  [BlendMode.LinearBurn]: (b, s) => Math.max(0, b + s - 1),
  [BlendMode.Lighten]: (b, s) => Math.max(b, s),
  [BlendMode.Screen]: (b, s) => b + s - b * s,
  [BlendMode.ColorDodge]: colorDodge,
  [BlendMode.LinearDodge]: (b, s) => Math.min(1, b + s),
  [BlendMode.Overlay]: (b, s) => hardLight(s, b),
  [BlendMode.SoftLight]: (b, s) =>
    s <= 0.5
      ? 2 * b * s + b * b * (1 - 2 * s)
      : 2 * b * (1 - s) + Math.sqrt(b) * (2 * s - 1),
  [BlendMode.HardLight]: hardLight,
  [BlendMode.VividLight]: (b, s) =>
    s <= 0.5 ? colorBurn(b, 2 * s) : colorDodge(b, 2 * (s - 0.5)),
  [BlendMode.LinearLight]: (b, s) => Math.min(1, Math.max(0, b + 2 * s - 1)),
  [BlendMode.PinLight]: (b, s) =>
    s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1),
  [BlendMode.HardMix]: (b, s) => (b + s >= 1 ? 1 : 0),
  [BlendMode.Difference]: (b, s) => Math.abs(b - s),
  [BlendMode.Exclusion]: (b, s) => b + s - 2 * b * s,
  [BlendMode.Subtract]: (b, s) => Math.max(0, b - s),
  [BlendMode.Divide]: (b, s) =>
    s <= 0 ? (b <= 0 ? 0 : 1) : Math.min(1, b / s),
};

type Rgb = Float64Array;

const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;

const sat = (r: number, g: number, b: number) =>
  Math.max(r, g, b) - Math.min(r, g, b);

function setLum(out: Rgb, r: number, g: number, b: number, l: number): void {
  const d = l - lum(r, g, b);
  r += d;
  g += d;
  b += d;
  const n = Math.min(r, g, b);
  const x = Math.max(r, g, b);
  if (n < 0) {
    const k = l / (l - n);
    r = l + (r - l) * k;
    g = l + (g - l) * k;
    b = l + (b - l) * k;
  }
  if (x > 1) {
    const k = (1 - l) / (x - l);
    r = l + (r - l) * k;
    g = l + (g - l) * k;
    b = l + (b - l) * k;
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

function setSat(out: Rgb, r: number, g: number, b: number, s: number): void {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const k = max > min ? s / (max - min) : 0;
  out[0] = (r - min) * k;
  out[1] = (g - min) * k;
  out[2] = (b - min) * k;
}

type NonSeparable = (
  out: Rgb,
  br: number,
  bg: number,
  bb: number,
  sr: number,
  sg: number,
  sb: number,
) => void;

const nonSeparableModes: Partial<Record<BlendMode, NonSeparable>> = {
  [BlendMode.Hue]: (out, br, bg, bb, sr, sg, sb) => {
    setSat(out, sr, sg, sb, sat(br, bg, bb));
    setLum(out, out[0]!, out[1]!, out[2]!, lum(br, bg, bb));
  },
  [BlendMode.Saturation]: (out, br, bg, bb, sr, sg, sb) => {
    setSat(out, br, bg, bb, sat(sr, sg, sb));
    setLum(out, out[0]!, out[1]!, out[2]!, lum(br, bg, bb));
  },
  [BlendMode.Color]: (out, br, bg, bb, sr, sg, sb) =>
    setLum(out, sr, sg, sb, lum(br, bg, bb)),
  [BlendMode.Luminosity]: (out, br, bg, bb, sr, sg, sb) =>
    setLum(out, br, bg, bb, lum(sr, sg, sb)),
  [BlendMode.DarkerColor]: (out, br, bg, bb, sr, sg, sb) => {
    const useSource = lum(sr, sg, sb) < lum(br, bg, bb);
    out[0] = useSource ? sr : br;
    out[1] = useSource ? sg : bg;
    out[2] = useSource ? sb : bb;
  },
  [BlendMode.LighterColor]: (out, br, bg, bb, sr, sg, sb) => {
    const useSource = lum(sr, sg, sb) > lum(br, bg, bb);
    out[0] = useSource ? sr : br;
    out[1] = useSource ? sg : bg;
    out[2] = useSource ? sb : bb;
  },
};

const mixedScratch = new Float64Array(3);

/**
 * Composites `src` onto `dst` in place, the way Photoshop does: the blend
 * mode mixes the colors where both are painted, and alpha is combined with
 * "source over". With `clipToBackdrop`, `dst` keeps its alpha, which is how
 * a clipping mask paints onto its base.
 */
function blendOnto(
  dst: Pixels,
  src: Pixels,
  options: {
    mode: BlendMode;
    opacity: number;
    masks?: Mask[];
    coverage?: Coverage;
    clipToBackdrop?: boolean;
  },
): void {
  const { mode, opacity, masks = [], coverage, clipToBackdrop } = options;
  if (opacity <= 0) return;
  const separable = separableModes[mode];
  const nonSeparable = nonSeparableModes[mode];
  const dissolve = mode === BlendMode.Dissolve;
  const x0 = Math.max(src.left, dst.left);
  const y0 = Math.max(src.top, dst.top);
  const x1 = Math.min(src.left + src.width, dst.left + dst.width);
  const y1 = Math.min(src.top + src.height, dst.top + dst.height);
  const s = src.data;
  const d = dst.data;
  for (let y = y0; y < y1; y++) {
    let si = ((y - src.top) * src.width + (x0 - src.left)) * 4;
    let di = ((y - dst.top) * dst.width + (x0 - dst.left)) * 4;
    for (let x = x0; x < x1; x++, si += 4, di += 4) {
      let as = (s[si + 3]! / 255) * opacity;
      if (as <= 0) continue;
      if (masks.length > 0) as *= masksValue(masks, x, y);
      if (coverage) as *= coverageValue(coverage, x, y);
      if (as <= 0) continue;
      if (dissolve) {
        if (dissolveNoise(x, y) >= as) continue;
        as = 1;
      }
      const ab = d[di + 3]! / 255;
      if (ab <= 0) {
        if (clipToBackdrop) continue;
        d[di] = s[si]!;
        d[di + 1] = s[si + 1]!;
        d[di + 2] = s[si + 2]!;
        d[di + 3] = as * 255;
        continue;
      }
      if (nonSeparable) {
        nonSeparable(
          mixedScratch,
          d[di]! / 255,
          d[di + 1]! / 255,
          d[di + 2]! / 255,
          s[si]! / 255,
          s[si + 1]! / 255,
          s[si + 2]! / 255,
        );
      }
      const ao = clipToBackdrop ? ab : as + ab * (1 - as);
      for (let c = 0; c < 3; c++) {
        const cs = s[si + c]! / 255;
        const cb = d[di + c]! / 255;
        const m = nonSeparable
          ? mixedScratch[c]!
          : separable
            ? separable(cb, cs)
            : cs;
        d[di + c] = clipToBackdrop
          ? ((1 - as) * cb + as * m) * 255
          : ((as * (1 - ab) * cs + as * ab * m + (1 - as) * ab * cb) / ao) *
            255;
      }
      d[di + 3] = ao * 255;
    }
  }
}

/**
 * Fades `dst` back towards `before` where `amount` and the masks are below 1.
 * Used for pass-through groups with an opacity below 100%.
 */
function fadeTowards(
  dst: Pixels,
  before: Uint8ClampedArray,
  amount: number,
  masks: Mask[],
): void {
  const d = dst.data;
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const t = amount * masksValue(masks, x + dst.left, y + dst.top);
      if (t >= 1) continue;
      const i = (y * dst.width + x) * 4;
      const aBefore = before[i + 3]! / 255;
      const aAfter = d[i + 3]! / 255;
      const a = aBefore + (aAfter - aBefore) * t;
      if (a <= 0) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const pBefore = before[i + c]! * aBefore;
        d[i + c] = (pBefore + (d[i + c]! * aAfter - pBefore) * t) / a;
      }
      d[i + 3] = a * 255;
    }
  }
}

function coverageOf(pixels: Pixels, masks: Mask[]): Coverage {
  const data = new Float32Array(pixels.width * pixels.height);
  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const i = y * pixels.width + x;
      const alpha = pixels.data[i * 4 + 3]! / 255;
      data[i] =
        alpha > 0
          ? alpha * masksValue(masks, x + pixels.left, y + pixels.top)
          : 0;
    }
  }
  const { left, top, width, height } = pixels;
  return { data, left, top, width, height };
}

const CANCELLED = Symbol("cancelled");

type RenderContext = {
  width: number;
  height: number;
  isVisible: (node: PsdNode) => boolean;
  isCancelled: () => boolean;
  lastYield: number;
};

const layerPixelCache = new WeakMap<Layer, Promise<Pixels | null>>();
const layerMaskCache = new WeakMap<Layer, Promise<Mask[]>>();

function getLayerPixels(layer: Layer): Promise<Pixels | null> {
  let cached = layerPixelCache.get(layer);
  if (!cached) {
    cached = (async () => {
      const { width, height, left, top } = layer;
      if (width <= 0 || height <= 0) return null;
      try {
        const data = await layer.composite(false);
        if (data.length !== width * height * 4) return null;
        return {
          data: new Uint8ClampedArray(data),
          left,
          top,
          width,
          height,
        };
      } catch {
        return null;
      }
    })();
    layerPixelCache.set(layer, cached);
  }
  return cached;
}

function toMask(
  data: Uint8Array | undefined,
  rect: { left: number; top: number; right: number; bottom: number },
  outside: number,
  density: number | undefined,
): Mask | null {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (!data || width <= 0 || height <= 0) return null;
  const stride = data.length >= width * height * 4 ? 4 : 1;
  if (data.length < width * height * stride) return null;
  return {
    data,
    stride,
    left: rect.left,
    top: rect.top,
    width,
    height,
    outside: outside / 255,
    density: (density ?? 255) / 255,
  };
}

function getLayerMasks(layer: Layer): Promise<Mask[]> {
  let cached = layerMaskCache.get(layer);
  if (!cached) {
    cached = (async () => {
      const masks: Mask[] = [];
      const maskData = layer.maskData;
      if (!maskData || maskData.flags.layerMaskDisabled) return masks;
      const fromVector = maskData.flags.userMaskFromRenderingOtherData;
      try {
        const user = toMask(
          await layer.userMask(),
          maskData,
          maskData.backgroundColor,
          fromVector
            ? maskData.parameters?.vectorMaskDensity
            : maskData.parameters?.userMaskDensity,
        );
        if (user) masks.push(user);
      } catch {}
      const real = maskData.realData;
      if (real && !real.flags.layerMaskDisabled) {
        try {
          const mask = toMask(
            await layer.realUserMask(),
            real,
            real.backgroundColor,
            maskData.parameters?.userMaskDensity,
          );
          if (mask) masks.push(mask);
        } catch {}
      }
      return masks;
    })();
    layerMaskCache.set(layer, cached);
  }
  return cached;
}

async function checkpoint(ctx: RenderContext): Promise<void> {
  if (performance.now() - ctx.lastYield > 24) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    ctx.lastYield = performance.now();
  }
  if (ctx.isCancelled()) throw CANCELLED;
}

/**
 * Draws children (stored top first) from the bottom up. A layer marked as
 * clipped is drawn inside the nearest unclipped sibling below it.
 */
async function renderChildren(
  ctx: RenderContext,
  children: NodeChild[],
  dst: Pixels,
): Promise<void> {
  const bottomUp = [...children].reverse();
  let i = 0;
  while (i < bottomUp.length) {
    const base = bottomUp[i]!;
    i++;
    const clipped: PsdNode[] = [];
    while (i < bottomUp.length && getNodeInfo(bottomUp[i]!).clipped) {
      clipped.push(bottomUp[i]!);
      i++;
    }
    if (!ctx.isVisible(base)) continue;
    await drawNode(
      ctx,
      base,
      clipped.filter((node) => ctx.isVisible(node)),
      dst,
    );
  }
}

/**
 * Renders a node on its own, without its opacity or blend mode. Layers come
 * back with their masks applied.
 */
async function isolatedPixels(
  ctx: RenderContext,
  node: PsdNode,
): Promise<{ pixels: Pixels; masks: Mask[] } | null> {
  if (node.type === "Layer") {
    const pixels = await getLayerPixels(node);
    if (!pixels) return null;
    return { pixels, masks: await getLayerMasks(node) };
  }
  const pixels = blankPixels(0, 0, ctx.width, ctx.height);
  await renderChildren(ctx, node.children, pixels);
  return { pixels, masks: [] };
}

async function drawNode(
  ctx: RenderContext,
  node: PsdNode,
  clipped: PsdNode[],
  dst: Pixels,
): Promise<void> {
  await checkpoint(ctx);
  const info = getNodeInfo(node);
  if (clipped.length === 0) {
    if (node.type === "Group" && info.blendMode === BlendMode.PassThrough) {
      const amount = info.opacity * info.fill;
      if (amount >= 1) {
        await renderChildren(ctx, node.children, dst);
        return;
      }
      const before = dst.data.slice();
      await renderChildren(ctx, node.children, dst);
      fadeTowards(dst, before, amount, []);
      return;
    }
    const isolated = await isolatedPixels(ctx, node);
    if (!isolated) return;
    blendOnto(dst, isolated.pixels, {
      mode: info.blendMode,
      opacity: info.opacity * info.fill,
      masks: isolated.masks,
    });
    return;
  }

  const isolated = await isolatedPixels(ctx, node);
  if (!isolated) return;
  const { pixels, masks } = isolated;
  const base = blankPixels(
    pixels.left,
    pixels.top,
    pixels.width,
    pixels.height,
  );
  blendOnto(base, pixels, {
    mode: BlendMode.Normal,
    opacity: info.fill,
    masks,
  });
  const coverage = info.fill < 1 ? coverageOf(pixels, masks) : undefined;
  for (const child of clipped) {
    await checkpoint(ctx);
    const childInfo = getNodeInfo(child);
    const childIsolated = await isolatedPixels(ctx, child);
    if (!childIsolated) continue;
    blendOnto(base, childIsolated.pixels, {
      mode:
        childInfo.blendMode === BlendMode.PassThrough
          ? BlendMode.Normal
          : childInfo.blendMode,
      opacity: childInfo.opacity * childInfo.fill,
      masks: childIsolated.masks,
      coverage,
      clipToBackdrop: coverage === undefined,
    });
  }
  blendOnto(dst, base, {
    mode:
      info.blendMode === BlendMode.PassThrough
        ? BlendMode.Normal
        : info.blendMode,
    opacity: info.opacity,
  });
}

async function renderPsd(
  psd: Psd,
  isVisible: (node: PsdNode) => boolean,
  isCancelled: () => boolean,
): Promise<Pixels> {
  const ctx: RenderContext = {
    width: psd.width,
    height: psd.height,
    isVisible,
    isCancelled,
    lastYield: performance.now(),
  };
  const canvas = blankPixels(0, 0, psd.width, psd.height);
  await renderChildren(ctx, psd.children, canvas);
  return canvas;
}

function forEachNode(nodes: NodeChild[], fn: (node: PsdNode) => void): void {
  for (const node of nodes) {
    fn(node);
    if (node.type === "Group") forEachNode(node.children, fn);
  }
}

const adjustmentKeys = new Set([
  "levl",
  "curv",
  "brit",
  "blnc",
  "hue2",
  "hue ",
  "selc",
  "mixr",
  "grdm",
  "phfl",
  "expA",
  "vibA",
  "thrs",
  "post",
  "nvrt",
  "clrL",
  "blwh",
]);

/** Lists the parts of a file that the layer renderer can't draw. */
function findUnsupported(psd: Psd): string[] {
  let effects = false;
  let adjustments = false;
  let groupMasks = false;
  forEachNode(psd.children, (node) => {
    const info = getNodeInfo(node);
    const keys = Object.keys(info.extra);
    if (keys.includes("lfx2") || keys.includes("lrFX")) effects = true;
    if (keys.some((key) => adjustmentKeys.has(key))) adjustments = true;
    if (node.type === "Group" && info.hasMask) groupMasks = true;
  });
  const notes: string[] = [];
  if (effects) notes.push("layer effects (shadows, strokes, glows)");
  if (adjustments) notes.push("adjustment layers");
  if (groupMasks) notes.push("group masks");
  return notes;
}

function loadPsd(
  src: string,
  onProgress: (loaded: number, total: number | null) => void,
): { promise: Promise<ArrayBuffer>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<ArrayBuffer>((resolve, reject) => {
    xhr.open("GET", src, true);
    xhr.responseType = "arraybuffer";
    xhr.onprogress = (event) => {
      onProgress(event.loaded, event.lengthComputable ? event.total : null);
    };
    xhr.onload = () => {
      if (xhr.status >= 400) {
        reject(new Error(`Download failed (HTTP ${xhr.status}).`));
      } else {
        resolve(xhr.response as ArrayBuffer);
      }
    };
    xhr.onerror = () => reject(new Error("Download failed."));
    xhr.onabort = () => reject(CANCELLED);
    xhr.send();
  });
  return { promise, abort: () => xhr.abort() };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileName(src: string): string {
  const path = src.split(/[?#]/)[0] ?? src;
  const name = path.split("/").pop() || "Photoshop document";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

const icon = (path: string) =>
  function PathIcon(props: { fontSize?: "small" | "inherit" | "large" }) {
    return (
      <SvgIcon fontSize={props.fontSize ?? "small"}>
        <path d={path} />
      </SvgIcon>
    );
  };

const VisibleIcon = icon(
  "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3",
);
const HiddenIcon = icon(
  "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z",
);
const ChevronIcon = icon("M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
const FolderIcon = icon(
  "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z",
);
const LayersIcon = icon(
  "m11.99 18.54-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27z",
);
const ImageIcon = icon(
  "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z",
);
const TextIcon = icon("M2.5 4v3h5v12h3V7h5V4zm19 5h-9v3h3v7h3v-7h3z");
const ClipIcon = icon(
  "m19 15-6 6-1.42-1.42L15.17 16H4V4h2v10h9.17l-3.59-3.58L13 9z",
);
const ResetIcon = icon(
  "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8",
);

const checkerboard = {
  backgroundColor: "#fff",
  backgroundImage:
    "conic-gradient(#d9d9d9 25%, transparent 0 50%, #d9d9d9 0 75%, transparent 0)",
  backgroundSize: "16px 16px",
};

type Status =
  | { kind: "idle" }
  | { kind: "downloading"; loaded: number; total: number | null }
  | { kind: "parsing" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type View = "saved" | "layers";

function LayerRow(props: {
  node: NodeChild;
  depth: number;
  visibility: Map<PsdNode, boolean>;
  parentHidden: boolean;
  openGroups: Set<Group>;
  onToggleVisible: (node: PsdNode) => void;
  onToggleOpen: (group: Group) => void;
}): JSX.Element {
  const { node, depth, visibility, parentHidden, openGroups } = props;
  const info = getNodeInfo(node);
  const visible = visibility.get(node) ?? !info.hidden;
  const dimmed = parentHidden || !visible;
  const isGroup = node.type === "Group";
  const open = isGroup && openGroups.has(node);
  const name = node.name || (isGroup ? "Group" : "Layer");
  const details: string[] = [];
  if (
    info.blendMode !== BlendMode.Normal &&
    info.blendMode !== BlendMode.PassThrough
  ) {
    details.push(blendModeLabels[info.blendMode] ?? info.blendMode);
  }
  if (info.opacity < 1) details.push(`${Math.round(info.opacity * 100)}%`);
  if (info.fill < 1) details.push(`Fill ${Math.round(info.fill * 100)}%`);
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minHeight: 36,
          pr: 1,
          pl: depth * 2,
          borderBottom: 1,
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Tooltip title={visible ? "Hide" : "Show"} disableInteractive>
          <IconButton
            size="small"
            aria-label={`${visible ? "Hide" : "Show"} ${name}`}
            aria-pressed={visible}
            onClick={() => props.onToggleVisible(node)}
            sx={{ color: visible ? "text.primary" : "text.disabled" }}
          >
            {visible ? <VisibleIcon /> : <HiddenIcon />}
          </IconButton>
        </Tooltip>
        {isGroup ? (
          <IconButton
            size="small"
            aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
            aria-expanded={open}
            onClick={() => props.onToggleOpen(node)}
            sx={{
              p: 0.25,
              transform: open ? "rotate(90deg)" : undefined,
              transition: "transform 120ms",
            }}
          >
            <ChevronIcon fontSize="inherit" />
          </IconButton>
        ) : (
          <Box sx={{ width: 18, flexShrink: 0 }} />
        )}
        {info.clipped && (
          <Box
            component="span"
            title="Clipped to the layer below"
            sx={{ display: "flex", color: "text.secondary", fontSize: 14 }}
          >
            <ClipIcon fontSize="inherit" />
          </Box>
        )}
        <Box
          sx={{
            display: "flex",
            color: "text.secondary",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {isGroup ? (
            <FolderIcon fontSize="inherit" />
          ) : node.text !== undefined ? (
            <TextIcon fontSize="inherit" />
          ) : (
            <ImageIcon fontSize="inherit" />
          )}
        </Box>
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            opacity: dimmed ? 0.5 : 1,
            cursor: isGroup ? "pointer" : undefined,
          }}
          onClick={isGroup ? () => props.onToggleOpen(node) : undefined}
        >
          <Typography variant="body2" noWrap title={name}>
            {name}
          </Typography>
          {details.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
              sx={{ lineHeight: 1.2 }}
            >
              {details.join(" · ")}
            </Typography>
          )}
        </Box>
      </Box>
      {open &&
        node.children.map((child, index) => (
          <LayerRow
            key={index}
            {...props}
            node={child}
            depth={depth + 1}
            parentHidden={dimmed}
          />
        ))}
    </>
  );
}

/**
 * Shows a Photoshop (`.psd`) file. Nothing downloads until the user clicks
 * "Load PSD". Then the image saved in the file is shown, with a layer panel
 * to show and hide layers and groups.
 *
 * Changing a layer redraws the image from its layers. The redraw supports
 * every blend mode, opacity and fill, layer masks, clipping masks and
 * groups. Layer effects, adjustment layers and group masks are not drawn, so
 * files that use them can look different from Photoshop. The toolbar can
 * switch back to the saved image, which is always exact.
 *
 * It fills its parent (`position: absolute; inset: 0`), so give the parent a
 * size and `position: relative`.
 *
 * Of the `<div>` props, only `style` and the mouse, touch and wheel handlers
 * are used. They go on the element that holds the image.
 *
 * @see {@link https://arclockproject.org/docs/common/components/PSDViewer Guide} | {@link https://arclockproject.org/docs/api/common/components/PSDViewer API}
 * @example
 * <div style={{ position: "relative", height: 600 }}>
 *   <PSDViewer src="/art/poster.psd" />
 * </div>
 */
function PSDViewer(
  props: HTMLAttributes<HTMLDivElement> & {
    /** URL of the `.psd` file. */
    src: string;
  },
): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<() => void>(undefined);
  const renderIdRef = useRef(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [psd, setPsd] = useState<Psd>();
  const [saved, setSaved] = useState<ImageData | null>(null);
  const [view, setView] = useState<View>("saved");
  const [visibility, setVisibility] = useState<Map<PsdNode, boolean>>(
    new Map(),
  );
  const [openGroups, setOpenGroups] = useState<Set<Group>>(new Set());
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string>();
  const [panelOpen, setPanelOpen] = useState(true);

  const name = useMemo(() => fileName(props.src), [props.src]);

  const initialVisibility = useMemo(() => {
    const map = new Map<PsdNode, boolean>();
    if (psd) {
      forEachNode(psd.children, (node) => {
        map.set(node, !getNodeInfo(node).hidden);
      });
    }
    return map;
  }, [psd]);

  const unsupported = useMemo(() => (psd ? findUnsupported(psd) : []), [psd]);

  const layerCount = useMemo(() => psd?.layers.length ?? 0, [psd]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
      renderIdRef.current++;
    };
  }, []);

  useEffect(() => {
    abortRef.current?.();
    renderIdRef.current++;
    setStatus({ kind: "idle" });
    setPsd(undefined);
    setSaved(null);
    setView("saved");
    setRenderError(undefined);
  }, [props.src]);

  const load = useCallback(async () => {
    setStatus({ kind: "downloading", loaded: 0, total: null });
    const request = loadPsd(props.src, (loaded, total) =>
      setStatus({ kind: "downloading", loaded, total }),
    );
    abortRef.current = request.abort;
    try {
      const buffer = await request.promise;
      setStatus({ kind: "parsing" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const file = Psd.parse(buffer);
      let savedImage: ImageData | null = null;
      try {
        const data = await file.composite(false);
        if (data.length === file.width * file.height * 4) {
          savedImage = new ImageData(
            new Uint8ClampedArray(data),
            file.width,
            file.height,
          );
        }
      } catch {}
      const visible = new Map<PsdNode, boolean>();
      forEachNode(file.children, (node) => {
        visible.set(node, !getNodeInfo(node).hidden);
      });
      setVisibility(visible);
      setOpenGroups(new Set());
      setSaved(savedImage);
      setView(savedImage || file.layers.length === 0 ? "saved" : "layers");
      setPsd(file);
      setStatus({ kind: "ready" });
    } catch (error) {
      if (error === CANCELLED) return;
      setStatus({
        kind: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "This file couldn't be read.",
      });
    }
  }, [props.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!psd || !canvas || !context) return;
    canvas.width = psd.width;
    canvas.height = psd.height;
    const renderId = ++renderIdRef.current;
    if (view === "saved") {
      setRendering(false);
      setRenderError(undefined);
      if (saved) context.putImageData(saved, 0, 0);
      else context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    setRendering(true);
    setRenderError(undefined);
    renderPsd(
      psd,
      (node) => visibility.get(node) ?? !getNodeInfo(node).hidden,
      () => renderIdRef.current !== renderId,
    )
      .then((pixels) => {
        if (renderIdRef.current !== renderId) return;
        context.putImageData(
          new ImageData(pixels.data, pixels.width, pixels.height),
          0,
          0,
        );
        setRendering(false);
      })
      .catch((error) => {
        if (error === CANCELLED || renderIdRef.current !== renderId) return;
        setRendering(false);
        setRenderError(
          error instanceof Error ? error.message : "Couldn't draw the layers.",
        );
      });
  }, [psd, saved, view, visibility]);

  const toggleVisible = useCallback((node: PsdNode) => {
    setVisibility((current) => {
      const next = new Map(current);
      next.set(node, !(current.get(node) ?? !getNodeInfo(node).hidden));
      return next;
    });
    setView("layers");
  }, []);

  const toggleOpen = useCallback((group: Group) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const changed = useMemo(() => {
    for (const [node, visible] of visibility) {
      if (initialVisibility.get(node) !== visible) return true;
    }
    return false;
  }, [visibility, initialVisibility]);

  const reset = () => {
    setVisibility(new Map(initialVisibility));
    if (saved) setView("saved");
  };

  let overlay: ReactNode = null;
  if (status.kind !== "ready") {
    let body: ReactNode;
    if (status.kind === "idle") {
      body = (
        <Button variant="contained" onClick={load}>
          Load PSD
        </Button>
      );
    } else if (status.kind === "downloading") {
      const percent =
        status.total && status.total > 0
          ? Math.round((status.loaded / status.total) * 100)
          : null;
      body = (
        <Box sx={{ width: "100%" }}>
          <LinearProgress
            variant={percent === null ? "indeterminate" : "determinate"}
            value={percent ?? undefined}
            aria-label="Download progress"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mt: 1 }}
          >
            {percent === null
              ? `Downloading… ${formatBytes(status.loaded)}`
              : `Downloading… ${percent}% of ${formatBytes(status.total ?? 0)}`}
          </Typography>
        </Box>
      );
    } else if (status.kind === "parsing") {
      body = (
        <Box sx={{ width: "100%" }}>
          <LinearProgress aria-label="Reading file" />
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mt: 1 }}
          >
            Reading layers…
          </Typography>
        </Box>
      );
    } else {
      body = (
        <>
          <Typography variant="body2" color="error" role="alert">
            {status.message}
          </Typography>
          <Button variant="outlined" onClick={load}>
            Try again
          </Button>
        </>
      );
    }
    overlay = (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            width: "100%",
            maxWidth: 320,
            p: 3,
            textAlign: "center",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ fontSize: 40, color: "text.secondary", display: "flex" }}>
            <LayersIcon fontSize="inherit" />
          </Box>
          <Box sx={{ maxWidth: "100%" }}>
            <Typography variant="subtitle1" noWrap title={name}>
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Photoshop document
            </Typography>
          </Box>
          {body}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
        color: "text.primary",
        containerType: "size",
      }}
    >
      {overlay}
      {status.kind === "ready" && psd && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              minHeight: 48,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap title={name}>
                {name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
                sx={{ lineHeight: 1.2 }}
              >
                {psd.width} × {psd.height} px · {layerCount}{" "}
                {layerCount === 1 ? "layer" : "layers"}
              </Typography>
            </Box>
            {rendering && (
              <CircularProgress size={18} aria-label="Drawing layers" />
            )}
            {layerCount > 0 && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={view}
                onChange={(_, value: View | null) => value && setView(value)}
                aria-label="Image source"
              >
                <ToggleButton
                  value="saved"
                  disabled={!saved || changed}
                  title={
                    saved
                      ? "The image saved in the file, exactly as Photoshop shows it"
                      : "This file has no saved image"
                  }
                  sx={{ py: 0.25, textTransform: "none" }}
                >
                  Saved
                </ToggleButton>
                <ToggleButton
                  value="layers"
                  title="Drawn from the layers"
                  sx={{ py: 0.25, textTransform: "none" }}
                >
                  Layers
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            {layerCount > 0 && (
              <Tooltip title="Reset layer visibility" disableInteractive>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Reset layer visibility"
                    disabled={!changed}
                    onClick={reset}
                  >
                    <ResetIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {layerCount > 0 && (
              <Tooltip
                title={panelOpen ? "Hide layers panel" : "Show layers panel"}
                disableInteractive
              >
                <IconButton
                  size="small"
                  aria-label="Layers panel"
                  aria-pressed={panelOpen}
                  color={panelOpen ? "primary" : "default"}
                  onClick={() => setPanelOpen(!panelOpen)}
                >
                  <LayersIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              position: "relative",
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                role="img"
                aria-label={name}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  padding: 16,
                  ...props.style,
                }}
                onWheel={props.onWheel}
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                onMouseMove={props.onMouseMove}
                onTouchMove={props.onTouchMove}
                onMouseUp={props.onMouseUp}
                onTouchEnd={props.onTouchEnd}
              >
                <canvas
                  ref={canvasRef}
                  style={{
                    ...checkerboard,
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }}
                />
              </div>
              {renderError && (
                <Typography
                  variant="caption"
                  color="error"
                  role="alert"
                  sx={{
                    position: "absolute",
                    left: 8,
                    bottom: 8,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  {renderError}
                </Typography>
              )}
            </Box>
            {panelOpen && layerCount > 0 && (
              <Box
                component="aside"
                aria-label="Layers"
                sx={{
                  width: 280,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  "@container (max-width: 600px)": {
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: "min(280px, 85%)",
                    boxShadow: 8,
                    zIndex: 1,
                  },
                }}
              >
                <Box sx={{ flex: 1, overflowY: "auto" }}>
                  {psd.children.map((child, index) => (
                    <LayerRow
                      key={index}
                      node={child}
                      depth={0}
                      visibility={visibility}
                      parentHidden={false}
                      openGroups={openGroups}
                      onToggleVisible={toggleVisible}
                      onToggleOpen={toggleOpen}
                    />
                  ))}
                </Box>
                {unsupported.length > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    sx={{
                      p: 1.5,
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    This file uses {unsupported.join(", ")}, which the layer
                    view can't draw yet. Use <strong>Saved</strong> for the
                    exact image.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

export default PSDViewer;
