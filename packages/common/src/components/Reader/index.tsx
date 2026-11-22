import type {
  ExtensionResolver,
  GalleryCacheOptions,
} from "@arclockproject/common/components/GalleryBrowser";
import PageChangeDrawer from "@arclockproject/common/components/GalleryBrowser/PageChangeDrawer";
import {
  AlignmentPicker,
  horizontal,
  parseAlignment,
  Section,
  SettingsPanel,
  vertical,
} from "@arclockproject/common/components/GalleryBrowser/Settings";
import Movable, {
  type MovableTransform,
} from "@arclockproject/common/components/Movable";
import Extension from "@arclockproject/common/library/Extension";
import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Slider,
  Stack,
  Switch,
  type SxProps,
  styled,
  type Theme,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

const TAP_MAX_MOVE = 8;
const TAP_MAX_TIME = 300;
const DOUBLE_TAP_TIME = 300;
const LONG_PRESS_TIME = 500;

/**
 * One page of a `Reader`. Add your own fields as needed. The whole item is
 * passed to `data.urlResolver`.
 */
export type ReaderItem = {
  /**
   * URL of the image. Without a `data.urlResolver` it is used as is, so it must
   * be a full URL. With one, it is up to the resolver what it means.
   */
  url?: string;
};

/**
 * How pages are laid out.
 */
export type ReaderViewType = "double" | "single" | "scroll";

/**
 * Where pages sit when they don't fill the reader.
 */
export type ReaderAlignment = {
  /** `1` left, `0` center, `-1` right. */
  x: number;
  /** `1` top, `0` center, `-1` bottom. */
  y: number;
};

class Cache {
  data: { [key: string]: Promise<string | null> } = {};
  urls: { [key: string]: string | null } = {};
  ratios: { [key: string]: number } = {};
  transforms: { [key: string]: MovableTransform } = {};
  moved = new Set<string>();
  warmed = new Set<string>();
  constructor(public options: GalleryCacheOptions) {}
  onIDChange = () => {
    if (!this.options.clearOnIDChange) return;
    this.data = {};
    this.urls = {};
    this.ratios = {};
    this.transforms = {};
    this.moved.clear();
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

const parseViewType = (value: unknown): ReaderViewType | undefined =>
  value === "double" || value === "single" || value === "scroll"
    ? value
    : undefined;
const parsePageGap = (value: unknown): number | undefined =>
  typeof value === "number" && value >= 0 && value <= 64 ? value : undefined;
const parseSidePadding = (value: unknown): number | undefined =>
  typeof value === "number" && value >= 0 && value <= 80 ? value : undefined;

const FadeLeft = styled("div")({
  position: "absolute",
  top: 0,
  right: 0,
  width: "50px",
  background: "linear-gradient(90deg, #0000, #00000080)",
  height: "100%",
  pointerEvents: "none",
});
const FadeRight = styled("div")({
  position: "absolute",
  top: 0,
  left: 0,
  width: "50px",
  background: "linear-gradient(-90deg, #0000, #00000080)",
  height: "100%",
  pointerEvents: "none",
});

const barSx =
  (visible: boolean, edge: "top" | "bottom"): SxProps<Theme> =>
  (theme) => ({
    position: "absolute",
    left: 0,
    right: 0,
    [edge]: 0,
    zIndex: 110,
    px: 1,
    ...(edge === "top" ? { pt: 0.5, pb: 3 } : { pt: 3, pb: 0.5 }),
    color: "common.white",
    background:
      edge === "top"
        ? "linear-gradient(rgba(0, 0, 0, 0.6), transparent)"
        : "linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
    pointerEvents: "none",
    "& > *": { pointerEvents: "auto" },
    opacity: visible ? 1 : 0,
    transform: visible
      ? "none"
      : `translateY(${edge === "top" ? "-50%" : "50%"})`,
    visibility: visible ? "visible" : "hidden",
    transition: theme.transitions.create([
      "opacity",
      "transform",
      "visibility",
    ]),
  });

const pageButtonSx: SxProps<Theme> = {
  color: "common.white",
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  "&:hover": { background: "rgba(0, 0, 0, 0.75)" },
};

const ReaderPage = memo(
  (props: {
    pageKey: string;
    resolve: () => Promise<string | null>;
    sx?: SxProps<Theme>;
    imageStyle?: React.CSSProperties;
    /**
     * Turns on drag and zoom inside the page's box, with a button to reset them.
     * Turning it off keeps the position and zoom, but locks them.
     */
    zoomed?: boolean;
    children?: React.ReactNode;
    /** URL from an earlier mount, so the image renders on the first frame. */
    knownUrl?: string | null;
    /** Width / height from an earlier load, so the page has its height before the image loads. */
    knownRatio?: number;
    /** Called with width / height once the image loads. */
    onRatio?: (ratio: number) => void;
    /** Keeps the position, zoom and lock across remounts. */
    cache: Cache;
    /** Whether the page is bookmarked. `undefined` hides the bookmark badge and button. */
    bookmarked?: boolean;
    onToggleBookmark?: () => void;
    /** Shows the page's buttons. */
    showActions?: boolean;
    /** Where the page's buttons sit: bottom center, or vertically centered on that side. */
    actionsPlacement?: "bottom" | "left" | "right";
  }) => {
    const [shown, setShown] = useState<{
      key: string;
      url: string | null;
    } | null>(() =>
      props.knownUrl !== undefined
        ? { key: props.pageKey, url: props.knownUrl }
        : null,
    );
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const [resets, setResets] = useState(0);
    if (props.zoomed) props.cache.moved.add(props.pageKey);
    const moved = props.cache.moved.has(props.pageKey);
    const locked = moved && !props.zoomed;
    const block = (event: React.SyntheticEvent) => {
      if (locked) event.stopPropagation();
    };
    useEffect(() => {
      let cancelled = false;
      const key = props.pageKey;
      props.resolve().then((url) => {
        if (!cancelled) setShown({ key, url });
      });
      return () => {
        cancelled = true;
      };
    }, [props.pageKey]);
    const src = shown?.key === props.pageKey ? shown.url : undefined;
    const displayedSrc = shown?.url ?? null;
    const loadFailed = src === null || (!!src && failedSrc === src);
    const center: SxProps<Theme> = {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    };
    return (
      <Box
        data-reader-page={props.pageKey}
        sx={[
          ...(Array.isArray(props.sx) ? props.sx : [props.sx]),
          !!props.zoomed && {
            cursor: "grab",
            touchAction: "none",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              border: 2,
              borderColor: "primary.main",
              pointerEvents: "none",
              zIndex: 1,
            },
          },
        ]}
        style={
          props.knownRatio
            ? { aspectRatio: String(props.knownRatio), minHeight: 0 }
            : undefined
        }
      >
        {displayedSrc && (
          <div
            style={{ width: "100%", height: "100%" }}
            onMouseDownCapture={block}
            onTouchStartCapture={block}
            onWheelCapture={block}
          >
            <Movable
              key={`${props.pageKey}:${resets}`}
              enableMovement={moved}
              enableZoom={moved}
              defaultTransform={props.cache.transforms[props.pageKey]}
              onTransformChange={(transform) => {
                props.cache.transforms[props.pageKey] = transform;
              }}
            >
              <img
                alt=""
                src={displayedSrc}
                style={props.imageStyle}
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight)
                    props.onRatio?.(naturalWidth / naturalHeight);
                }}
                onError={() => setFailedSrc(displayedSrc)}
              />
            </Movable>
          </div>
        )}
        {props.bookmarked && (
          <BookmarkIcon
            aria-label="Bookmarked"
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 2,
              fontSize: 20,
              color: "primary.main",
              filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
              pointerEvents: "none",
            }}
          />
        )}
        {props.showActions && props.bookmarked !== undefined && (
          <Stack
            data-reader-no-tap
            direction={props.actionsPlacement === "bottom" ? "row" : "column"}
            gap={1}
            sx={{
              position: "absolute",
              zIndex: 2,
              ...(props.actionsPlacement === "bottom"
                ? { bottom: 12, left: "50%", transform: "translateX(-50%)" }
                : {
                    [props.actionsPlacement ?? "right"]: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }),
            }}
          >
            <IconButton
              aria-label={
                props.bookmarked
                  ? "Remove bookmark (L)"
                  : "Bookmark this page (L)"
              }
              title={
                props.bookmarked
                  ? "Remove bookmark (L)"
                  : "Bookmark this page (L)"
              }
              aria-pressed={props.bookmarked}
              onClick={props.onToggleBookmark}
              sx={pageButtonSx}
            >
              {props.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
          </Stack>
        )}
        {props.zoomed && (
          <IconButton
            size="small"
            aria-label="Reset position and zoom"
            title="Reset position and zoom"
            data-reader-no-tap
            onClick={() => {
              delete props.cache.transforms[props.pageKey];
              setResets((count) => count + 1);
            }}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
              color: "common.white",
              background: "rgba(0, 0, 0, 0.6)",
              "&:hover": { background: "rgba(0, 0, 0, 0.75)" },
            }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        )}
        {shown === null && (
          <Box sx={center}>
            <CircularProgress size={32} color="inherit" sx={{ opacity: 0.5 }} />
          </Box>
        )}
        {loadFailed && (
          <Box sx={center}>
            <Typography color="text.secondary">
              Could not load this page.
            </Typography>
          </Box>
        )}
        {props.children}
      </Box>
    );
  },
);
ReaderPage.displayName = "ReaderPage";

/**
 * A book reader with single page, double page and scroll views.
 *
 * Tap or click the left or right side to turn the page, and the middle to show
 * the top and bottom bars. Double-tap a page to zoom it, and long-press it (or
 * right-click with a mouse) for its buttons. With focus on the reader, the arrow
 * keys turn the page, `F` toggles fullscreen, `L` toggles the bookmark of the
 * current page, and `Escape` closes the settings or the zoomed page. The view,
 * reading direction, alignment and preload range can be changed in the settings.
 *
 * @see {@link https://arclockproject.org/docs/common/components/Reader Guide} | {@link https://arclockproject.org/docs/api/common/components/Reader API}
 * @example
 * <Reader id="book-1" data={{ items: [{ url: "/book-1/1.webp" }, { url: "/book-1/2.webp" }] }} cache={{ range: 2, clearOnIDChange: true }} />
 */
export function Reader<itemData extends ReaderItem = ReaderItem>(props: {
  /**
   * Unique ID of the book. Changing it goes to `page`, or `defaultPage`, or the
   * first page. Change it whenever `data.items` changes, because URLs are cached
   * per `id`.
   */
  id: string;
  /**
   * The pages, and how to turn each one into an image URL.
   */
  data: {
    /**
     * The pages. Pass a number to have that many pages with no data, and build
     * their URLs in `urlResolver` from the index.
     */
    items: itemData[] | number;
    /**
     * Turns a page into a URL. Leave it out when every item has a full `url`.
     * Needed when `items` is a number. If it throws, the page shows an error
     * and is tried again next time it is shown.
     *
     * @param data The item, or `undefined` when `items` is a number.
     * @param index Index of the page, from `0`.
     * @param extensionResolver Finds the extension of a URL that has none.
     * @returns The URL, or `null` if the page has no file.
     */
    urlResolver?: (
      data: itemData | undefined,
      index: number,
      extensionResolver: ExtensionResolver,
    ) => Promise<string | null>;
  };
  /**
   * Current page index, from `0`. When it changes, the reader goes to it.
   */
  page?: number;
  /**
   * Page index to start on when `page` is not set.
   * @default 0
   */
  defaultPage?: number;
  /**
   * Called when the reader moves to another page.
   * @param page Index of the new page, from `0`.
   */
  onPageChange?: (page: number) => void;
  /**
   * Called by the back button. The button is only shown when this is set.
   */
  onBack?: () => void;
  /**
   * Title shown in the top bar.
   */
  title?: string;
  /**
   * Bookmarked pages. Adds a bookmark button to each page's buttons, a badge on
   * bookmarked pages, and a button in the top bar to page through only the
   * bookmarks. Bookmark mode is off at the start, and turns off when the last
   * bookmark is removed.
   */
  bookmarks?: {
    /**
     * Bookmarked page indexes, from `0`. Bookmark mode pages through them in
     * page order, whatever order they are in here.
     */
    pages: number[];
    /**
     * Called by a page's bookmark button and the `L` key. Add or remove `page`
     * from `pages`.
     * @param page Index of the page, from `0`. For the `L` key in double view,
     *   the first page of the spread.
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
   * Cache settings. `range` is the starting value of the preload setting.
   */
  cache: GalleryCacheOptions;
  /**
   * Style overrides for parts of the reader.
   */
  style?: {
    /**
     * The outer box.
     */
    root?: {
      /**
       * Applied after the built-in styles. The reader is `100vh` tall by default.
       */
      sx?: SxProps<Theme>;
    };
    /**
     * Every icon button in the top and bottom bars.
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
  const items = props.data.items;
  const pageCount = typeof items === "number" ? items : items.length;
  const lastPage = Math.max(0, pageCount - 1);
  const startPage = () =>
    Math.min(lastPage, Math.max(0, props.page ?? props.defaultPage ?? 0));

  const root = useRef<HTMLDivElement>(null);
  const virtuoso = useRef<VirtuosoHandle>(null);
  const cache = useCache(props.cache);

  const [uiVisibility, setUIVisibility] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [zoomedPage, setZoomedPage] = useState<string | null>(null);
  const [actionsPage, setActionsPage] = useState<string | null>(null);
  const [bookmarkMode, setBookmarkModeState] = useState(false);
  const longPressTimer = useRef(0);
  const longPressed = useRef(false);
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const lastTap = useRef<{ time: number; page: string | null }>({
    time: 0,
    page: null,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [preloadNumber, setPreloadNumber] = useState(props.cache.range);
  const [showPageShadow, setShowPageShadow] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [modeLeftToRight, setModeLeftToRight] = useState(true);
  const [requestForNewCurrentPage, setRequestForNewCurrentPage] = useState<
    string | null
  >(null);
  const [returnToFullscreen, setReturnToFullscreen] = useState(false);

  const [sidePadding, setSidePadding] = useLocalStorageState(
    "reader.sidePadding",
    0,
    parseSidePadding,
  );
  const [pageGap, setPageGap] = useLocalStorageState(
    "reader.pageGap",
    0,
    parsePageGap,
  );
  const [align, setAlign] = useLocalStorageState<ReaderAlignment>(
    "reader.align",
    { x: 0, y: 0 },
    parseAlignment,
  );
  const [readerViewType, setReaderViewType] =
    useLocalStorageState<ReaderViewType>(
      "reader.readerViewType",
      "single",
      parseViewType,
    );
  const isDouble = readerViewType === "double";
  const isScroll = readerViewType === "scroll";

  const resolveUrl = (page: number): Promise<string | null> => {
    const key = `${props.id}:${page}`;
    const cached = cache.data[key];
    if (cached) return cached;
    const item = typeof items === "number" ? undefined : items[page];
    const resolver = props.data.urlResolver;
    const promise = resolver
      ? resolver(item, page, Extension.resolve).catch((error) => {
          console.error(error);
          delete cache.data[key];
          return null;
        })
      : Promise.resolve(item?.url ?? null);
    const stored = promise.then((url) => {
      if (cache.data[key] === stored) cache.urls[key] = url;
      return url;
    });
    cache.data[key] = stored;
    return stored;
  };
  const resolveRef = useRef(resolveUrl);
  resolveRef.current = resolveUrl;
  const resolveStable = useCallback(
    (page: number) => resolveRef.current(page),
    [],
  );

  const stabilizePageNumber = (page: number, force = false) => {
    if (!isDouble && !force) return page;
    return page % 2 === 1 ? page - 1 : page;
  };
  const goTo = (page: number) => {
    const target = Math.min(lastPage, Math.max(0, page));
    if (isScroll) {
      virtuoso.current?.scrollToIndex({
        index: target,
        align: "center",
        behavior: "auto",
      });
      setCurrentPage(target);
    } else {
      setCurrentPage(stabilizePageNumber(target));
    }
  };
  const step = isDouble ? 2 : 1;
  const bookmarkKey = props.bookmarks?.pages.join(",") ?? "";
  const sortedBookmarks = useMemo(
    () =>
      [...new Set(props.bookmarks?.pages ?? [])]
        .filter((page) => page >= 0 && page <= lastPage)
        .sort((a, b) => a - b),
    [bookmarkKey, lastPage],
  );
  const bookmarkSet = useMemo(
    () => new Set(sortedBookmarks),
    [sortedBookmarks],
  );
  const activeBookmarks =
    bookmarkMode && sortedBookmarks.length > 0 ? sortedBookmarks : null;
  const lastShown = isDouble ? currentPage + 1 : currentPage;
  const previousBookmark = activeBookmarks?.findLast(
    (page) => page < currentPage,
  );
  const nextBookmark = activeBookmarks?.find((page) => page > lastShown);
  const setBookmarkMode = (on: boolean) => {
    setBookmarkModeState(on);
    props.bookmarks?.onModeChange?.(on);
  };
  const toggleBookmarkMode = () => {
    const on = !bookmarkMode;
    setBookmarkMode(on);
    if (!on || sortedBookmarks.length === 0) return;
    if (
      sortedBookmarks.some((page) => page >= currentPage && page <= lastShown)
    )
      return;
    const closest = sortedBookmarks.reduce((best, page) =>
      Math.abs(page - currentPage) < Math.abs(best - currentPage) ? page : best,
    );
    goTo(closest);
  };
  const previousPage = () => {
    if (activeBookmarks) {
      if (previousBookmark !== undefined) goTo(previousBookmark);
      return;
    }
    goTo(currentPage - step);
  };
  const nextPage = () => {
    if (activeBookmarks) {
      if (nextBookmark !== undefined) goTo(nextBookmark);
      return;
    }
    if (
      currentPage + step > lastPage &&
      stabilizePageNumber(lastPage) === currentPage
    )
      return;
    goTo(currentPage + step);
  };
  const leftPage = modeLeftToRight ? previousPage : nextPage;
  const rightPage = modeLeftToRight ? nextPage : previousPage;

  const enterFullscreen = () => {
    root.current?.requestFullscreen?.().catch(console.error);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement)
      document.exitFullscreen().catch(console.error);
    else enterFullscreen();
  };
  const openPageDialog = () => {
    setRequestForNewCurrentPage(
      `${activeBookmarks ? Math.max(1, bookmarkPosition) : currentPage + 1}`,
    );
    setReturnToFullscreen(!!document.fullscreenElement);
    if (document.fullscreenElement)
      document.exitFullscreen().catch(console.error);
  };

  useEffect(() => {
    const onChange = () =>
      setFullscreen(
        !!root.current && document.fullscreenElement === root.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const reported = useRef(currentPage);
  useEffect(() => {
    if (reported.current === currentPage) return;
    reported.current = currentPage;
    props.onPageChange?.(currentPage);
  }, [currentPage]);
  useEffect(() => {
    if (props.page === undefined || props.page === currentPage) return;
    reported.current = props.page;
    goTo(props.page);
  }, [props.page]);
  useEffect(() => {
    if (bookmarkMode && sortedBookmarks.length === 0) setBookmarkMode(false);
  }, [bookmarkMode, sortedBookmarks.length]);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    cache.onIDChange();
    goTo(startPage());
  }, [props.id]);
  useEffect(() => {
    if (isScroll) return;
    const pages = new Set<number>();
    if (isDouble) pages.add(currentPage + 1);
    for (let offset = 1; offset <= preloadNumber * step; offset++) {
      pages.add(currentPage + offset);
      if (isDouble) pages.add(currentPage + offset + 1);
      pages.add(currentPage - offset);
    }
    for (const page of pages) {
      if (page < 0 || page > lastPage) continue;
      resolveUrl(page).then((url) => {
        if (url) cache.warm(url);
      });
    }
  }, [props.id, currentPage, preloadNumber, readerViewType, lastPage]);

  const iconButtonSx = (base?: SxProps<Theme>): SxProps<Theme> => {
    const custom = props.style?.IconButton?.sx;
    return [
      ...(Array.isArray(base) ? base : [base]),
      ...(Array.isArray(custom) ? custom : [custom]),
    ];
  };
  const barButton = (
    label: string,
    onClick: () => void,
    icon: JSX.Element,
    disabled = false,
  ) => (
    <IconButton
      color="inherit"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      sx={iconButtonSx({
        "&.Mui-disabled": { color: "rgba(255, 255, 255, 0.3)" },
      })}
    >
      {icon}
    </IconButton>
  );
  const rootSx = props.style?.root?.sx;

  const hasNext = currentPage < lastPage;
  const bookmarkPosition = activeBookmarks
    ? activeBookmarks.findIndex(
        (page) => page >= currentPage && page <= lastShown,
      ) + 1
    : 0;
  const pageLabel = activeBookmarks
    ? `${bookmarkPosition > 0 ? bookmarkPosition : "–"} / ${activeBookmarks.length} (Bookmarks)`
    : isDouble && hasNext
      ? `${currentPage + 1}–${currentPage + 2} / ${pageCount}`
      : `${currentPage + 1} / ${pageCount}`;
  const atStart = activeBookmarks
    ? previousBookmark === undefined
    : currentPage === 0;
  const atEnd = activeBookmarks
    ? nextBookmark === undefined
    : currentPage + step > lastPage;
  const pageProps = (page: number, spine?: "left" | "right") => ({
    bookmarked: props.bookmarks ? bookmarkSet.has(page) : undefined,
    onToggleBookmark: () => props.bookmarks?.toggle(page),
    showActions: actionsPage === pageKey(page),
    actionsPlacement: isScroll
      ? ("bottom" as const)
      : (spine ?? ("right" as const)),
  });
  const sliderValue = modeLeftToRight
    ? currentPage + 1
    : pageCount - currentPage;
  const pageKey = (page: number) => `${props.id}:${page}`;
  const halfSx = (spine: "left" | "right"): SxProps<Theme> => ({
    flex: 1,
    minWidth: 0,
    height: "100%",
    position: "relative",
    "& img": {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "contain",
      objectPosition: `${spine} ${vertical(align.y)}`,
    },
  });
  const mainPage = (spine: "left" | "right") => (
    <ReaderPage
      pageKey={pageKey(currentPage)}
      resolve={() => resolveUrl(currentPage)}
      cache={cache}
      sx={halfSx(spine)}
      zoomed={zoomedPage === pageKey(currentPage)}
      {...pageProps(currentPage, spine)}
    >
      {showPageShadow && (spine === "right" ? <FadeLeft /> : <FadeRight />)}
    </ReaderPage>
  );
  const nextPageView = (spine: "left" | "right") =>
    hasNext ? (
      <ReaderPage
        pageKey={pageKey(currentPage + 1)}
        resolve={() => resolveUrl(currentPage + 1)}
        cache={cache}
        sx={halfSx(spine)}
        zoomed={zoomedPage === pageKey(currentPage + 1)}
        {...pageProps(currentPage + 1, spine)}
      >
        {showPageShadow && (spine === "right" ? <FadeLeft /> : <FadeRight />)}
      </ReaderPage>
    ) : (
      <Box sx={{ flex: 1 }} />
    );
  const findUnder = (x: number, y: number) => {
    let zone: string | undefined;
    let page: string | undefined;
    for (const element of document.elementsFromPoint(x, y)) {
      if (!(element instanceof HTMLElement) || !root.current?.contains(element))
        continue;
      zone ??= element.dataset.readerZone;
      page ??= element.dataset.readerPage;
    }
    return { zone, page };
  };
  const isPageTarget = (target: EventTarget) =>
    target instanceof Element &&
    !!root.current?.contains(target) &&
    !target.closest("[data-reader-no-tap]");
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const ignored =
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      !isPageTarget(event.target);
    pointerStart.current = ignored
      ? null
      : { x: event.clientX, y: event.clientY, time: Date.now() };
    window.clearTimeout(longPressTimer.current);
    longPressed.current = false;
    if (ignored || event.pointerType === "mouse") return;
    longPressTimer.current = window.setTimeout(() => {
      const start = pointerStart.current;
      if (!start) return;
      const { page } = findUnder(start.x, start.y);
      if (!page) return;
      longPressed.current = true;
      setActionsPage((open) => (open === page ? null : page));
    }, LONG_PRESS_TIME);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!event.isPrimary || !start) return;
    if (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
      TAP_MAX_MOVE
    )
      window.clearTimeout(longPressTimer.current);
  };
  const onPointerCancel = () => {
    pointerStart.current = null;
    window.clearTimeout(longPressTimer.current);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    window.clearTimeout(longPressTimer.current);
    if (longPressed.current) {
      longPressed.current = false;
      lastTap.current = { time: 0, page: null };
      return;
    }
    if (!event.isPrimary || !start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > TAP_MAX_MOVE || Date.now() - start.time > TAP_MAX_TIME) return;
    const under = findUnder(event.clientX, event.clientY);
    const { page } = under;
    let zone = under.zone;
    if (isScroll && zone === undefined) {
      const rect = root.current?.getBoundingClientRect();
      const x =
        rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
      zone = x < 0.2 ? "left" : x > 0.8 ? "right" : "middle";
    }
    const now = Date.now();
    const isDoubleTap =
      event.pointerType !== "mouse" &&
      !!page &&
      lastTap.current.page === page &&
      now - lastTap.current.time < DOUBLE_TAP_TIME;
    if (isDoubleTap && page) {
      lastTap.current = { time: 0, page: null };
      if (zoomedPage === null) setUIVisibility((visible) => !visible);
      setZoomedPage(zoomedPage === page ? null : page);
      return;
    }
    lastTap.current = { time: now, page: page ?? null };
    const isMouse = event.pointerType === "mouse";
    if (zoomedPage !== null) {
      if (isMouse && page)
        setActionsPage((open) => (open === page ? null : page));
      return;
    }
    if (zone === "left") leftPage();
    else if (zone === "right") rightPage();
    else {
      const showing = !uiVisibility;
      setUIVisibility(showing);
      setActionsPage(isMouse && showing ? (page ?? null) : null);
    }
  };
  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.nativeEvent as PointerEvent).pointerType === "touch") {
      if (isPageTarget(event.target)) event.preventDefault();
      return;
    }
    if (!isPageTarget(event.target)) return;
    const { page } = findUnder(event.clientX, event.clientY);
    if (!page) return;
    event.preventDefault();
    setZoomedPage(zoomedPage === page ? null : page);
  };
  const tapZone = (side: "left" | "right") => (
    <Box
      data-reader-zone={side}
      sx={(theme) => ({
        pointerEvents: zoomedPage === null ? undefined : "none",
        position: "absolute",
        top: 0,
        [side]: 0,
        height: "100%",
        width: "20%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "common.white",
        "& > svg": {
          fontSize: 48,
          opacity: uiVisibility ? 0.5 : 0,
          filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8))",
          transition: theme.transitions.create("opacity"),
        },
        "&:hover > svg": { opacity: uiVisibility ? 0.8 : 0.3 },
      })}
    >
      {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </Box>
  );

  return (
    <Box
      ref={root}
      tabIndex={0}
      sx={[
        (theme) => ({
          position: "relative",
          width: "100%",
          height: "100vh",
          overflow: "hidden",
          overscrollBehavior: "contain",
          userSelect: "none",
          WebkitTouchCallout: "none",
          outline: "none",
          background: theme.palette.background.default,
        }),
        ...(Array.isArray(rootSx) ? rootSx : [rootSx]),
      ]}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)
          return;
        if (
          !["ArrowLeft", "ArrowRight", "KeyF", "KeyL", "Escape"].includes(
            event.code,
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyUp={(event) => {
        if (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)
          return;
        switch (event.code) {
          case "KeyF":
            toggleFullscreen();
            break;
          case "KeyL":
            if (!props.bookmarks) return;
            props.bookmarks.toggle(currentPage);
            break;
          case "Escape":
            if (openSettings) setOpenSettings(false);
            else if (zoomedPage !== null) setZoomedPage(null);
            else return;
            break;
          case "ArrowLeft":
            leftPage();
            break;
          case "ArrowRight":
            rightPage();
            break;
          default:
            return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
    >
      {isScroll ? (
        <ScrollPageContainer
          id={props.id}
          count={pageCount}
          startPage={currentPage}
          resolve={resolveStable}
          cache={cache}
          virtuoso={virtuoso}
          preloadNumber={preloadNumber}
          sidePadding={sidePadding}
          pageGap={pageGap}
          alignX={align.x}
          showPageNumbers={showPageNumbers}
          onCenterPageChange={setCurrentPage}
          zoomedPage={zoomedPage}
          pageProps={pageProps}
        />
      ) : (
        <>
          {isDouble ? (
            <Box sx={{ display: "flex", flexDirection: "row", height: "100%" }}>
              {modeLeftToRight ? mainPage("right") : nextPageView("right")}
              {modeLeftToRight ? nextPageView("left") : mainPage("left")}
            </Box>
          ) : (
            <ReaderPage
              pageKey={pageKey(currentPage)}
              resolve={() => resolveUrl(currentPage)}
              cache={cache}
              sx={{ position: "relative", height: "100%" }}
              zoomed={zoomedPage === pageKey(currentPage)}
              {...pageProps(currentPage)}
              imageStyle={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: `${horizontal(align.x)} ${vertical(align.y)}`,
                display: "block",
              }}
            />
          )}
          <Box
            data-reader-zone="middle"
            sx={{
              position: "absolute",
              top: 0,
              left: "20%",
              width: "60%",
              height: "100%",
              pointerEvents: zoomedPage === null ? undefined : "none",
            }}
          />
          {tapZone("left")}
          {tapZone("right")}
        </>
      )}

      <Box data-reader-no-tap sx={barSx(uiVisibility, "top")}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {props.onBack && barButton("Back", props.onBack, <ArrowBackIcon />)}
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              px: 1,
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
            }}
          >
            {props.title}
          </Typography>
          {sortedBookmarks.length > 0 && (
            <IconButton
              color={activeBookmarks ? "primary" : "inherit"}
              aria-label="Show only bookmarks"
              title="Show only bookmarks"
              aria-pressed={!!activeBookmarks}
              onClick={toggleBookmarkMode}
              sx={iconButtonSx()}
            >
              <CollectionsBookmarkIcon />
            </IconButton>
          )}
          {barButton(
            "Settings",
            () => setOpenSettings(!openSettings),
            <SettingsIcon />,
          )}
          {barButton(
            fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)",
            toggleFullscreen,
            fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
          )}
        </Stack>
      </Box>

      <Box data-reader-no-tap sx={barSx(uiVisibility, "bottom")}>
        {pageCount > 1 && (
          <Slider
            aria-label="Page"
            size="small"
            min={1}
            max={pageCount}
            step={1}
            value={sliderValue}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) =>
              modeLeftToRight ? value : pageCount + 1 - value
            }
            onChange={(_event, value) => {
              const page = modeLeftToRight
                ? (value as number) - 1
                : pageCount - (value as number);
              goTo(page);
            }}
            sx={{
              display: "block",
              py: 1,
              mx: 1,
              width: "auto",
              color: "common.white",
            }}
          />
        )}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={1}
        >
          {barButton(
            modeLeftToRight ? "Previous page" : "Next page",
            leftPage,
            <ChevronLeftIcon />,
            modeLeftToRight ? atStart : atEnd,
          )}
          <Button
            color="inherit"
            aria-label="Go to page"
            title="Go to page"
            onClick={openPageDialog}
            sx={{
              minWidth: 96,
              fontVariantNumeric: "tabular-nums",
              textTransform: "none",
            }}
          >
            {pageLabel}
          </Button>
          {barButton(
            modeLeftToRight ? "Next page" : "Previous page",
            rightPage,
            <ChevronRightIcon />,
            modeLeftToRight ? atEnd : atStart,
          )}
        </Stack>
      </Box>

      {!isScroll && (
        <Typography
          variant="caption"
          data-reader-no-tap
          onClick={openPageDialog}
          sx={(theme) => ({
            position: "absolute",
            bottom: theme.spacing(1),
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            px: 1.5,
            py: 0.25,
            borderRadius: "16px",
            cursor: "pointer",
            color: "common.white",
            background: "rgba(0, 0, 0, 0.6)",
            fontVariantNumeric: "tabular-nums",
            opacity: showPageNumbers && !uiVisibility ? 1 : 0,
            visibility: showPageNumbers && !uiVisibility ? "visible" : "hidden",
            transition: theme.transitions.create(["opacity", "visibility"]),
          })}
        >
          {pageLabel}
        </Typography>
      )}

      <SettingsPanel
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        zIndex={120}
      >
        <Section title="Reading">
          <Typography variant="caption" color="text.secondary">
            Direction
          </Typography>
          <ToggleButtonGroup
            size="small"
            fullWidth
            color="primary"
            value={modeLeftToRight ? "left" : "right"}
            exclusive
            onChange={(_event, value) => {
              if (value !== null) setModeLeftToRight(value === "left");
            }}
          >
            <ToggleButton value="left">Left to right</ToggleButton>
            <ToggleButton value="right">Right to left</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">
            View
          </Typography>
          <ToggleButtonGroup
            size="small"
            fullWidth
            color="primary"
            value={readerViewType}
            exclusive
            onChange={(_event, value: ReaderViewType | null) => {
              if (value === null) return;
              if (value === "double")
                setCurrentPage(stabilizePageNumber(currentPage, true));
              setReaderViewType(value);
            }}
          >
            <ToggleButton value="single" sx={{ gap: 0.5 }}>
              <ArticleIcon fontSize="small" />
              Single
            </ToggleButton>
            <ToggleButton value="double" sx={{ gap: 0.5 }}>
              <AutoStoriesIcon fontSize="small" />
              Double
            </ToggleButton>
            <ToggleButton value="scroll" sx={{ gap: 0.5 }}>
              <ViewDayIcon fontSize="small" />
              Scroll
            </ToggleButton>
          </ToggleButtonGroup>
        </Section>
        <Section title="Layout">
          <Typography variant="caption" color="text.secondary">
            Page alignment
          </Typography>
          <AlignmentPicker
            align={align}
            setAlign={setAlign}
            label="Page alignment"
          />
          <Typography variant="caption" color="text.secondary">
            {`Side padding in scroll view: ${sidePadding / 2}% each side`}
          </Typography>
          <Slider
            aria-label="Side padding"
            size="small"
            value={sidePadding}
            onChange={(_event, value) => setSidePadding(value as number)}
            disabled={!isScroll}
            step={4}
            marks
            min={0}
            max={80}
          />
          <Typography variant="caption" color="text.secondary">
            {`Gap between pages in scroll view: ${pageGap}px`}
          </Typography>
          <Slider
            aria-label="Gap between pages"
            size="small"
            value={pageGap}
            onChange={(_event, value) => setPageGap(value as number)}
            disabled={!isScroll}
            step={4}
            marks
            min={0}
            max={64}
          />
        </Section>
        <Section title="Display">
          <FormControlLabel
            label="Page shadow in double view"
            control={
              <Switch
                checked={showPageShadow}
                onChange={(_event, on) => setShowPageShadow(on)}
              />
            }
          />
          <FormControlLabel
            label="Page numbers"
            control={
              <Switch
                checked={showPageNumbers}
                onChange={(_event, on) => setShowPageNumbers(on)}
              />
            }
          />
        </Section>
        <Section title="Loading">
          <Typography variant="caption" color="text.secondary">
            {`Preload ${preloadNumber} ${preloadNumber === 1 ? "page" : "pages"} each way${isDouble ? ` (${preloadNumber * 2} in double view)` : ""}`}
          </Typography>
          <Slider
            aria-label="Preload pages"
            size="small"
            value={preloadNumber}
            onChange={(_event, value) => setPreloadNumber(value as number)}
            valueLabelDisplay="auto"
            step={1}
            marks
            min={0}
            max={20}
          />
        </Section>
      </SettingsPanel>

      <PageChangeDrawer
        starterValue={requestForNewCurrentPage}
        min={1}
        max={activeBookmarks ? activeBookmarks.length : pageCount}
        onConclusion={(newPage) => {
          if (newPage !== null)
            goTo(
              activeBookmarks
                ? (activeBookmarks[newPage - 1] ?? currentPage)
                : newPage - 1,
            );
          setRequestForNewCurrentPage(null);
          if (returnToFullscreen) enterFullscreen();
        }}
      />
    </Box>
  );
}

const ScrollPageContainer = memo(
  (props: {
    id: string;
    count: number;
    startPage: number;
    resolve: (page: number) => Promise<string | null>;
    cache: Cache;
    virtuoso: React.RefObject<VirtuosoHandle | null>;
    preloadNumber: number;
    sidePadding: number;
    pageGap: number;
    alignX: number;
    showPageNumbers: boolean;
    onCenterPageChange: (page: number) => void;
    zoomedPage: string | null;
    pageProps: (
      page: number,
    ) => Partial<React.ComponentProps<typeof ReaderPage>>;
  }) => {
    const itemContent = useCallback(
      (index: number) => (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              props.alignX === 1
                ? "flex-start"
                : props.alignX === -1
                  ? "flex-end"
                  : "center",
            pb: index < props.count - 1 ? `${props.pageGap}px` : 0,
          }}
        >
          <ReaderPage
            pageKey={`${props.id}:${index}`}
            resolve={() => props.resolve(index)}
            knownUrl={props.cache.urls[`${props.id}:${index}`]}
            knownRatio={props.cache.ratios[`${props.id}:${index}`]}
            cache={props.cache}
            zoomed={props.zoomedPage === `${props.id}:${index}`}
            {...props.pageProps(index)}
            onRatio={(ratio) => {
              props.cache.ratios[`${props.id}:${index}`] = ratio;
            }}
            sx={{
              width: `${100 - props.sidePadding}%`,
              flexShrink: 0,
              lineHeight: 0,
              position: "relative",
              minHeight: "200px",
            }}
            imageStyle={{ width: "100%", display: "block" }}
          >
            {props.showPageNumbers && (
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  px: 1,
                  borderRadius: "16px",
                  lineHeight: 1.6,
                  color: "common.white",
                  background: "rgba(0, 0, 0, 0.4)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {index + 1}
              </Typography>
            )}
          </ReaderPage>
        </Box>
      ),
      [
        props.id,
        props.count,
        props.resolve,
        props.cache,
        props.zoomedPage,
        props.pageProps,
        props.showPageNumbers,
        props.sidePadding,
        props.pageGap,
        props.alignX,
      ],
    );
    const viewport = useMemo(
      () => ({
        top: props.preloadNumber * 800,
        bottom: props.preloadNumber * 800,
      }),
      [props.preloadNumber],
    );
    const style = useMemo(() => ({ height: "100%" }), []);
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const onCenterPageChange = useRef(props.onCenterPageChange);
    onCenterPageChange.current = props.onCenterPageChange;
    useEffect(() => {
      if (!scroller) return;
      let frame = 0;
      const measure = () => {
        frame = 0;
        const rect = scroller.getBoundingClientRect();
        for (const element of document.elementsFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )) {
          const item = element.closest<HTMLElement>("[data-index]");
          if (!item || !scroller.contains(item)) continue;
          const index = Number.parseInt(item.dataset.index ?? "", 10);
          if (!Number.isNaN(index)) onCenterPageChange.current(index);
          return;
        }
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(measure);
      };
      schedule();
      scroller.addEventListener("scroll", schedule, { passive: true });
      return () => {
        scroller.removeEventListener("scroll", schedule);
        cancelAnimationFrame(frame);
      };
    }, [scroller]);
    return (
      <Virtuoso
        key={props.id}
        ref={props.virtuoso}
        scrollerRef={(element) =>
          setScroller(element instanceof HTMLElement ? element : null)
        }
        style={style}
        increaseViewportBy={viewport}
        initialTopMostItemIndex={props.startPage}
        totalCount={props.count}
        itemContent={itemContent}
      />
    );
  },
);
ScrollPageContainer.displayName = "ScrollPageContainer";
