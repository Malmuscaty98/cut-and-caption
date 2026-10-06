// Source ↔ output time. Shared by the composition, the editor and the render/SRT scripts, so the
// preview and the final MP4 agree frame for frame.
import type { Caption, Project, Word, Zoom } from "./types";

export interface Seg {
  srcStart: number; // frames, inclusive
  srcEnd: number; // frames, exclusive
  outStart: number;
}

export interface WordTiming {
  word: Word;
  from: number; // output frames
  to: number;
  cut: boolean;
}

export interface CaptionTiming {
  caption: Caption;
  index: number; // 1-based, as shown to the user
  from: number;
  to: number;
  words: WordTiming[];
}

export interface Timeline {
  fps: number;
  view: "output" | "source";
  segs: Seg[];
  durationInFrames: number;
  cutRanges: [number, number][]; // enabled cuts in source frames (merged)
  srcToOut: (srcFrame: number) => number | null;
  outToSrc: (outFrame: number) => number;
  secToOut: (sec: number) => number | null;
  srcToOutSnap: (srcFrame: number) => number; // inside a cut → first output frame after it
  captions: CaptionTiming[];
  zooms: { zoom: Zoom; from: number; to: number }[];
}

const MIN_CAPTION = 0.6; // s on screen
const BRIDGE_GAP = 0.4; // s — hold a caption until the next one if the gap is shorter

export function mergedCuts(p: Project, fps: number): [number, number][] {
  const iv = p.cuts
    .filter((c) => c.enabled)
    .map((c) => [Math.round(c.start * fps), Math.round(c.end * fps)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of iv) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function buildTimeline(p: Project, view: "output" | "source" = "output"): Timeline {
  const fps = p.output.fps || p.source.fps;
  const total = Math.max(1, Math.round(p.source.duration * fps));
  const cutRanges = mergedCuts(p, fps);

  const segs: Seg[] = [];
  if (view === "source") {
    segs.push({ srcStart: 0, srcEnd: total, outStart: 0 });
  } else {
    let t = 0;
    let out = 0;
    for (const [a, b] of cutRanges) {
      if (a > t) {
        const end = Math.min(a, total);
        segs.push({ srcStart: t, srcEnd: end, outStart: out });
        out += end - t;
      }
      t = Math.max(t, b);
    }
    if (t < total) segs.push({ srcStart: t, srcEnd: total, outStart: out });
  }
  const last = segs[segs.length - 1];
  const durationInFrames = Math.max(1, last ? last.outStart + last.srcEnd - last.srcStart : 1);

  const srcToOut = (f: number): number | null => {
    for (const s of segs) if (f >= s.srcStart && f < s.srcEnd) return s.outStart + f - s.srcStart;
    return null;
  };
  // Inside a cut → the first output frame after it (what the viewer sees next).
  const srcToOutSnap = (f: number): number => {
    for (const s of segs) {
      if (f < s.srcStart) return s.outStart;
      if (f < s.srcEnd) return s.outStart + f - s.srcStart;
    }
    return durationInFrames;
  };
  const outToSrc = (o: number): number => {
    for (const s of segs) if (o < s.outStart + s.srcEnd - s.srcStart) return s.srcStart + Math.max(0, o - s.outStart);
    return last ? last.srcEnd - 1 : 0;
  };
  const secToOut = (sec: number) => srcToOut(Math.round(sec * fps));
  const isCut = (w: Word) => view === "output" && srcToOut(Math.round(((w.start + w.end) / 2) * fps)) === null;

  // Captions: from first kept word to last kept word; bridged to the next caption over short gaps.
  const wordById = new Map(p.words.map((w) => [w.id, w]));
  const caps: CaptionTiming[] = [];
  p.captions.forEach((c, i) => {
    const words: WordTiming[] = c.wordIds
      .map((id) => wordById.get(id))
      .filter((w): w is Word => !!w)
      .map((w) => ({ word: w, from: srcToOutSnap(Math.round(w.start * fps)), to: srcToOutSnap(Math.round(w.end * fps)), cut: isCut(w) }));
    const kept = words.filter((w) => !w.cut);
    if (!kept.length) return;
    // Retimed captions (dragged in the timeline) use their own start/end.
    const from = srcToOutSnap(Math.round(c.start * fps));
    const to = Math.max(srcToOutSnap(Math.round(c.end * fps)), kept[kept.length - 1].to);
    caps.push({ caption: c, index: i + 1, from: Math.min(from, kept[0].from), to, words });
  });
  caps.sort((a, b) => a.from - b.from);
  for (let i = 0; i < caps.length; i++) {
    const next = caps[i + 1];
    const c = caps[i];
    let to = Math.max(c.to, c.from + Math.round(MIN_CAPTION * fps));
    if (next) {
      if (next.from - to < BRIDGE_GAP * fps) to = next.from;
      to = Math.min(to, next.from);
    }
    c.to = Math.min(Math.max(to, c.from + 1), durationInFrames);
  }

  const span = (start: number, end: number) => {
    const from = srcToOutSnap(Math.round(start * fps));
    const to = srcToOutSnap(Math.round(end * fps));
    return { from, to: Math.max(to, from) };
  };
  const zooms = (p.zooms ?? []).filter((z) => z.enabled).map((z) => ({ zoom: z, ...span(z.start, z.end) })).filter((z) => z.to > z.from);
  return { fps, view, segs, durationInFrames, cutRanges, srcToOut, outToSrc, secToOut, srcToOutSnap, captions: caps, zooms };
}

export function activeCaption(tl: Timeline, frame: number): CaptionTiming | null {
  // Captions are sorted and non-overlapping → binary search.
  let lo = 0;
  let hi = tl.captions.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = tl.captions[mid];
    if (frame < c.from) hi = mid - 1;
    else if (frame >= c.to) lo = mid + 1;
    else return c;
  }
  return null;
}
