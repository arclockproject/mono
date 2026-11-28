//#region Imports

import { type RefObject, useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { stereoEyeRect, type videoFormat } from "./globals";

//#endregion

//#region SphereRenderer.tsx

/**
 * Where the camera looks in a 180° or 360° video.
 */
type sphereView = {
  /** Radians. Positive turns left. */
  yaw: number;
  /** Radians, `-π/2` (down) to `π/2` (up). */
  pitch: number;
  /** Vertical field of view, in degrees. */
  fov: number;
};

const FOV_MIN = 30;
const FOV_MAX = 110;
const DEFAULT_SPHERE_VIEW: sphereView = { yaw: 0, pitch: 0, fov: 80 };

/** Keeps `pitch` and `fov` in range, in place. */
const clampSphereView = (view: sphereView): void => {
  view.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, view.pitch));
  view.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, view.fov));
};

//#region WebXR types (not in TypeScript's DOM lib)

type XRViewLike = {
  eye: "left" | "right" | "none";
  projectionMatrix: Float32Array;
  transform: { inverse: { matrix: Float32Array } };
};
type XRFrameLike = {
  getViewerPose: (space: unknown) => { views: readonly XRViewLike[] } | null;
};
type XRLayerLike = {
  framebuffer: WebGLFramebuffer | null;
  getViewport: (
    view: XRViewLike,
  ) => { x: number; y: number; width: number; height: number } | null;
};
/** The parts of a WebXR `XRSession` the player uses. */
type XRSessionLike = EventTarget & {
  end: () => Promise<void>;
  requestAnimationFrame: (
    callback: (time: number, frame: XRFrameLike) => void,
  ) => number;
  updateRenderState: (state: { baseLayer: XRLayerLike }) => unknown;
  requestReferenceSpace: (type: string) => Promise<unknown>;
};
type XRSystemLike = {
  isSessionSupported: (mode: string) => Promise<boolean>;
  requestSession: (mode: string) => Promise<XRSessionLike>;
};

const xrSystem = (): XRSystemLike | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as unknown as { xr?: XRSystemLike }).xr;

/** Whether the browser can show immersive VR. `false` until it answers. */
function useVrSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    let cancelled = false;
    xrSystem()
      ?.isSessionSupported("immersive-vr")
      .then((value) => {
        if (!cancelled) setSupported(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return supported;
}

/**
 * Starts an immersive VR session. Call it from a click, or the browser
 * refuses.
 */
const requestVrSession = (): Promise<XRSessionLike> => {
  const xr = xrSystem();
  if (!xr) return Promise.reject(new Error("WebXR is not available."));
  return xr.requestSession("immersive-vr");
};

//#endregion

//#region Matrices (column-major, like WebGL)

const multiply = (a: Float32Array, b: Float32Array) => {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  return out;
};

const invert = (m: Float32Array) => {
  const [
    a00,
    a01,
    a02,
    a03,
    a10,
    a11,
    a12,
    a13,
    a20,
    a21,
    a22,
    a23,
    a30,
    a31,
    a32,
    a33,
  ] = m as unknown as number[];
  const b00 = a00! * a11! - a01! * a10!;
  const b01 = a00! * a12! - a02! * a10!;
  const b02 = a00! * a13! - a03! * a10!;
  const b03 = a01! * a12! - a02! * a11!;
  const b04 = a01! * a13! - a03! * a11!;
  const b05 = a02! * a13! - a03! * a12!;
  const b06 = a20! * a31! - a21! * a30!;
  const b07 = a20! * a32! - a22! * a30!;
  const b08 = a20! * a33! - a23! * a30!;
  const b09 = a21! * a32! - a22! * a31!;
  const b10 = a21! * a33! - a23! * a31!;
  const b11 = a22! * a33! - a23! * a32!;
  const det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  const inv = det === 0 ? 0 : 1 / det;
  return new Float32Array([
    (a11! * b11 - a12! * b10 + a13! * b09) * inv,
    (a02! * b10 - a01! * b11 - a03! * b09) * inv,
    (a31! * b05 - a32! * b04 + a33! * b03) * inv,
    (a22! * b04 - a21! * b05 - a23! * b03) * inv,
    (a12! * b08 - a10! * b11 - a13! * b07) * inv,
    (a00! * b11 - a02! * b08 + a03! * b07) * inv,
    (a32! * b02 - a30! * b05 - a33! * b01) * inv,
    (a20! * b05 - a22! * b02 + a23! * b01) * inv,
    (a10! * b10 - a11! * b08 + a13! * b06) * inv,
    (a01! * b08 - a00! * b10 - a03! * b06) * inv,
    (a30! * b04 - a31! * b02 + a33! * b00) * inv,
    (a21! * b02 - a20! * b04 - a23! * b00) * inv,
    (a11! * b07 - a10! * b09 - a12! * b06) * inv,
    (a00! * b09 - a01! * b07 + a02! * b06) * inv,
    (a31! * b01 - a30! * b03 - a32! * b00) * inv,
    (a20! * b03 - a21! * b01 + a22! * b00) * inv,
  ]);
};

const perspective = (fovY: number, aspect: number) => {
  const near = 0.1;
  const far = 100;
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
};

/** Camera rotation: pitch first, then yaw. */
const rotation = (yaw: number, pitch: number) => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  return new Float32Array([
    cy,
    0,
    -sy,
    0,
    sy * sx,
    cx,
    cy * sx,
    0,
    sy * cx,
    -sx,
    cy * cx,
    0,
    0,
    0,
    0,
    1,
  ]);
};

//#endregion

//#region WebGL

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 ndc;
void main() {
  ndc = position;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 ndc;
uniform mat4 inverseViewProjection;
uniform sampler2D frame;
uniform vec4 eye;
uniform float halfRange;
void main() {
  vec4 point = inverseViewProjection * vec4(ndc, -1.0, 1.0);
  vec3 direction = normalize(point.xyz / point.w);
  float longitude = atan(direction.x, -direction.z);
  float latitude = asin(clamp(direction.y, -1.0, 1.0));
  if (abs(longitude) > halfRange) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec2 uv = vec2(longitude / (2.0 * halfRange) + 0.5, 0.5 - latitude / 3.14159265);
  gl_FragColor = texture2D(frame, eye.xy + uv * eye.zw);
}`;

type glState = {
  gl: WebGLRenderingContext;
  draw: (
    inverseViewProjection: Float32Array,
    eye: 0 | 1,
    viewport: { x: number; y: number; width: number; height: number },
  ) => void;
  /** Copies the current video frame to the texture, if it changed. Throws a `SecurityError` for cross-origin video. */
  upload: () => boolean;
  dispose: () => void;
};

const createGl = (
  canvas: HTMLCanvasElement,
  getVideo: () => HTMLVideoElement | null,
  getFormat: () => videoFormat,
): glState | null => {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  // biome-ignore lint/correctness/useHookAtTopLevel: A WebGL method, not a React hook.
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );

  const uniforms = {
    inverseViewProjection: gl.getUniformLocation(
      program,
      "inverseViewProjection",
    ),
    eye: gl.getUniformLocation(program, "eye"),
    halfRange: gl.getUniformLocation(program, "halfRange"),
  };
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  let scratch: HTMLCanvasElement | null = null;
  let lastTime = -1;
  let lastVideo: HTMLVideoElement | null = null;

  return {
    gl,
    upload: () => {
      const video = getVideo();
      if (!video || video.readyState < 2 || video.videoWidth === 0)
        return false;
      if (video === lastVideo && video.currentTime === lastTime) return false;
      lastVideo = video;
      lastTime = video.currentTime;
      let source: TexImageSource = video;
      if (video.videoWidth > maxSize || video.videoHeight > maxSize) {
        const scale = maxSize / Math.max(video.videoWidth, video.videoHeight);
        scratch ??= document.createElement("canvas");
        scratch.width = Math.floor(video.videoWidth * scale);
        scratch.height = Math.floor(video.videoHeight * scale);
        scratch
          .getContext("2d")
          ?.drawImage(video, 0, 0, scratch.width, scratch.height);
        source = scratch;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      return true;
    },
    draw: (inverseViewProjection, eye, viewport) => {
      const format = getFormat();
      const rect = stereoEyeRect(format, eye);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      gl.uniformMatrix4fv(
        uniforms.inverseViewProjection,
        false,
        inverseViewProjection,
      );
      gl.uniform4f(uniforms.eye, rect.x, rect.y, rect.width, rect.height);
      gl.uniform1f(
        uniforms.halfRange,
        format.projection === "180" ? Math.PI / 2 : Math.PI,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
};

//#endregion

/**
 * Draws a 180° or 360° video from `video` onto a canvas, looking where `view`
 * says. `view` is read every frame, so change it in place to look around
 * without re-rendering. The video element keeps playing and is not changed.
 */
function SphereRenderer(props: {
  video: RefObject<HTMLVideoElement | null>;
  format: videoFormat;
  view: RefObject<sphereView>;
  /** CSS `filter` for the canvas. */
  filter: string;
  /** A running VR session to draw into, or `null`. */
  xrSession: XRSessionLike | null;
  /** Called when the VR session ends. */
  onXrEnd: () => void;
  /** Called when the VR controller's trigger is pressed. */
  onXrSelect: () => void;
  /** Called when the video can't be drawn, e.g. it is on another origin. */
  onError: (message: string) => void;
  /** Called when the VR session could not start. The session is ended. */
  onXrError: (message: string) => void;
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<glState | null>(null);
  const inXr = useRef(false);
  const format = useRef(props.format);
  format.current = props.format;
  const callbacks = useRef(props);
  callbacks.current = props;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const created = createGl(
      element,
      () => callbacks.current.video.current,
      () => format.current,
    );
    if (!created) {
      callbacks.current.onError("WebGL is not available in this browser.");
      return;
    }
    state.current = created;
    let frame = 0;
    let failed = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (inXr.current || failed) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(element.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(element.clientHeight * pixelRatio));
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      try {
        created.upload();
      } catch {
        failed = true;
        callbacks.current.onError(
          "The browser does not let the player read this video, because it is on another site.",
        );
        return;
      }
      const view = callbacks.current.view.current;
      clampSphereView(view);
      const inverseViewProjection = multiply(
        rotation(view.yaw, view.pitch),
        invert(perspective((view.fov * Math.PI) / 180, width / height)),
      );
      created.gl.bindFramebuffer(created.gl.FRAMEBUFFER, null);
      created.draw(inverseViewProjection, 0, { x: 0, y: 0, width, height });
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      created.dispose();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    const session = props.xrSession;
    const created = state.current;
    if (!session || !created) return;
    const { gl } = created;
    let stopped = false;
    const onEnd = () => {
      inXr.current = false;
      callbacks.current.onXrEnd();
    };
    const onSelect = () => callbacks.current.onXrSelect();
    session.addEventListener("end", onEnd);
    session.addEventListener("select", onSelect);
    const start = async () => {
      await (
        gl as unknown as { makeXRCompatible?: () => Promise<void> }
      ).makeXRCompatible?.();
      const Layer = (
        globalThis as unknown as {
          XRWebGLLayer?: new (
            session: XRSessionLike,
            gl: WebGLRenderingContext,
          ) => XRLayerLike;
        }
      ).XRWebGLLayer;
      if (!Layer) throw new Error("WebXR layers are not available.");
      const layer = new Layer(session, gl);
      await session.updateRenderState({ baseLayer: layer });
      const space = await session.requestReferenceSpace("local");
      if (stopped) return;
      inXr.current = true;
      const onFrame = (_time: number, frame: XRFrameLike) => {
        if (stopped) return;
        session.requestAnimationFrame(onFrame);
        const pose = frame.getViewerPose(space);
        if (!pose) return;
        created.upload();
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        for (const view of pose.views) {
          const viewport = layer.getViewport(view);
          if (!viewport) continue;
          const viewMatrix = Float32Array.from(view.transform.inverse.matrix);
          viewMatrix[12] = 0;
          viewMatrix[13] = 0;
          viewMatrix[14] = 0;
          created.draw(
            invert(multiply(view.projectionMatrix, viewMatrix)),
            view.eye === "right" ? 1 : 0,
            viewport,
          );
        }
      };
      session.requestAnimationFrame(onFrame);
    };
    start().catch((error: unknown) => {
      callbacks.current.onXrError(
        error instanceof Error ? error.message : "VR could not start.",
      );
      void session.end().catch(() => {});
    });
    return () => {
      stopped = true;
      inXr.current = false;
      session.removeEventListener("end", onEnd);
      session.removeEventListener("select", onSelect);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
  }, [props.xrSession]);

  return (
    <canvas
      ref={canvas}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        filter: props.filter === "none" ? undefined : props.filter,
      }}
    />
  );
}

//#endregion

export {
  clampSphereView,
  DEFAULT_SPHERE_VIEW,
  requestVrSession,
  SphereRenderer,
  useVrSupported,
};
export type { sphereView, XRSessionLike };
