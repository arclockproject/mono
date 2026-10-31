import { Box, Skeleton, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import DownloadIcon from "@mui/icons-material/Download";
import ControlCameraIcon from "@mui/icons-material/ControlCamera";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

import PageChangeDrawer from "./PageChangeDrawer";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import AppsIcon from "@mui/icons-material/Apps";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";

import { default as ImageMovable } from "@arclockproject/common/components/Image";

import type { JSX } from "react/jsx-runtime";

var IMAGE_CACHE: {
  [page: number | string]: boolean | string;
} = {};
function getCommonImageInnerEntrySrc(): string | undefined {
  return (
    document.querySelector<HTMLImageElement>(".CommonImage img")?.src ||
    document.querySelector<HTMLVideoElement>(".CommonImage video")?.src
  );
}

var lastClick = 0;
const extensionResolver = (url: string, extensions: string[]) => {
  return new Promise<string | null>((resolve, reject) => {
    let image = new Image();
    let extension = 0;
    const fetchImage = () => {
      if (extension >= extensions.length) {
        image.onerror = null;
        resolve(null);
        return;
      }
      image.src = url + extensions[extension];
      resolve(url);
      extension++;
    };
    fetchImage();
    image.onerror = fetchImage;
  });
};

function getClosest(array: number[], goal: number): number {
  const closest = array.reduce(function (prev, curr) {
    return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
  });
  return closest;
}

function getPage(
  current: number,
  offset: number,
  valid_or_max: number[] | number,
  mute_debug?: boolean,
): number {
  if (typeof valid_or_max === "number") {
    return Math.min(valid_or_max, Math.max(0, current + offset));
  }
  if (valid_or_max.length === 0) {
    return 0;
  }
  let index = valid_or_max.findIndex((val) => val === current);
  if (index === -1) {
    const closestToCurrent = getClosest(valid_or_max, current);
    index = valid_or_max.findIndex((val) => val === closestToCurrent);
    if (index === -1) {
      console.error(
        `Page ${current} not found in favorite [${valid_or_max.join(", ")}]`,
      );
      return valid_or_max[0] ?? 0;
    }
  }
  const next_index = Math.min(
    valid_or_max.length - 1,
    Math.max(0, index + offset),
  );
  if (!mute_debug)
    console.debug(
      "current",
      current,
      "offset",
      offset,
      "valid_or_max",
      valid_or_max,
      "next_index",
      next_index,
      "index",
      index,
    );
  return valid_or_max[next_index] ?? 0;
}

type Meta<required, optional> = required | (required & optional);
export default function ArtworkBrowserInline<
  itemData extends {
    /**
     * If present, urlResolver will not fire for the page.
     */
    type?: "video" | "image";
    url?: string;
  },
>(
  props: Meta<
    {
      /**
       * If id changes, cache will be dropped
       */
      id: string;
      /**
       * Whether bloom should be rendered for present image.
       */
      backgroundBloom: boolean;
      /**
       * Each image can be loaded as Low and High Resolution.
       */
      useTwoResolutions: boolean;
      data: {
        items: itemData[] | number;
        typeAll?: "video" | "image";
        /**
         * If urls are exactly the same, just return them with
         * ```js
         * (data, ... ) => {
         *   return data.url
         * }
         * ```
         *
         * If you need to resolve dynamic/unknown extension use
         * ```js
         * async (data, index, isHD, extensionResolver) => {
         *   const url = await extensionResolver(
         *     data.url // /path/to/file
         *     ["png", "jpg", "webp"]
         *   ) // /path/to/file.jpg (else null if not found)
         *   return url
         * }
         * ```
         */
        urlResolver: (
          /**
           * Undefined if data.items is a number
           */
          data: itemData | undefined,
          index: number,
          isHD: boolean,
          /**
           * Provided utility function. Given URL with no extension, it will check available extensions.
           */
          extensionResolver: (
            urlWithNoExtension: string,
            extensions: string[],
          ) => Promise<string | null>,
        ) => Promise<string | null>;
      };
    },
    {
      bookmark: number[];
      toggleBookmark: (page: number) => void;
      toggleBookmarkVisibility: () => void;
    }
  >,
): JSX.Element {
  const [fullscreen, setFullscreen] = useState(false);
  const [hideControls, setHideControls] = useState(true);
  const [bookmarkMode, setBookmarkMode] = useState(true);

  const [currentPage, setCurrentPage] = useState(
    "bookmark" in props ? (props.bookmark[0] ?? 0) : 0,
  );
  const [panning, setPanning] = useState(false);
  const [isHD, setHD] = useState(false);
  const [pixelated, setPixelated] = useState(false);
  const [requestForNewCurrentPage, setRequestForNewCurrentPage] = useState<
    string | null
  >(null);
  const [
    requestForNewCurrentPageReturnFullScreen,
    setRequestForNewCurrentPageReturnFullScreen,
  ] = useState(false);
  const [doNotExitFullscreen, setDoNotExitFullscreen] = useState(false);
  const [currentAttemptedExtension, setCurrentAttemptedExtension] = useState(0);

  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>({} as any);
  const video = useRef<HTMLVideoElement>({} as any);

  const [imageReady, setImageReady] = useState(false);

  const ctx = canvas.current?.getContext("2d");
  const pageNumbers =
    typeof props.data.items === "number"
      ? props.data.items
      : props.data.items.length;

  const valid_or_max = "bookmark" in props ? props.bookmark : pageNumbers;

  useEffect(() => {
    setCurrentAttemptedExtension(0);
    setCurrentPage(getPage(currentPage, 0, valid_or_max));
  }, ["bookmark" in props]);
  useEffect(() => {
    if (!props.data) return;
    IMAGE_CACHE = {};
    setCurrentAttemptedExtension(0);
    setHD(false);
    setCurrentPage(getPage(0, 0, valid_or_max));
  }, [props.id]);
  useEffect(() => {
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        setFullscreen(true);
      } else {
        setFullscreen(false);
        setPanning(false);
        video.current?.pause();
      }
    });
  }, []);
  useEffect(() => {
    if (!ctx || !image.current || !canvas.current || !props.backgroundBloom)
      return;
    var ticks = 0;
    var blender: ReturnType<typeof setTimeout>;
    const widthScale = image.current.width / canvas.current.width;
    const heightScale = image.current.height / canvas.current.height;
    var scale = 0;
    if (widthScale > heightScale) {
      scale = widthScale;
    } else scale = heightScale;
    var error = 0;
    const ticker = () => {
      if (!ctx || !image.current || !canvas.current) {
        if (error++ > 100)
          console.log(`setInterval(ticker, 125): Exceed loop count (${error})`);
        return;
      }
      ticks++;
      ctx.globalAlpha = 0.1;
      const paddingTop =
        canvas.current.height / 2 - image.current.height / scale / 2;
      const paddingLeft =
        canvas.current.width / 2 - image.current.width / scale / 2;
      ctx.fillStyle = "rgba(18, 18, 18, 1)";
      if (
        image.current.width / canvas.current.width >
        image.current.height / canvas.current.height
      ) {
        ctx.fillRect(0, 0, canvas.current.width, paddingTop);
        ctx.fillRect(
          0,
          canvas.current.height - paddingTop,
          canvas.current.width,
          paddingTop,
        );
      } else {
        ctx.fillRect(0, 0, paddingLeft, canvas.current.height);
        ctx.fillRect(
          canvas.current.width - paddingLeft,
          0,
          paddingLeft,
          canvas.current.height,
        );
      }
      try {
        ctx.drawImage(
          image.current,
          paddingLeft,
          paddingTop,
          image.current.width / scale,
          image.current.height / scale,
        );
      } catch (error) {
        clearInterval(blender);
      }

      if (ticks >= 50) clearInterval(blender);
    };
    blender = setInterval(ticker, 60);
    return () => {
      clearInterval(blender);
    };
  }, [imageReady, currentPage, props.id]);
  useEffect(() => {
    if (!props.data) {
      return;
    }
    const artwork = props.data;
    const preloadNumber = isHD ? 3 : 5;
    const FIRST_PAGE = 0;
    const LAST_PAGE =
      typeof props.data.items === "number"
        ? props.data.items
        : props.data.items.length - 1;
    const performImageCacheUnknwonForIndex = (index: number) => {
      if (props.data.urlResolver) {
        props.data
          .urlResolver(
            typeof props.data.items === "number"
              ? undefined
              : props.data.items[index],
            index,
            isHD,
            extensionResolver,
          )
          .then((url) => {
            if (url) {
              new Image().src = url;
              IMAGE_CACHE[index] = url;
            }
          });
      } else {
        const item =
          typeof props.data.items === "number"
            ? undefined
            : props.data.items[index];
        if (item && item.url) {
          new Image().src = item.url;
          IMAGE_CACHE[index] = item.url;
        }
      }
    };
    new Array(preloadNumber).fill(0).map((_v, i) => {
      const pageToCacheFuture = getPage(currentPage, i, valid_or_max, true);
      if (!IMAGE_CACHE[pageToCacheFuture]) {
        const belowMax = pageToCacheFuture <= LAST_PAGE;
        const aboveMin = pageToCacheFuture >= FIRST_PAGE;
        if (belowMax && aboveMin) {
          IMAGE_CACHE[pageToCacheFuture] = true;
          performImageCacheUnknwonForIndex(pageToCacheFuture);
        }
      }
      const pageToCachePast = getPage(currentPage, -i, valid_or_max, true);
      if (!IMAGE_CACHE[pageToCachePast]) {
        const belowMax = pageToCachePast <= LAST_PAGE;
        const aboveMin = pageToCachePast >= FIRST_PAGE;
        if (belowMax && aboveMin) {
          IMAGE_CACHE[pageToCachePast] = true;
          performImageCacheUnknwonForIndex(pageToCachePast);
        }
      }
    });
  }, [currentPage, props.data, isHD]);

  const pastImage = () => {
    setCurrentAttemptedExtension(0);
    setHD(false);
    if (currentPage === getPage(0, 0, valid_or_max, true)) {
      setCurrentPage(getPage(pageNumbers - 1, 0, valid_or_max));
    } else {
      setCurrentPage(getPage(currentPage, -1, valid_or_max));
    }
  };
  const nextImage = () => {
    setCurrentAttemptedExtension(0);
    setHD(false);
    if (currentPage === getPage(pageNumbers - 1, 0, valid_or_max, true)) {
      setCurrentPage(getPage(0, 0, valid_or_max));
    } else {
      setCurrentPage(getPage(currentPage, 1, valid_or_max));
    }
  };
  const isVideo =
    typeof props.data.items === "number"
      ? props.data.typeAll === "video"
      : props.data.items[currentPage]?.type === "video";
  const hideLeftRightTaps = isVideo || pageNumbers === 1;
  const hideWhenVideoInteractive = isVideo && panning;
  useEffect(() => {
    if ("bookmark" in props && bookmarkMode && props.bookmark.length === 0) {
      setBookmarkMode(false);
    }
  }, [bookmarkMode, "bookmark" in props ? props.bookmark : undefined]);
  if ("bookmark" in props && bookmarkMode && props.bookmark.length === 0) {
    return <Typography>Disabling bookmark mode... No bookmarks...</Typography>;
  }
  const onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.shiftKey) return;
    switch (event.code) {
      case "KeyF":
        if (document.fullscreenElement) {
          setFullscreen(true);
        } else {
          setFullscreen(false);
          setPanning(false);
          video.current?.pause();
        }
        break;
      case "KeyL":
        if ("bookmark" in props) props.toggleBookmark(currentPage);
        else return;
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
      tabIndex={0}
      sx={(theme) => ({
        width: "100%",
        paddingTop: "56.25%",
        position: "relative",
      })}
      onKeyUp={onKeyUp}
    >
      {!props.data ? (
        <Skeleton
          sx={(theme) => ({
            position: "absolute",
            top: 0,
            borderRadius: "16px",
          })}
          variant="rectangular"
          width="100%"
          height="100%"
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: "-3% -5%",
              backgroundSize: "contain",
              filter: "blur(150px)",
              ...(props.data ? { opacity: 0.5, zIndex: -1 } : {}),
            }}
          >
            <canvas
              ref={canvas}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: 1,
              }}
              width="110"
              height="75"
            ></canvas>
          </div>
          <Box
            sx={(theme) =>
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
            <ImageMovable
              refPropImage={image}
              refPropVideo={video}
              src={`${IMAGE_CACHE[currentPage]}`}
              onLoad={() => {
                setImageReady(true);
              }}
              renderer={isVideo ? "video" : "image"}
              onError={() => {
                if (
                  validMangaExtensions.length >
                  currentAttemptedExtension + 1
                ) {
                  setCurrentAttemptedExtension(currentAttemptedExtension + 1);
                }
              }}
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
                height: "100%",
                width: "100%",
              }}
            />
            <Box
              sx={(theme) => ({
                position: "absolute",
                inset: 0,
                width: "auto",
                minHeight: "auto",
                display: hideWhenVideoInteractive ? "none" : "flex",
                flexDirection: "row",
                pointerEvents: "none",
              })}
            >
              <Box
                sx={(theme) => ({
                  height: "100%",
                  width: hideLeftRightTaps ? 0 : "25%",
                  pointerEvents: "all",
                  cursor: "pointer",
                  transition: theme.transitions.create(["background"]),
                  borderRadius: fullscreen ? 0 : theme.spacing(2, 0, 0, 2),
                  // ":hover": {
                  //   background: theme.palette.overlay25.main,
                  // },
                })}
                onClick={pastImage}
              ></Box>
              <div
                style={{
                  height: "100%",
                  width: hideLeftRightTaps ? "100%" : "50%",
                  pointerEvents: panning ? "none" : "all",
                }}
                onClick={async (event) => {
                  let now = Date.now();
                  if (lastClick + 300 > now) {
                    lastClick = now;

                    setHideControls(false);
                    if (panning) {
                      setPanning(false);

                      if (!doNotExitFullscreen)
                        document.exitFullscreen().catch(console.error);

                      setDoNotExitFullscreen(false);
                    } else {
                      setPanning(true);
                      if (fullscreen) setDoNotExitFullscreen(true);
                      else {
                        setDoNotExitFullscreen(false);
                        document.body.requestFullscreen().catch(console.error);
                      }
                    }
                    // try {
                    //   await document.exitFullscreen();
                    // } catch (error) {
                    //   await document.body.requestFullscreen();
                    // }
                  } else {
                    lastClick = now;
                    setHideControls(!hideControls);
                  }
                }}
              ></div>
              <Box
                sx={(theme) => ({
                  height: "100%",
                  width: hideLeftRightTaps ? 0 : "25%",
                  pointerEvents: "all",
                  cursor: "pointer",
                  transition: theme.transitions.create(["background"]),
                  borderRadius: fullscreen ? 0 : theme.spacing(0, 2, 2, 0),
                })}
                onClick={nextImage}
              ></Box>
            </Box>
            <Box
              sx={(theme) => ({
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                color: theme.palette.text.primary,
                width: "100%",
                // minHeight: "100%",
                padding: theme.spacing(1),
                display: "flex",
                opacity: hideControls || hideWhenVideoInteractive ? 0 : 1,
                pointerEvents: "none",
                flexDirection: "column-reverse",
                gap: theme.spacing(1),
                transition: theme.transitions.create("opacity"),
              })}
            >
              <Box
                sx={(theme) => ({
                  width: "100%",
                  position: "relative",
                  display: pageNumbers === 1 ? "none" : "flex",
                  flexDirection: "row",
                  gap: theme.spacing(1),
                })}
              >
                <div style={{ flex: 1 }} />
                <IconButton
                  style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px",
                    pointerEvents:
                      hideControls || hideWhenVideoInteractive ? "none" : "all",
                  }}
                  onClick={() => {
                    const link = getCommonImageInnerEntrySrc();
                    if (link) window.open(link, "_blank")?.focus();
                  }}
                >
                  <DownloadIcon />
                </IconButton>
                <Box
                  sx={(theme) => ({
                    background: "transparent",
                    padding: theme.spacing(1),
                    borderRadius: "16px",
                    cursor: "pointer",
                    pointerEvents: "all",
                  })}
                  onClick={() => {
                    setRequestForNewCurrentPage(currentPage + 1 + "");
                    setRequestForNewCurrentPageReturnFullScreen(fullscreen);
                    document.exitFullscreen();
                  }}
                >
                  <Typography>{`${currentPage + 1} / ${pageNumbers}${bookmarkMode ? " (Bookmarks)" : ""}`}</Typography>
                </Box>
                <div style={{ flex: 1 }} />
              </Box>
            </Box>
            <Box
              sx={(theme) => ({
                position: "absolute",
                bottom: fullscreen ? "30px" : hideControls ? "-30px" : 0,
                left: 0,
                right: 0,
                color: theme.palette.text.primary,
                width: "100%",
                zIndex: 1000,
                // minHeight: "100%",
                padding: theme.spacing(1),
                pointerEvents: "none",
                display: "flex",
                opacity: hideControls || hideWhenVideoInteractive ? 0 : 1,
                flexDirection: "column-reverse",
                gap: theme.spacing(1),
                transition: theme.transitions.create(["opacity", "bottom"]),
              })}
            >
              <Box
                sx={(theme) => ({
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  gap: theme.spacing(1),
                })}
              >
                <div style={{ flex: 1 }} />
                {/* <IconButton
                  onClick={pastImage}
                  style={{
                    pointerEvents: hideControls || hideWhenVideoInteractive ? "none" : "all",
                    ...(hideLeftRightTaps ? { display: "none" } : { padding: "16px" }),
                  }}
                >
                  <ArrowLeftIcon />
                </IconButton> */}

                {"bookmark" in props && (
                  <>
                    {props.bookmark.length > 0 && (
                      <IconButton
                        style={{
                          padding: "16px",
                          pointerEvents:
                            hideControls || hideWhenVideoInteractive
                              ? "none"
                              : "all",
                        }}
                        onClick={() => props.toggleBookmarkVisibility()}
                      >
                        <FolderSpecialIcon />
                      </IconButton>
                    )}
                    <IconButton
                      style={{
                        padding: "16px",
                        pointerEvents:
                          hideControls || hideWhenVideoInteractive
                            ? "none"
                            : "all",
                      }}
                      onClick={() => {
                        props.toggleBookmark(currentPage);
                      }}
                    >
                      {props.bookmark.includes(currentPage) ? (
                        <FavoriteIcon />
                      ) : (
                        <FavoriteBorderIcon />
                      )}
                    </IconButton>
                  </>
                )}
                <IconButton
                  style={{
                    padding: "16px",
                    pointerEvents:
                      hideControls || hideWhenVideoInteractive ? "none" : "all",
                  }}
                  onClick={() => {
                    setPixelated(!pixelated);
                  }}
                >
                  {pixelated ? <AppsIcon /> : <BlurOnIcon />}
                </IconButton>
                <IconButton
                  style={{
                    padding: "16px",
                    pointerEvents:
                      hideControls || hideWhenVideoInteractive ? "none" : "all",
                  }}
                  onClick={() => {
                    if (panning) {
                      setPanning(false);
                      setHideControls(false);

                      if (!doNotExitFullscreen)
                        document.exitFullscreen().catch(console.error);

                      setDoNotExitFullscreen(false);
                    } else {
                      setPanning(true);
                      setHideControls(false);
                      if (fullscreen) setDoNotExitFullscreen(true);
                      else {
                        setDoNotExitFullscreen(false);
                        document.body.requestFullscreen().catch(console.error);
                      }
                    }
                  }}
                >
                  {panning ? <CloseIcon /> : <ControlCameraIcon />}
                </IconButton>
                <IconButton
                  style={{
                    padding: "16px",
                    pointerEvents:
                      hideControls || hideWhenVideoInteractive ? "none" : "all",
                  }}
                  onClick={async () => {
                    try {
                      await document.exitFullscreen();
                    } catch (error) {
                      await document.body.requestFullscreen();
                    }
                  }}
                >
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
                {/* <IconButton
                  onClick={nextImage}
                  style={{
                    pointerEvents: hideControls || hideWhenVideoInteractive ? "none" : "all",
                    ...(hideLeftRightTaps ? { display: "none" } : { padding: "16px" }),
                  }}
                >
                  <ArrowRightIcon />
                </IconButton> */}
                <div style={{ flex: 1 }} />
              </Box>
            </Box>
            <Box
              sx={(theme) => ({
                position: "absolute",
                inset: 0,
                width: "50%",
                margin: "auto",
                display: fullscreen ? "none" : undefined,
                [theme.breakpoints.up("sm")]: {
                  display: "none",
                },
              })}
              onClick={() => {
                if (!fullscreen) {
                  document.body.requestFullscreen();
                  setDoNotExitFullscreen(true);
                  if (
                    typeof props.data.items !== "number" &&
                    props.data.items.length === 1
                  ) {
                    setPanning(true);
                  } else if (props.data.items === 1) {
                    setPanning(true);
                  }
                  setHideControls(false);
                }
              }}
            ></Box>

            <Box
              sx={(theme) => ({
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
              })}
            >
              <Box
                sx={(theme) => ({
                  display: "flex",
                  flexDirection: "row",
                  pointerEvents: hideControls || !isVideo ? "none" : "all",
                  gap: theme.spacing(1),
                })}
              >
                <IconButton
                  style={{ padding: "16px" }}
                  onClick={() => {
                    if (hideWhenVideoInteractive) {
                      setPanning(false);
                      video.current?.pause();
                    } else {
                      setPanning(true);
                      video.current?.play();
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
          </Box>
          <PageChangeDrawer
            starterValue={requestForNewCurrentPage}
            min={1}
            max={
              typeof props.data.items === "number"
                ? props.data.items
                : props.data.items.length
            }
            onConclusion={(newPage) => {
              if (newPage !== null)
                setCurrentPage(getPage(newPage - 1, 0, valid_or_max));
              setRequestForNewCurrentPage(null);
              if (requestForNewCurrentPageReturnFullScreen) {
                document.body.requestFullscreen();
              }
            }}
          />
        </>
      )}
    </Box>
  );
}
