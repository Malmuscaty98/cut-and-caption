import React, { useCallback, useEffect, useRef } from "react";
import { AbsoluteFill, Html5Video } from "remotion";

const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

/**
 * Studio preview footage. The <video> plays on its own clock, which can run ahead of the Player
 * (a slow audio start, a stall) — and the browser keeps showing new video frames even while the
 * page itself is stuck. So the frames are copied onto a canvas on top, and a frame this clip must
 * not show (past its cut, or inside a `covered` range) is never copied: the canvas holds the last
 * good one. Whatever the timing, cut content can't flash through.
 */
export const PreviewFootage: React.FC<{
  src: string;
  trimBefore: number;
  muted: boolean;
  fps: number;
  srcStart: number; // frames — the part of the source this clip plays
  srcEnd: number;
  covered: [number, number][]; // source seconds that must never show (none in this edition)
}> = ({ src, trimBefore, muted, fps, srcStart, srcEnd, covered }) => {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);

  // Frame timestamps are k/fps give or take rounding → compare with half a frame of slack.
  const visible = useCallback(
    (t: number) => {
      const half = 0.5 / fps;
      if (t < srcStart / fps - half || t >= srcEnd / fps - half) return false;
      return !covered.some(([a, b]) => t >= a - half && t < b - half);
    },
    [fps, srcStart, srcEnd, covered],
  );
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const draw = useCallback((t: number) => {
    const v = video.current;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!v || !c || !ctx || !v.videoWidth) return;
    if (c.width !== v.videoWidth) c.width = v.videoWidth;
    if (c.height !== v.videoHeight) c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    drawn.current = true;
    if (process.env.NODE_ENV !== "production") (c as HTMLCanvasElement & { ccT?: number }).ccT = t; // for playback probes
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v || typeof v.requestVideoFrameCallback !== "function") return;
    let id = 0;
    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (!drawn.current || visibleRef.current(meta.mediaTime)) draw(meta.mediaTime);
      id = v.requestVideoFrameCallback(onFrame);
    };
    id = v.requestVideoFrameCallback(onFrame);
    return () => v.cancelVideoFrameCallback(id);
  }, [draw]);

  // Paused and the rules changed (e.g. a cut was switched off) → show the real frame now.
  useEffect(() => {
    const v = video.current;
    if (v?.paused && visible(v.currentTime)) draw(v.currentTime);
  }, [visible, draw]);

  return (
    <AbsoluteFill>
      {/* Remotion re-syncs the tag once it drifts 0.15 s (its default, 0.65 s, lets the voice run
          ahead of the captions for good after a slow start). */}
      <Html5Video ref={video} src={src} trimBefore={trimBefore} muted={muted} pauseWhenBuffering acceptableTimeShiftInSeconds={0.15} style={fill} />
      <canvas ref={canvas} style={fill} />
    </AbsoluteFill>
  );
};
