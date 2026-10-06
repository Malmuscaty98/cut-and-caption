// project.json — see skills/video/references/project-schema.md. All times are SOURCE seconds.

export type WordFlag = "filler" | "retake" | "low_conf" | "edited" | "glossary" | "inserted";

export interface Word {
  id: string;
  text: string;
  start: number;
  end: number;
  conf: number;
  flags: WordFlag[];
  emphasis: boolean;
  orig: string | null;
  kashida?: boolean;
}

export interface Caption {
  id: string;
  wordIds: string[];
  start: number;
  end: number;
  styleOverride: Partial<CaptionStyle> | null;
  position: { x: number; y: number } | null;
}

export type CutReason = "silence" | "filler" | "retake" | "manual";

export interface Cut {
  id: string;
  start: number;
  end: number;
  reason: CutReason;
  enabled: boolean;
  proposed: boolean;
  note: string;
}

export interface Zoom {
  id: string;
  start: number;
  end: number;
  scale: number;
  x: number; // transform origin, 0–1 of the frame
  y: number;
  mode: "cut" | "smooth"; // cut = hard punch-in for the whole piece; smooth = eased push in and out
  reason?: string;
  enabled: boolean;
  proposed: boolean;
}

export type Animation = "none" | "word-highlight" | "word-pop" | "line-fade" | "box-follow";

export interface CaptionStyle {
  fontFamily: string;
  fontWeight: number;
  fontSize: number; // px at output resolution
  lineHeight: number;
  maxWidth: number; // fraction of frame width
  maxLines: number;
  textColor: string;
  activeColor: string;
  emphasisColor: string;
  emphasisScale: number;
  strokeColor: string;
  strokeWidth: number;
  shadow: string; // CSS text-shadow, "" = none
  box: { color: string; radius: number; padding: number; opacity: number } | null;
  position: { x: number; y: number };
  animation: Animation;
  digits: "western" | "arabic-indic";
  // Dark text where the area behind the caption is light (decided per shot — see Shot).
  autoContrast?: AutoContrast | null;
}

export interface AutoContrast {
  enabled: boolean;
  threshold: number; // brightness 0–1 behind the text above which the dark variant is used
  textColor: string;
  shadow: string;
}

// A shot of the source (hard cut to hard cut) with the median brightness of a 10×20 grid.
export interface Shot {
  start: number; // source seconds
  end: number;
  grid: number[]; // ROWS×COLS, row-major, 0–1
}

export interface Preset {
  id: string;
  name: string;
  style: CaptionStyle;
  zoom?: { cutZoomScale: number; x: number; y: number };
}

export interface Segment {
  file: string;
  start: number;
  end: number;
}

export interface Project {
  version: 1;
  name: string;
  source: {
    path: string;
    duration: number;
    fps: number;
    width: number;
    height: number;
    codec?: string;
    proxy: string;
    audio: string;
    segments: Segment[];
  };
  output: { aspect: "9:16" | "16:9" | "1:1" | "4:5"; width: number; height: number; fps: number; offsetX?: number; offsetY?: number };
  words: Word[];
  captions: Caption[];
  cuts: Cut[];
  style: { presetId: string; overrides: Partial<CaptionStyle> };
  zooms: Zoom[];
  shots?: Shot[];
  analysis?: Record<string, unknown>;
}

// What the composition needs besides the project.
export interface MediaUrls {
  video: string; // proxy (editor) or source (render)
  muted?: boolean; // render: picture only — the engine adds the sound afterwards
}

export interface CaptionedVideoProps {
  project: Project;
  style: CaptionStyle;
  media: MediaUrls;
  view: "output" | "source";
  guides?: boolean;
  [key: string]: unknown;
}
