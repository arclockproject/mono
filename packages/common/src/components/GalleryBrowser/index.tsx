import PageChangeDrawer from "@arclockproject/common/components/GalleryBrowser/PageChangeDrawer";
import {
  type Alignment,
  AlignmentPicker,
  horizontal,
  parseAlignment,
  Section,
  SettingsPanel,
  vertical,
} from "@arclockproject/common/components/GalleryBrowser/Settings";
import ImageMovable from "@arclockproject/common/components/Image";
import type { MovableTransform } from "@arclockproject/common/components/Movable";
import Extension from "@arclockproject/common/library/Extension";
import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import AppsIcon from "@mui/icons-material/Apps";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import CloseIcon from "@mui/icons-material/Close";
import ControlCameraIcon from "@mui/icons-material/ControlCamera";
import DownloadIcon from "@mui/icons-material/Download";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import HdIcon from "@mui/icons-material/Hd";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SdIcon from "@mui/icons-material/Sd";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Button,
  Skeleton,
  Slider,
  type SxProps,
  type Theme,
  Typography,
  useTheme,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";

/**
 * One page of a `GalleryBrowser`. Add your own fields as needed. The whole
 * item is passed to `data.urlResolver`.
 */
export type GalleryItem = {
  /**
   * How to show the page. Falls back to `data.typeAll`, then `"image"`.
   */
  type?: "video" | "image";
  /**
   * URL of the file. Without a `data.urlResolver` it is used as is, so it must
   * be a full URL. With one, it is up to the resolver what it means.
   */
  url?: string;
};

/**
 * Cache settings of a `GalleryBrowser`.
 */
export type GalleryCacheOptions = {
  /**
   * How many pages before and after the current one to resolve and preload.
   * `0` turns preloading off.
   */
  range: number;
  /**
   * Forget resolved URLs when `id` changes. When `false`, going back to an
   * earlier `id` reuses its URLs.
   */
  clearOnIDChange: boolean;
};

/**
 * Tries each extension on a URL that has none and returns the first one that loads.
 *
 * @param urlWithNoExtension URL without the extension, like `/path/to/file`.
 * @param extensions Extensions to try, in order. `"webp"` and `".webp"` both work.
 *   `mp4`, `mov`, `mkv` and `webm` are checked as videos, anything else as images.
 * @returns The URL with the first extension that loads, or `null` if none do.
 */
export type ExtensionResolver = (
  urlWithNoExtension: string,
  extensions: string[],
) => Promise<string | null>;

const probe = Extension.probe;
const extensionResolver: ExtensionResolver = Extension.resolve;

const TAP_MAX_MOVE = 8;
const TAP_MAX_TIME = 300;
const DOUBLE_TAP_TIME = 300;
const SWIPE_MIN_MOVE = 50;
const SWIPE_MAX_TIME = 500;

function getClosest(array: number[], goal: number): number {
  return array.reduce((prev, curr) =>
    Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev,
  );
}

function getPage(
  current: number,
  offset: number,
  validOrLast: number[] | number,
): number {
  if (typeof validOrLast === "number") {
    return Math.min(validOrLast, Math.max(0, current + offset));
  }
  if (validOrLast.length === 0) return 0;
  let index = validOrLast.indexOf(current);
  if (index === -1)
    index = validOrLast.indexOf(getClosest(validOrLast, current));
  const nextIndex = Math.min(
    validOrLast.length - 1,
    Math.max(0, index + offset),
  );
  return validOrLast[nextIndex] ?? 0;
}

class Cache {
  data: { [key: string]: Promise<string | null> } = {};
  transforms: { [key: string]: MovableTransform } = {};
  warmed = new Set<string>();
  constructor(public options: GalleryCacheOptions) {}
  onIDChange = () => {
    if (!this.options.clearOnIDChange) return;
    this.data = {};
    this.transforms = {};
    this.warmed.clear();
  };
  warm = (url: string) => {
    if (this.warmed.has(url)) return;
    this.warmed.add(url);
    new Image().src = url;
  };
}

const useCache = (options: GalleryCacheOptions): Cache => {
  const cache = useRef<Cache>(undefined);
  if (cache.current === undefined) {
    cache.current = new Cache(options);
  } else {
    cache.current.options = options;
  }
  return cache.current;
};

/**
 * A gallery of images and videos with a page counter, fullscreen, and drag
 * and zoom.
 *
 * Click the left or right quarter, or swipe sideways, to change page. Click the
 * middle to show the controls, and double-click it to turn drag and zoom on or
 * off. While drag and zoom is on, swipes move the image instead, and clicks on
 * the sides still change page. A press only counts as a click if it moves less
 * than 8px and is released within 300ms. With focus on the gallery, the arrow
 * keys change page, `F` toggles fullscreen and `L` toggles the bookmark of the
 * current page. Paging wraps around at both ends.
 *
 * Each page's URL is resolved once and cached. Nearby pages are resolved and
 * preloaded too, see `cache.range`.
 *
 * @see {@link https://arclockproject.org/docs/common/components/GalleryBrowser Guide} | {@link https://arclockproject.org/docs/api/common/components/GalleryBrowser API}
 * @example
 * <GalleryBrowser id="cats" backgroundBloom useTwoResolutions={false}
 *   cache={{ range: 2, clearOnIDChange: true }}
 *   data={{ items: [{ url: "/cat.webp" }, { url: "/cat.mp4", type: "video" }] }}
 * />
 */
export function GalleryBrowser<
  itemData extends GalleryItem = GalleryItem,
>(props: {
  /**
   * Unique ID of the gallery. Changing it goes back to the first page.
   * Change it whenever `data.items` changes, because URLs are cached per `id`.
   */
  id: string;
  /**
   * Draw a blurred, glowing copy of the current page behind the gallery.
   */
  backgroundBloom: boolean;
  /**
   * `data.urlResolver` can return a small (SD) and a large (HD) URL for each
   * page. Adds an SD/HD button. When `false`, `isHD` is always `false`.
   */
  useTwoResolutions: boolean;
  /**
   * Start in HD. Only used when `useTwoResolutions` is on.
   * @default false
   */
  defaultHD?: boolean;
  /**
   * In HD, show the SD file first and swap in the HD file once it has loaded.
   * Nearby pages are preloaded in SD. Videos always load HD directly.
   *
   * When `false`, HD fetches only HD files, for the current and nearby pages.
   * @default false
   */
  loadSDFirst?: boolean;
  /**
   * Cache settings.
   */
  cache: GalleryCacheOptions;
  /**
   * The pages, and how to turn each one into a URL.
   */
  data: {
    /**
     * The pages. Pass a number to have that many pages with no data, and
     * build their URLs in `urlResolver` from the index.
     */
    items: itemData[] | number;
    /**
     * Type of every page that has no `type` of its own.
     * @default "image"
     */
    typeAll?: "video" | "image";
    /**
     * Turns a page into a URL. Leave it out when every item has a full `url`.
     * Needed when `items` is a number. If it throws, the page shows an error
     * and is tried again next time it is shown.
     *
     * @param data The item, or `undefined` when `items` is a number.
     * @param index Index of the page, from `0`.
     * @param isHD Whether the HD file is wanted.
     * @param extensionResolver Finds the extension of a URL that has none.
     * @returns The URL, or `null` if the page has no file.
     */
    urlResolver?: (
      data: itemData | undefined,
      index: number,
      isHD: boolean,
      extensionResolver: ExtensionResolver,
    ) => Promise<string | null>;
  };
  /**
   * Bookmarked pages. Adds a heart button, and a button to page through only
   * the bookmarks. Bookmark mode is on at the start if there are any bookmarks,
   * and turns off when the last one is removed.
   */
  bookmarks?: {
    /**
     * Bookmarked page indexes, from `0`. Bookmark mode pages through them in
     * this order.
     */
    pages: number[];
    /**
     * Called by the heart button and the `L` key. Add or remove `page` from
     * `pages`.
     * @param page Index of the current page, from `0`.
     */
    toggle: (page: number) => void;
    /**
     * Called when bookmark mode turns on or off, including when it turns off
     * because there are no bookmarks left.
     * @param on Whether bookmark mode is now on.
     */
    onModeChange?: (on: boolean) => void;
  };
  /**
   * Style overrides for parts of the gallery.
   */
  style?: {
    /**
     * Every icon button: the controls in the top and bottom bars, and the
     * video play button. The play button has a dark background by default.
     */
    IconButton?: {
      /**
       * Applied after the built-in styles, so keys you set overwrite them and
       * the rest are kept. Arrays and theme functions work as in any `sx`.
       */
      sx?: SxProps<Theme>;
    };
  };
}): JSX.Element {
  const theme = useTheme();
  const items = props.data.items;
  const pageCount = typeof items === "number" ? items : items.length;
  const lastPage = Math.max(0, pageCount - 1);

  const bookmarkPages = props.bookmarks?.pages;
  const [bookmarkMode, setBookmarkModeState] = useState(
    () => (bookmarkPages?.length ?? 0) > 0,
  );
  const activeBookmarks =
    bookmarkMode && bookmarkPages && bookmarkPages.length > 0
      ? bookmarkPages
      : null;
  const validPages = activeBookmarks ?? lastPage;
  const validKey = activeBookmarks ? activeBookmarks.join(",") : lastPage;

  const [currentPage, setCurrentPage] = useState(
    () => activeBookmarks?.[0] ?? 0,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [hideControls, setHideControls] = useState(true);
  const [panning, setPanning] = useState(false);
  const [hd, setHD] = useState(props.defaultHD ?? false);
  const [pixelated, setPixelated] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [preloadRange, setPreloadRange] = useState(props.cache.range);
  const [align, setAlign] = useLocalStorageState<Alignment>(
    "galleryBrowser.align",
    { x: 0, y: 0 },
    parseAlignment,
  );
  const [requestForNewCurrentPage, setRequestForNewCurrentPage] = useState<
    string | null
  >(null);
  const [
    requestForNewCurrentPageReturnFullScreen,
    setRequestForNewCurrentPageReturnFullScreen,
  ] = useState(false);
  const [doNotExitFullscreen, setDoNotExitFullscreen] = useState(false);
  const [shown, setShown] = useState<{
    key: string;
    url: string | null;
    isVideo: boolean;
  } | null>(null);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const cache = useCache(props.cache);
  const root = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lastTap = useRef(0);
  const gesture = useRef<{
    x: number;
    y: number;
    time: number;
    multiTouch: boolean;
    transformKey?: string;
    transform?: MovableTransform;
  } | null>(null);

  const showHD = props.useTwoResolutions && hd;
  const loadSDFirst = props.loadSDFirst ?? false;
  const pageType = (page: number) =>
    (typeof items === "number" ? undefined : items[page]?.type) ??
    props.data.typeAll ??
    "image";
  const isVideo = pageType(currentPage) === "video";

  const shownKey = `${props.id}:${currentPage}`;
  const src = shown?.key === shownKey ? shown.url : undefined;
  const displayedSrc = shown?.url ?? null;
  const displayedIsVideo = shown?.isVideo ?? false;
  const imageReady = !!displayedSrc && readySrc === displayedSrc;
  const loadFailed = src === null || (!!src && failedSrc === src);

  const resolveUrl = (page: number, isHD: boolean): Promise<string | null> => {
    const key = `${props.id}:${page}:${isHD ? "hd" : "sd"}`;
    const cached = cache.data[key];
    if (cached) return cached;
    const item = typeof items === "number" ? undefined : items[page];
    const resolver = props.data.urlResolver;
    const promise = resolver
      ? resolver(item, page, isHD, extensionResolver).catch((error) => {
          console.error(error);
          delete cache.data[key];
          return null;
        })
      : Promise.resolve(item?.url ?? null);
    cache.data[key] = promise;
    return promise;
  };

  const setBookmarkMode = (on: boolean) => {
    setBookmarkModeState(on);
    props.bookmarks?.onModeChange?.(on);
  };
  const toggleBookmarkMode = () => {
    const on = !bookmarkMode;
    setBookmarkMode(on);
    if (on && bookmarkPages && bookmarkPages.length > 0)
      setCurrentPage(getPage(currentPage, 0, bookmarkPages));
  };

  const enterFullscreen = () => {
    viewer.current?.requestFullscreen?.().catch(console.error);
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement)
      document.exitFullscreen().catch(console.error);
  };
  const toggleFullscreen = () => {
    if (fullscreen) exitFullscreen();
    else enterFullscreen();
  };
  const togglePanning = () => {
    setHideControls(false);
    if (panning) {
      setPanning(false);
      if (!doNotExitFullscreen) exitFullscreen();
      setDoNotExitFullscreen(false);
    } else {
      setPanning(true);
      setDoNotExitFullscreen(fullscreen);
      if (!fullscreen) enterFullscreen();
    }
  };

  useEffect(() => {
    cache.onIDChange();
    setCurrentPage(activeBookmarks?.[0] ?? 0);
  }, [props.id]);
  useEffect(() => {
    if (bookmarkMode && !bookmarkPages?.length) setBookmarkMode(false);
  }, [bookmarkMode, bookmarkPages?.length]);
  useEffect(() => {
    const onChange = () => {
      const active =
        !!viewer.current && document.fullscreenElement === viewer.current;
      setFullscreen(active);
      if (!active) {
        setPanning(false);
        video.current?.pause();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let hdShown = false;
    const key = shownKey;
    const show = (url: string | null) => {
      if (!cancelled) setShown({ key, url, isVideo });
    };
    if (showHD && loadSDFirst && !isVideo) {
      resolveUrl(currentPage, false).then((url) => {
        if (!hdShown) show(url);
      });
      resolveUrl(currentPage, true).then(async (url) => {
        if (!url || !(await probe(url))) return;
        hdShown = true;
        show(url);
      });
    } else {
      resolveUrl(currentPage, showHD).then(show);
    }
    return () => {
      cancelled = true;
    };
  }, [shownKey, showHD, loadSDFirst]);
  useEffect(() => {
    const isHD = showHD && !loadSDFirst;
    for (let offset = 1; offset <= preloadRange; offset++) {
      for (const page of [
        getPage(currentPage, offset, validPages),
        getPage(currentPage, -offset, validPages),
      ]) {
        if (page === currentPage) continue;
        resolveUrl(page, isHD).then((url) => {
          if (url && pageType(page) !== "video") cache.warm(url);
        });
      }
    }
  }, [shownKey, showHD, loadSDFirst, validKey, preloadRange]);
  useEffect(() => {
    const target = displayedIsVideo ? video.current : image.current;
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (
      !props.backgroundBloom ||
      !imageReady ||
      !target ||
      !surface ||
      !context
    )
      return;
    const width =
      target instanceof HTMLVideoElement
        ? target.videoWidth
        : target.naturalWidth;
    const height =
      target instanceof HTMLVideoElement
        ? target.videoHeight
        : target.naturalHeight;
    if (!width || !height) return;
    const scale = Math.max(width / surface.width, height / surface.height);
    const drawWidth = width / scale;
    const drawHeight = height / scale;
    const left = (surface.width - drawWidth) / 2;
    const top = (surface.height - drawHeight) / 2;
    let ticks = 0;
    const blender = setInterval(() => {
      ticks++;
      context.globalAlpha = 0.1;
      context.fillStyle = theme.palette.background.default;
      if (top > 0) {
        context.fillRect(0, 0, surface.width, top);
        context.fillRect(0, surface.height - top, surface.width, top);
      } else if (left > 0) {
        context.fillRect(0, 0, left, surface.height);
        context.fillRect(surface.width - left, 0, left, surface.height);
      }
      try {
        context.drawImage(target, left, top, drawWidth, drawHeight);
      } catch {
        clearInterval(blender);
      }
      if (ticks >= 50) clearInterval(blender);
    }, 60);
    return () => clearInterval(blender);
  }, [
    imageReady,
    displayedSrc,
    props.backgroundBloom,
    theme.palette.background.default,
  ]);

  const firstPage = activeBookmarks ? (activeBookmarks[0] ?? 0) : 0;
  const finalPage = activeBookmarks
    ? (activeBookmarks[activeBookmarks.length - 1] ?? 0)
    : lastPage;
  const pastImage = () => {
    setCurrentPage(
      currentPage === firstPage
        ? finalPage
        : getPage(currentPage, -1, validPages),
    );
  };
  const nextImage = () => {
    setCurrentPage(
      currentPage === finalPage
        ? firstPage
        : getPage(currentPage, 1, validPages),
    );
  };

  const position = activeBookmarks
    ? activeBookmarks.indexOf(currentPage) + 1
    : currentPage + 1;
  const total = activeBookmarks ? activeBookmarks.length : pageCount;

  const hideLeftRightTaps = isVideo || pageCount === 1;
  const hideWhenVideoInteractive = isVideo && panning;
  const controlsHidden = hideControls || hideWhenVideoInteractive;
  const iconButtonSx = (base: SxProps<Theme>): SxProps<Theme> => {
    const custom = props.style?.IconButton?.sx;
    return [
      ...(Array.isArray(base) ? base : [base]),
      ...(Array.isArray(custom) ? custom : [custom]),
    ];
  };
  const controlSx = iconButtonSx({
    pointerEvents: controlsHidden ? "none" : "all",
  });
  const barSx = (edge: "top" | "bottom"): SxProps<Theme> => ({
    position: "absolute",
    left: 0,
    right: 0,
    [edge]: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: edge === "bottom" ? "center" : undefined,
    gap: 0.5,
    px: 1,
    ...(edge === "top"
      ? { pt: 0.5, pb: 3 }
      : { pt: 3, pb: fullscreen ? 3 : 0.5 }),
    color: "common.white",
    background:
      edge === "top"
        ? "linear-gradient(rgba(0, 0, 0, 0.6), transparent)"
        : "linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
    pointerEvents: "none",
    "& > *": { pointerEvents: controlsHidden ? "none" : "auto" },
    opacity: controlsHidden ? 0 : 1,
    transform: controlsHidden
      ? `translateY(${edge === "top" ? "-50%" : "50%"})`
      : "none",
    visibility: controlsHidden ? "hidden" : "visible",
    transition: theme.transitions.create([
      "opacity",
      "transform",
      "visibility",
    ]),
  });
  const onTap = (clientX: number) => {
    const rect = (fullscreen ? viewer : root).current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = (clientX - rect.left) / rect.width;
    if (!hideLeftRightTaps && x < 0.25) return pastImage();
    if (!hideLeftRightTaps && x > 0.75) return nextImage();
    const now = Date.now();
    if (lastTap.current + DOUBLE_TAP_TIME > now) {
      lastTap.current = 0;
      togglePanning();
    } else {
      lastTap.current = now;
      setHideControls(!hideControls);
    }
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) {
      if (gesture.current) gesture.current.multiTouch = true;
      return;
    }
    const ignored =
      (event.pointerType === "mouse" && event.button !== 0) ||
      (event.target instanceof Element &&
        !!event.target.closest("button, [data-gallery-no-tap]"));
    gesture.current = ignored
      ? null
      : {
          x: event.clientX,
          y: event.clientY,
          time: Date.now(),
          multiTouch: false,
          transformKey: shown?.key,
          transform: shown ? cache.transforms[shown.key] : undefined,
        };
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!event.isPrimary || !start) return;
    gesture.current = null;
    if (start.multiTouch || hideWhenVideoInteractive) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const time = Date.now() - start.time;
    if (Math.hypot(dx, dy) <= TAP_MAX_MOVE && time <= TAP_MAX_TIME) {
      if (start.transformKey) {
        if (start.transform)
          cache.transforms[start.transformKey] = start.transform;
        else delete cache.transforms[start.transformKey];
      }
      onTap(event.clientX);
      return;
    }
    const isSwipe =
      !panning &&
      !hideLeftRightTaps &&
      time <= SWIPE_MAX_TIME &&
      Math.abs(dx) >= SWIPE_MIN_MOVE &&
      Math.abs(dx) > 2 * Math.abs(dy);
    if (!isSwipe) return;
    if (dx < 0) nextImage();
    else pastImage();
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)
      return;
    if (!event.currentTarget.contains(event.target as Node)) return;
    switch (event.code) {
      case "KeyF":
        toggleFullscreen();
        break;
      case "Escape":
        if (!openSettings) return;
        setOpenSettings(false);
        break;
      case "KeyL":
        if (!props.bookmarks) return;
        props.bookmarks.toggle(currentPage);
        break;
      case "ArrowLeft":
        pastImage();
        break;
      case "ArrowRight":
        nextImage();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Box
      ref={root}
      tabIndex={0}
      sx={{
        width: "100%",
        paddingTop: "56.25%",
        position: "relative",
      }}
      onKeyUp={onKeyUp}
    >
      {props.backgroundBloom && (
        <div
          style={{
            position: "absolute",
            inset: "-3% -5%",
            filter: "blur(150px)",
            opacity: 0.5,
            zIndex: -1,
          }}
        >
          <canvas
            ref={canvas}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
            }}
            width="110"
            height="75"
          ></canvas>
        </div>
      )}
      <Box
        ref={viewer}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        sx={
          fullscreen
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                background: "black",
              }
            : {
                display: "flex",
                top: 0,
                borderRadius: "16px",
                overflow: "hidden",
              }
        }
      >
        {displayedSrc ? (
          <ImageMovable
            key={shown?.key}
            defaultTransform={shown ? cache.transforms[shown.key] : undefined}
            onTransformChange={(transform) => {
              if (shown) cache.transforms[shown.key] = transform;
            }}
            refPropImage={image}
            refPropVideo={video}
            src={displayedSrc}
            onLoad={() => setReadySrc(displayedSrc)}
            onError={() => setFailedSrc(displayedSrc)}
            renderer={displayedIsVideo ? "video" : "image"}
            enableMovement={panning}
            styleRoot={{
              position: fullscreen ? "fixed" : "absolute",
              maxWidth: "100%",
              maxHeight: "100%",
              inset: 0,
              margin: "auto",
            }}
            styleImage={{
              borderRadius: fullscreen ? undefined : "16px",
              imageRendering: pixelated ? "pixelated" : undefined,
              objectFit: "contain",
              objectPosition: `${horizontal(align.x)} ${vertical(align.y)}`,
              height: "100%",
              width: "100%",
            }}
          />
        ) : (
          shown === null && (
            <Skeleton
              sx={{
                position: "absolute",
                inset: 0,
                borderRadius: fullscreen ? 0 : "16px",
              }}
              variant="rectangular"
              width="100%"
              height="100%"
            />
          )
        )}
        {loadFailed && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Typography color="text.secondary">
              Could not load this page.
            </Typography>
          </Box>
        )}
        <Box sx={barSx("top")}>
          <IconButton
            color="inherit"
            aria-label="Open file in a new tab"
            title="Open file in a new tab"
            sx={controlSx}
            onClick={() => {
              if (displayedSrc) window.open(displayedSrc, "_blank")?.focus();
            }}
          >
            <DownloadIcon />
          </IconButton>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              minWidth: 0,
            }}
          >
            {pageCount > 1 && (
              <Button
                color="inherit"
                aria-label="Go to page"
                title="Go to page"
                data-gallery-no-tap
                sx={{
                  fontVariantNumeric: "tabular-nums",
                  textTransform: "none",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
                }}
                onClick={() => {
                  setRequestForNewCurrentPage(`${Math.max(1, position)}`);
                  setRequestForNewCurrentPageReturnFullScreen(fullscreen);
                  exitFullscreen();
                }}
              >
                {`${position > 0 ? position : "–"} / ${total}${activeBookmarks ? " (Bookmarks)" : ""}`}
              </Button>
            )}
          </Box>
          <Box sx={{ width: 40 }} />
        </Box>
        <Box sx={barSx("bottom")}>
          {props.bookmarks && (
            <>
              {props.bookmarks.pages.length > 0 ? (
                <IconButton
                  aria-label="Show only bookmarks"
                  title="Show only bookmarks"
                  aria-pressed={bookmarkMode}
                  color={activeBookmarks ? "primary" : "inherit"}
                  sx={controlSx}
                  onClick={toggleBookmarkMode}
                >
                  <FolderSpecialIcon />
                </IconButton>
              ) : undefined}
              <IconButton
                color="inherit"
                aria-label="Bookmark this page (L)"
                title="Bookmark this page (L)"
                aria-pressed={props.bookmarks.pages.includes(currentPage)}
                sx={controlSx}
                onClick={() => props.bookmarks?.toggle(currentPage)}
              >
                {props.bookmarks.pages.includes(currentPage) ? (
                  <FavoriteIcon />
                ) : (
                  <FavoriteBorderIcon />
                )}
              </IconButton>
            </>
          )}
          {props.useTwoResolutions ? (
            <IconButton
              color="inherit"
              aria-label="High resolution"
              title="High resolution"
              aria-pressed={hd}
              sx={controlSx}
              onClick={() => setHD(!hd)}
            >
              {hd ? <HdIcon /> : <SdIcon />}
            </IconButton>
          ) : undefined}
          <IconButton
            color="inherit"
            aria-label="Pixelated scaling"
            title="Pixelated scaling"
            aria-pressed={pixelated}
            sx={controlSx}
            onClick={() => setPixelated(!pixelated)}
          >
            {pixelated ? <AppsIcon /> : <BlurOnIcon />}
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="Drag and zoom"
            title="Drag and zoom"
            aria-pressed={panning}
            sx={controlSx}
            onClick={togglePanning}
          >
            {panning ? <CloseIcon /> : <ControlCameraIcon />}
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="Settings"
            title="Settings"
            aria-expanded={openSettings}
            sx={controlSx}
            onClick={() => setOpenSettings(!openSettings)}
          >
            <SettingsIcon />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            aria-pressed={fullscreen}
            sx={controlSx}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Box>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            width: "50%",
            margin: "auto",
            display: fullscreen ? "none" : undefined,
            [theme.breakpoints.up("sm")]: {
              display: "none",
            },
          }}
          data-gallery-no-tap
          onClick={() => {
            if (fullscreen) return;
            enterFullscreen();
            setDoNotExitFullscreen(true);
            if (pageCount === 1) setPanning(true);
            setHideControls(false);
          }}
        ></Box>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            color: theme.palette.text.primary,
            margin: "auto",
            padding: 0,
            display: "flex",
            opacity:
              !hideControls && isVideo
                ? hideWhenVideoInteractive
                  ? 0.3
                  : 1
                : 0,
            pointerEvents: "none",
            justifyContent: hideWhenVideoInteractive ? "end" : "center",
            alignItems: hideWhenVideoInteractive ? "start" : "center",
            transition: theme.transitions.create(["opacity"]),
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              pointerEvents: hideControls || !isVideo ? "none" : "all",
              gap: theme.spacing(1),
            }}
          >
            <IconButton
              aria-label={
                hideWhenVideoInteractive ? "Stop video" : "Play video"
              }
              sx={iconButtonSx({
                padding: "16px",
                color: "common.white",
                background: "rgba(0, 0, 0, 0.6)",
                "&:hover": { background: "rgba(0, 0, 0, 0.75)" },
              })}
              onClick={() => {
                if (hideWhenVideoInteractive) {
                  setPanning(false);
                  video.current?.pause();
                } else {
                  setPanning(true);
                  video.current?.play().catch(console.error);
                }
              }}
            >
              {hideWhenVideoInteractive ? (
                <CloseIcon />
              ) : (
                <PlayCircleIcon style={{ fontSize: "32px" }} />
              )}
            </IconButton>
          </Box>
        </Box>
        <SettingsPanel
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          zIndex={1100}
        >
          <Section title="Layout">
            <Typography variant="caption" color="text.secondary">
              Image alignment
            </Typography>
            <AlignmentPicker
              align={align}
              setAlign={setAlign}
              label="Image alignment"
            />
          </Section>
          <Section title="Loading">
            <Typography variant="caption" color="text.secondary">
              {`Preload ${preloadRange} ${preloadRange === 1 ? "page" : "pages"} each way`}
            </Typography>
            <Slider
              aria-label="Preload pages"
              size="small"
              value={preloadRange}
              onChange={(_event, value) => setPreloadRange(value as number)}
              valueLabelDisplay="auto"
              step={1}
              marks
              min={0}
              max={20}
            />
          </Section>
        </SettingsPanel>
      </Box>
      <PageChangeDrawer
        starterValue={requestForNewCurrentPage}
        min={1}
        max={total}
        onConclusion={(newPosition) => {
          if (newPosition !== null)
            setCurrentPage(
              activeBookmarks
                ? (activeBookmarks[newPosition - 1] ?? currentPage)
                : newPosition - 1,
            );
          setRequestForNewCurrentPage(null);
          if (requestForNewCurrentPageReturnFullScreen) enterFullscreen();
        }}
      />
    </Box>
  );
}
