"use client";
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptionedVideo } from "@/remotion/CaptionedVideo";
import { activeCaption } from "@/lib/timeline";
import { fmtTime, useStore } from "@/lib/store";
import type { CaptionedVideoProps } from "@/lib/types";
import { useResolvedStyle, useTimeline } from "./hooks";

// Imperative handle used by the keyboard shortcuts (J/K/L, Space).
let ref: PlayerRef | null = null;
let rate = 1;
let setRateState: (r: number) => void = () => {};
type Gesture = Parameters<PlayerRef["play"]>[0];
// Pass the click/key event through: browsers only allow audio after a user gesture.
export const player = {
  toggle: (e?: Gesture) => {
    if (ref?.isPlaying()) return ref.pause();
    rate = 1;
    setRateState(1);
    ref?.play(e);
  },
  pause: () => ref?.pause(),
  play: (r: number, e?: Gesture) => {
    rate = r;
    setRateState(r);
    ref?.play(e);
  },
  rate: () => (ref?.isPlaying() ? rate : 0),
};

export function PlayerPanel() {
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const view = useStore((s) => s.view);
  const guides = useStore((s) => s.guides);
  const seekTo = useStore((s) => s.seekTo);
  const frame = useStore((s) => s.frame);
  const selection = useStore((s) => s.selection);
  const playing = useStore((s) => s.playing);
  const tl = useTimeline()!;
  const style = useResolvedStyle()!;
  const playerRef = useRef<PlayerRef>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 533 });
  const [playbackRate, setPlaybackRate] = useState(1);
  setRateState = setPlaybackRate;

  const W = project.output.width;
  const H = project.output.height;

  // Fit the frame into the available area.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      const k = Math.min(width / W, height / H);
      setSize({ w: Math.floor(W * k), h: Math.floor(H * k) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  useEffect(() => {
    ref = playerRef.current;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __player?: PlayerRef | null }).__player = playerRef.current; // dev-only debugging handle
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => useStore.setState({ frame: e.detail.frame });
    const onPlay = () => useStore.setState({ playing: true });
    const onPause = () => useStore.setState({ playing: false });
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    if (seekTo == null || !playerRef.current) return;
    playerRef.current.seekTo(Math.min(seekTo, tl.durationInFrames - 1));
    useStore.setState({ seekTo: null });
  }, [seekTo, tl.durationInFrames]);

  const base = `/api/media/${encodeURIComponent(name)}/`;
  const inputProps = useMemo<CaptionedVideoProps>(
    () => ({ project, style, view, guides, media: { video: base + project.source.proxy } }),
    [project, style, view, guides, base],
  );

  // Drag the caption on the preview: global position, or the selected caption's own position.
  const cap = activeCaption(tl, frame);
  const selCap = selection?.kind === "caption" ? project.captions.find((c) => c.id === selection.id) : null;
  const pos = selCap?.position ?? style.position;
  const onDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      let x = (ev.clientX - rect.left) / rect.width;
      const y = Math.min(0.97, Math.max(0.03, (ev.clientY - rect.top) / rect.height));
      if (Math.abs(x - 0.5) < 0.015) x = 0.5; // snap to center
      x = Math.min(0.97, Math.max(0.03, x));
      const p = { x: +x.toFixed(3), y: +y.toFixed(3) };
      const st = useStore.getState();
      if (selCap) {
        useStore.setState((s) => ({
          project: s.project && { ...s.project, captions: s.project.captions.map((c) => (c.id === selCap.id ? { ...c, position: p } : c)) },
        }));
      } else {
        useStore.setState((s) => ({ project: s.project && { ...s.project, style: { ...s.project.style, overrides: { ...s.project.style.overrides, position: p } } } }));
      }
      void st;
    };
    const before = useStore.getState().project!;
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // one undo step for the whole drag
      useStore.setState((s) => ({ past: [...s.past, before], future: [], dirty: true, lastLabel: "تحريك الكابشن" }));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="preview">
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        {/* dir=ltr: the page is RTL, which shifts the Player's scaled layer out of its box. Captions set their own dir. */}
        <div dir="ltr" style={{ position: "relative", width: size.w, height: size.h, boxShadow: "0 0 0 1px #2b2e33" }}>
          <Player
            ref={playerRef}
            component={CaptionedVideo}
            inputProps={inputProps}
            durationInFrames={tl.durationInFrames}
            fps={tl.fps}
            compositionWidth={W}
            compositionHeight={H}
            style={{ width: size.w, height: size.h }}
            playbackRate={playbackRate}
            clickToPlay={false}
            spaceKeyToPlayOrPause={false}
            doubleClickToFullscreen
            acknowledgeRemotionLicense
            bufferStateDelayInMilliseconds={300}
          />
          {/* caption position handle */}
          <div
            title="اسحب لتحريك الكابشن (لو محدد سطر، يتحرك هو بس)"
            onPointerDown={onDrag}
            style={{
              position: "absolute",
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: style.maxWidth * size.w,
              height: Math.max(28, style.fontSize * style.lineHeight * (size.h / H) * 1.1),
              translate: "-50% -50%",
              border: `1px dashed ${selCap ? "var(--caption)" : "rgba(201,178,124,0.8)"}`,
              borderRadius: 6,
              cursor: "move",
              opacity: cap || selCap ? 0.9 : 0.4,
            }}
          />
          {Math.abs(pos.x - 0.5) < 0.001 ? (
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(201,178,124,0.35)", pointerEvents: "none" }} />
          ) : null}
        </div>
      </div>
      <div className="row" style={{ padding: "6px 12px", borderTop: "1px solid var(--line)", background: "var(--panel)", direction: "rtl" }}>
        <button onClick={(e) => player.toggle(e)} title="Space">{playing ? "⏸" : "▶︎"}</button>
        <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtTime(frame / tl.fps)} / {fmtTime(tl.durationInFrames / tl.fps)}
        </span>
        {playbackRate !== 1 ? <span className="kbd">{playbackRate}×</span> : null}
        <span className="grow" />
        <label className="row muted">
          <input type="checkbox" checked={guides} onChange={(e) => useStore.setState({ guides: e.target.checked })} />
          حدود Reels
        </label>
      </div>
    </div>
  );
}
