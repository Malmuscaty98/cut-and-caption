import React, { useMemo } from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, getRemotionEnvironment, interpolate, Sequence, useCurrentFrame } from "remotion";
import { withAutoContrast } from "../lib/style";
import { activeCaption, buildTimeline, type Timeline } from "../lib/timeline";
import type { CaptionedVideoProps } from "../lib/types";
import { CaptionLayer } from "./Captions";
import { PreviewFootage } from "./PreviewFootage";
import { ensureFonts } from "./fonts";

ensureFonts();

const NO_COVER: [number, number][] = [];

/** Zoom at an output frame: a hard punch-in for "cut" zooms, an eased push in/out for "smooth". */
function zoomAt(tl: Timeline, frame: number) {
  for (const z of tl.zooms) {
    if (frame < z.from || frame >= z.to) continue;
    const { scale, x, y, mode } = z.zoom;
    if (mode === "cut") return { scale, x, y };
    const ramp = Math.min(Math.round(0.35 * tl.fps), Math.floor((z.to - z.from) / 2));
    const s = interpolate(frame, [z.from, z.from + ramp, z.to - ramp, z.to], [1, scale, scale, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { scale: s, x, y };
  }
  return { scale: 1, x: 0.5, y: 0.4 };
}

const Footage: React.FC<{ tl: Timeline; src: string; muted: boolean; outStart: number; srcStart: number; srcEnd: number }> = ({ tl, src, muted, outStart, srcStart, srcEnd }) => {
  const frame = useCurrentFrame() + outStart;
  const z = zoomAt(tl, frame);
  return (
    <AbsoluteFill style={{ scale: String(z.scale), transformOrigin: `${z.x * 100}% ${z.y * 100}%` }}>
      {getRemotionEnvironment().isRendering ? (
        <Video src={src} trimBefore={srcStart} muted={muted} objectFit="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        // Editor preview: a plain <video> premounts and pre-seeks to its first frame, so cuts play
        // back without a decoder start-up stall at every segment.
        <PreviewFootage src={src} trimBefore={srcStart} muted={muted} fps={tl.fps} srcStart={srcStart} srcEnd={srcEnd} covered={NO_COVER} />
      )}
    </AbsoluteFill>
  );
};

// "Source" view: what a cut removes is tinted red instead of skipped.
const CutTint: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const frame = useCurrentFrame();
  const inCut = tl.cutRanges.some(([a, b]) => frame >= a && frame < b);
  if (!inCut) return null;
  return <AbsoluteFill style={{ background: "rgba(220,40,40,0.28)", border: "12px solid rgba(220,40,40,0.9)" }} />;
};

// Instagram Reels / TikTok / Shorts UI zones — keep captions out of the shaded parts.
const SafeArea: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "11%", background: "rgba(0,160,255,0.18)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "19%", background: "rgba(0,160,255,0.18)" }} />
    <div style={{ position: "absolute", right: 0, top: "40%", bottom: "19%", width: "13%", background: "rgba(0,160,255,0.18)" }} />
    <div style={{ position: "absolute", inset: "11% 13% 19% 5%", border: "3px dashed rgba(0,200,255,0.8)" }} />
  </AbsoluteFill>
);

export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({ project, style, media, view, guides }) => {
  const tl = useMemo(() => buildTimeline(project, view), [project, view]);
  const frame = useCurrentFrame();
  const cap = activeCaption(tl, frame);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {tl.segs.map((s) => (
        <Sequence key={`${s.srcStart}-${s.outStart}`} from={s.outStart} durationInFrames={s.srcEnd - s.srcStart} premountFor={Math.round(tl.fps * 1.5)} name={`clip ${s.srcStart}`}>
          <Footage tl={tl} src={media.video} muted={!!media.muted} outStart={s.outStart} srcStart={s.srcStart} srcEnd={s.srcEnd} />
        </Sequence>
      ))}
      {view === "source" ? <CutTint tl={tl} /> : null}
      <CaptionLayer caption={cap} style={cap ? withAutoContrast(style, cap.caption.start, cap.caption.position ?? style.position, project.shots, NO_COVER) : style} />
      {guides ? <SafeArea /> : null}
    </AbsoluteFill>
  );
};
