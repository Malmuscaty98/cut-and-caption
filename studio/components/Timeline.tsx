"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { addCutRange } from "@/lib/edits";
import { useT } from "@/lib/i18n";
import { fmtTime, newId, useStore, type Selection } from "@/lib/store";
import type { Project } from "@/lib/types";
import { useTimeline } from "./hooks";

const CUT_COLOR: Record<string, string> = { silence: "var(--cut-silence)", filler: "var(--cut-filler)", retake: "var(--cut-retake)", manual: "var(--cut-manual)" };

type Drag = { kind: string; id: string; edge: "l" | "r" | "move"; t0: number; start: number; end: number; moved: boolean; before: Project };

/** Live edit without history; the caller pushes one undo step when the gesture ends. */
function live(fn: (p: Project) => void) {
  useStore.setState((s) => {
    if (!s.project) return {};
    const next = structuredClone(s.project);
    fn(next);
    return { project: next };
  });
}

export function Timeline() {
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const pps = useStore((s) => s.pxPerSec);
  const selection = useStore((s) => s.selection);
  const frame = useStore((s) => s.frame);
  const playing = useStore((s) => s.playing);
  const view = useStore((s) => s.view);
  const t = useT();
  const tl = useTimeline()!;
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<{ perSec: number; peaks: number[] } | null>(null);
  const [zoomGhost, setZoomGhost] = useState<{ a: number; b: number } | null>(null);
  const [ghost, setGhost] = useState<{ a: number; b: number } | null>(null);
  const drag = useRef<Drag | null>(null);

  const dur = project.source.duration;
  const fps = tl.fps;
  const width = Math.ceil(dur * pps) + 40;
  const playSec = tl.outToSrc(frame) / fps;
  const upd = useStore.getState().update;
  const cutLabel = (reason: string) => t(`common.cut.${reason}`);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(name)}/waveform`).then((r) => r.json()).then(setPeaks).catch(() => {});
  }, [name]);

  // Waveform with cut regions darkened.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    c.width = width;
    c.height = 46;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, width, 46);
    const cuts = project.cuts.filter((k) => k.enabled);
    for (let x = 0; x < width; x++) {
      const t = x / pps;
      const i0 = Math.floor(t * peaks.perSec);
      const i1 = Math.max(i0 + 1, Math.floor((t + 1 / pps) * peaks.perSec));
      let m = 0;
      for (let i = i0; i < i1 && i < peaks.peaks.length; i++) m = Math.max(m, peaks.peaks[i]);
      const h = Math.max(1, Math.sqrt(m) * 42);
      g.fillStyle = cuts.some((k) => t >= k.start && t < k.end) ? "#4a3a3a" : "#8a9a5b";
      g.fillRect(x, 23 - h / 2, 1, h);
    }
  }, [peaks, pps, width, project.cuts]);

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = playSec * pps;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 80) el.scrollLeft = x - 120;
  }, [playSec, pps, playing]);

  const secAt = (clientX: number) => {
    const el = scrollRef.current!;
    return Math.max(0, Math.min(dur, (clientX - el.getBoundingClientRect().left + el.scrollLeft) / pps));
  };
  const snap = (t: number) => {
    if (Math.abs(t - playSec) * pps < 6) return playSec;
    return Math.round(t * fps) / fps;
  };
  const seekSec = (t: number) => {
    const f = Math.round(t * fps);
    let out = tl.srcToOut(f);
    if (out == null) out = tl.segs.find((s) => s.srcStart >= f)?.outStart ?? tl.durationInFrames - 1;
    useStore.getState().seek(out);
  };

  // ---- generic drag for items -------------------------------------------------------------
  const startItemDrag = (e: React.PointerEvent, kind: string, id: string, edge: Drag["edge"], start: number, end: number) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = { kind, id, edge, t0: secAt(e.clientX), start, end, moved: false, before: useStore.getState().project! };
    const move = (ev: PointerEvent) => {
      const d = drag.current!;
      const dt = secAt(ev.clientX) - d.t0;
      if (Math.abs(dt * pps) > 2) d.moved = true;
      if (!d.moved) return;
      let s = d.start;
      let en = d.end;
      if (d.edge === "l") s = Math.min(snap(d.start + dt), d.end - 1 / fps);
      else if (d.edge === "r") en = Math.max(snap(d.end + dt), d.start + 1 / fps);
      else {
        const len = d.end - d.start;
        s = Math.max(0, Math.min(dur - len, snap(d.start + dt)));
        en = s + len;
      }
      s = +s.toFixed(3);
      en = +en.toFixed(3);
      live((p) => {
        const arr: { id: string; start: number; end: number }[] = d.kind === "cut" ? p.cuts : d.kind === "caption" ? p.captions : p.zooms;
        const it = arr.find((x) => x.id === d.id);
        if (it) {
          it.start = s;
          it.end = en;
        }
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = drag.current!;
      drag.current = null;
      if (d.moved) {
        useStore.setState((st) => ({ past: [...st.past, d.before], future: [], dirty: true, lastLabel: t("timeline.timelineEdit") }));
      } else {
        const sel: Selection = { kind: kind as "cut", id };
        const cur = useStore.getState().selection;
        // Click a selected cut or zoom again: switch it on/off. Otherwise: select (+ seek for others).
        if (kind === "cut" && cur?.kind === "cut" && cur.id === id) {
          upd(t("timeline.toggleCut"), (p) => p.cuts.forEach((c) => c.id === id && ((c.enabled = !c.enabled), (c.proposed = false))));
        } else if (kind === "zoom" && cur?.kind === "zoom" && cur.id === id) {
          upd(t("timeline.toggleZoom"), (p) => p.zooms.forEach((z) => z.id === id && ((z.enabled = !z.enabled), (z.proposed = false))));
        } else if (kind !== "cut") seekSec(start + 0.001);
        useStore.getState().select(sel);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Drag on empty cut track → new manual cut.
  const startNewCut = (e: React.PointerEvent) => {
    const a = snap(secAt(e.clientX));
    let b = a;
    const move = (ev: PointerEvent) => {
      b = snap(secAt(ev.clientX));
      setGhost({ a: Math.min(a, b), b: Math.max(a, b) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      if (Math.abs(b - a) * pps < 4) return seekSec(a);
      let id: string | null = null;
      upd(t("timeline.manualCut"), (p) => void (id = addCutRange(p, a, b)));
      if (id) useStore.getState().select({ kind: "cut", id });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Drag on empty zoom track → new zoom (a hard punch-in; the Inspector can make it smooth).
  const startNewZoom = (e: React.PointerEvent) => {
    const a = snap(secAt(e.clientX));
    let b = a;
    const move = (ev: PointerEvent) => {
      b = snap(secAt(ev.clientX));
      setZoomGhost({ a: Math.min(a, b), b: Math.max(a, b) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setZoomGhost(null);
      if (Math.abs(b - a) * pps < 4) return seekSec(a);
      let id = "";
      upd(t("timeline.manualZoom"), (p) => {
        id = newId("z", p.zooms);
        p.zooms.push({ id, start: +Math.min(a, b).toFixed(3), end: +Math.max(a, b).toFixed(3), scale: 1.2, x: 0.5, y: 0.35, mode: "cut", reason: "manual", enabled: true, proposed: false });
        p.zooms.sort((x, y) => x.start - y.start);
      });
      if (id) useStore.getState().select({ kind: "zoom", id });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const scrub = (e: React.PointerEvent) => {
    seekSec(secAt(e.clientX));
    const move = (ev: PointerEvent) => seekSec(secAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const isSel = (kind: string, id: string) => selection && "id" in selection && selection.kind === kind && selection.id === id;
  const item = (kind: string, id: string, start: number, end: number, color: string, label: string, opts: { off?: boolean; proposed?: boolean; resizable?: boolean; title?: string } = {}) => (
    <div
      key={`${kind}-${id}`}
      dir="auto"
      className={`tl-item${isSel(kind, id) ? " sel" : ""}${opts.off ? " off" : ""}${opts.proposed ? " proposed" : ""}`}
      style={{ left: start * pps, width: Math.max(4, (end - start) * pps), background: color }}
      title={opts.title ?? label}
      onPointerDown={(e) => startItemDrag(e, kind, id, "move", start, end)}
    >
      {(end - start) * pps > 26 ? label : ""}
      {opts.resizable !== false ? (
        <>
          <div className="tl-handle l" onPointerDown={(e) => startItemDrag(e, kind, id, "l", start, end)} />
          <div className="tl-handle r" onPointerDown={(e) => startItemDrag(e, kind, id, "r", start, end)} />
        </>
      ) : null}
    </div>
  );

  const ticks = useMemo(() => {
    const step = pps > 150 ? 0.5 : pps > 60 ? 1 : pps > 25 ? 2 : 5;
    const out: number[] = [];
    for (let t = 0; t <= dur; t += step) out.push(+t.toFixed(2));
    return { step, out };
  }, [pps, dur]);

  const proposals = project.cuts.filter((c) => c.proposed).length;
  const zoomProposals = project.zooms.filter((z) => z.proposed).length;
  const cutTotal = project.cuts.filter((c) => c.enabled).reduce((s, c) => s + c.end - c.start, 0);

  return (
    <div className="timeline">
      <div className="tl-toolbar">
        <button className={view === "output" ? "active" : ""} onClick={() => useStore.setState({ view: "output", frame: 0, seekTo: 0 })} title={t("timeline.viewOutputTitle")}>
          {t("timeline.viewOutput")}
        </button>
        <button className={view === "source" ? "active" : ""} onClick={() => useStore.setState({ view: "source", frame: 0, seekTo: 0 })} title={t("timeline.viewSourceTitle")}>
          {t("timeline.viewSource")}
        </button>
        <span className="muted">
          <span dir="ltr">{fmtTime(dur)} → {fmtTime(dur - cutTotal)}</span>
        </span>
        <span className="grow" />
        {proposals ? (
          <button
            title={t("timeline.acceptCutsTitle")}
            onClick={() => upd(t("timeline.acceptProposals"), (p) => p.cuts.forEach((c) => c.proposed && ((c.enabled = true), (c.proposed = false))))}
          >
            {t("timeline.acceptCuts", { n: proposals })}
          </button>
        ) : null}
        {zoomProposals ? (
          <button title={t("timeline.acceptZoomsTitle")} onClick={() => upd(t("timeline.acceptZoomProposals"), (p) => p.zooms.forEach((z) => z.proposed && ((z.enabled = true), (z.proposed = false))))}>
            {t("timeline.acceptZooms", { n: zoomProposals })}
          </button>
        ) : null}
        <span className="muted">{t("timeline.zoomSlider")}</span>
        <input type="range" min={15} max={300} value={pps} onChange={(e) => useStore.setState({ pxPerSec: +e.target.value })} style={{ width: 110 }} />
      </div>
      <div className="tl-body">
        <div className="tl-heads">
          <div className="tl-head ruler" />
          <div className="tl-head wave">{t("timeline.trackAudio")}</div>
          <div className="tl-head">{t("timeline.trackCuts")}</div>
          <div className="tl-head">{t("timeline.trackCaptions")}</div>
          <div className="tl-head">{t("timeline.trackZooms")}</div>
        </div>
        <div
          className="tl-scroll"
          ref={scrollRef}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const st = useStore.getState();
            st.set({ pxPerSec: Math.min(300, Math.max(15, st.pxPerSec * (e.deltaY < 0 ? 1.15 : 0.87))) });
          }}
        >
          <div className="tl-inner" style={{ width }}>
            <div className="tl-ruler" onPointerDown={scrub}>
              {ticks.out.map((t) => (
                <div key={t} className="tl-tick" style={{ left: t * pps }}>
                  {t % (ticks.step * 2) === 0 ? fmtTime(t) : ""}
                </div>
              ))}
            </div>
            <div className="tl-wave" onPointerDown={scrub}>
              <canvas ref={canvasRef} style={{ display: "block" }} />
            </div>
            {/* cuts */}
            <div className="tl-track" onPointerDown={startNewCut} title={t("timeline.cutTrackTitle")}>
              {project.cuts.map((c) =>
                item("cut", c.id, c.start, c.end, CUT_COLOR[c.reason], cutLabel(c.reason), {
                  off: !c.enabled,
                  proposed: c.proposed,
                  title: `${cutLabel(c.reason)} ${fmtTime(c.start)}–${fmtTime(c.end)} (${(c.end - c.start).toFixed(2)} ${t("common.sec")})${c.note ? "\n" + c.note : ""}\n${t("timeline.cutItemHint")}`,
                }),
              )}
              {ghost ? <div className="tl-ghost" style={{ left: ghost.a * pps, width: (ghost.b - ghost.a) * pps }} /> : null}
            </div>
            {/* captions */}
            <div className="tl-track">
              {project.captions.map((c, i) => {
                const text = c.wordIds.map((id) => project.words.find((w) => w.id === id)?.text).join(" ");
                return item("caption", c.id, c.start, c.end, "var(--caption)", `${i + 1} ${text}`, { title: `#${i + 1} ${text}` });
              })}
            </div>
            {/* zooms */}
            <div className="tl-track" onPointerDown={startNewZoom} title={t("timeline.zoomTrackTitle")}>
              {project.zooms.map((z) => item("zoom", z.id, z.start, z.end, "var(--zoom)", `${z.scale.toFixed(2)}×${z.mode === "smooth" ? " ⤢" : ""}`, { off: !z.enabled, proposed: z.proposed }))}
              {zoomGhost ? <div className="tl-ghost" style={{ left: zoomGhost.a * pps, width: (zoomGhost.b - zoomGhost.a) * pps }} /> : null}
            </div>
            {project.source.segments.slice(1).map((s) => (
              <div key={s.start} className="tl-segline" style={{ left: s.start * pps }} title={s.file.replace(/^.*\//, "")} />
            ))}
            <div className="tl-playhead" style={{ left: playSec * pps }} />
          </div>
        </div>
      </div>
    </div>
  );
}
