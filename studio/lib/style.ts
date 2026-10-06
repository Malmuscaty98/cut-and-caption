import type { CaptionStyle, Preset, Shot, Word } from "./types";

export const FONT_FAMILIES = ["IBM Plex Sans Arabic", "Tajawal"] as const;

export const FONT_FILES: { family: string; weight: number; file: string }[] = [
  ...[
    [100, "Thin"], [200, "ExtraLight"], [300, "Light"], [400, "Regular"], [500, "Medium"], [600, "SemiBold"], [700, "Bold"],
  ].map(([w, n]) => ({ family: "IBM Plex Sans Arabic", weight: w as number, file: `fonts/IBMPlexSansArabic-${n}.ttf` })),
  ...[
    [200, "ExtraLight"], [300, "Light"], [400, "Regular"], [500, "Medium"], [700, "Bold"], [800, "ExtraBold"], [900, "Black"],
  ].map(([w, n]) => ({ family: "Tajawal", weight: w as number, file: `fonts/Tajawal-${n}.ttf` })),
];

// Fallback if presets/ can't be read — close to presets/classic.json.
export const DEFAULT_STYLE: CaptionStyle = {
  fontFamily: "IBM Plex Sans Arabic",
  fontWeight: 700,
  fontSize: 66,
  lineHeight: 1.35,
  maxWidth: 0.72,
  maxLines: 2,
  textColor: "#FFFFFF",
  activeColor: "#FFFFFF",
  emphasisColor: "#FFFFFF",
  emphasisScale: 1,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadow: "0 3px 6px rgba(0,0,0,0.55), 0 6px 22px rgba(0,0,0,0.45)",
  box: null,
  position: { x: 0.5, y: 0.72 },
  animation: "none",
  digits: "western",
};

export function resolveStyle(presets: Preset[], presetId: string, overrides: Partial<CaptionStyle>, capOverride?: Partial<CaptionStyle> | null): CaptionStyle {
  const base = presets.find((p) => p.id === presetId)?.style ?? DEFAULT_STYLE;
  return { ...DEFAULT_STYLE, ...base, ...overrides, ...(capOverride ?? {}) };
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
// Letters that never connect to the following letter — a tatweel after them would float.
const NON_JOINING = new Set("اأإآدذرزوؤةءى ");
const ARABIC = /[ؠ-ي]/;

export function displayText(w: Word, style: CaptionStyle): string {
  let t = w.text;
  if (style.digits === "arabic-indic") t = t.replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
  if (w.kashida) {
    // Stretch before the last letter, as in «يستعمـل».
    const chars = [...t];
    for (let i = chars.length - 1; i > 0; i--) {
      if (ARABIC.test(chars[i]) && ARABIC.test(chars[i - 1]) && !NON_JOINING.has(chars[i - 1])) {
        chars.splice(i, 0, "ـ");
        break;
      }
    }
    t = chars.join("");
  }
  return t;
}

// ── auto contrast ────────────────────────────────────────────────────────────────────────────
const GRID_ROWS = 20;
const GRID_COLS = 10;

/** Mean brightness of a region (0–1 coordinates) from a shot's grid, cells weighted by overlap. */
export function areaLuma(grid: number[], x0: number, x1: number, y0: number, y1: number): number {
  let total = 0;
  let weight = 0;
  grid.forEach((v, i) => {
    const r = Math.floor(i / GRID_COLS);
    const c = i % GRID_COLS;
    const ox = Math.max(0, Math.min(x1, (c + 1) / GRID_COLS) - Math.max(x0, c / GRID_COLS));
    const oy = Math.max(0, Math.min(y1, (r + 1) / GRID_ROWS) - Math.max(y0, r / GRID_ROWS));
    total += v * ox * oy;
    weight += ox * oy;
  });
  return weight ? total / weight : 0;
}

/** Brightness right behind the text: centre ±35 % of the max width, ±4 % of the height. */
export function captionLuma(grid: number[], pos: { x: number; y: number }, maxWidth: number): number {
  const half = maxWidth * 0.35;
  return areaLuma(grid, pos.x - half, pos.x + half, pos.y - 0.04, pos.y + 0.04);
}

export const AUTO_CONTRAST_DEFAULT = {
  enabled: true,
  threshold: 0.5,
  textColor: "#161C1A",
  shadow: "0 2px 4px rgba(255,255,255,0.6), 0 6px 20px rgba(255,255,255,0.35)",
};

export const COVER_LUMA = 0.94; // a light full-frame cover (e.g. a page) behind a caption

/**
 * The dark variant when the background behind this caption is light. Decided by the shot the
 * caption starts in, so the colour never flickers inside one shot; a caption that starts under
 * a full-frame cover (`covered`) reads as light. Per-caption overrides still win (applied after).
 */
export function withAutoContrast(
  style: CaptionStyle,
  startSec: number,
  pos: { x: number; y: number },
  shots: Shot[] | undefined,
  covered: [number, number][],
): CaptionStyle {
  const ac = style.autoContrast;
  if (!ac?.enabled) return style;
  let luma: number | null = null;
  if (covered.some(([a, b]) => startSec >= a && startSec < b)) luma = COVER_LUMA;
  else {
    const shot = shots?.find((s) => startSec >= s.start && startSec < s.end) ?? shots?.[shots.length - 1];
    if (shot?.grid?.length) luma = captionLuma(shot.grid, pos, style.maxWidth);
  }
  if (luma == null || luma <= ac.threshold) return style;
  return { ...style, textColor: ac.textColor, activeColor: ac.textColor, emphasisColor: ac.textColor, shadow: ac.shadow };
}
