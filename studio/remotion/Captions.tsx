import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { displayText } from "../lib/style";
import type { CaptionTiming } from "../lib/timeline";
import type { CaptionStyle } from "../lib/types";

function renderWord(text: string, inLtrRun: boolean) {
  const { prefix, core, punct, ltr } = splitWord(text);
  if (inLtrRun) return core; // prefix is empty in LTR runs; punctuation is emitted after the run
  if (!ltr) return text;
  return (
    <>
      {prefix}
      <bdi dir="ltr">{core}</bdi>
      {punct}
    </>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const ARABIC_LETTER = /[\u0620-\u064A\u066E-\u06D3\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z0-9]/;

// A word = [Arabic prefix joined by tatweel] + core + [trailing punctuation]: «بـ$100» → «بـ» «$100»,
// «Code؟» → «Code» «؟». The LTR core is isolated so the bidi algorithm can't flip «$100» → «100$».
export function splitWord(text: string) {
  const m = text.match(/^((?:[\u0620-\u064A]+\u0640)?)(.*?)([\u060C\u061B\u061F.!,:?]*)$/u);
  const [, prefix = "", core = text, punct = ""] = m ?? [];
  const ltr = LTR_CHAR.test(core) && !ARABIC_LETTER.test(core);
  return { prefix, core, punct, ltr };
}

// Consecutive Latin words («Reset for Free», «Claude Code», «Opus 5.5») form one LTR run, isolated
// and unbreakable. Isolating each word on its own would flip multi-word runs («Free for Reset»).
function runs(words: CaptionTiming["words"]) {
  const out: { ltr: boolean; prefix: string; words: CaptionTiming["words"] }[] = [];
  let open = false;
  for (const w of words) {
    const sw = splitWord(w.word.text);
    const last = out[out.length - 1];
    if (sw.ltr) {
      // «لـCloud Sessions»: the Arabic prefix sits outside, «Cloud Sessions» stays one LTR block.
      if (last && last.ltr && open && !sw.prefix) last.words.push(w);
      else out.push({ ltr: true, prefix: sw.prefix, words: [w] });
    } else if (last && !last.ltr) last.words.push(w);
    else out.push({ ltr: false, prefix: "", words: [w] });
    open = sw.ltr && !sw.punct; // punctuation ends a Latin run
  }
  return out;
}

// One caption line. Arabic rules (CLAUDE.md §5): rtl + plaintext bidi, one <span> per whole
// word (never split inside a word), no letter-spacing, stroke via paint-order.
export const CaptionLine: React.FC<{ c: CaptionTiming; style: CaptionStyle; frame: number }> = ({ c, style, frame }) => {
  const { width, height, fps } = useVideoConfig();
  const pos = c.caption.position ?? style.position;
  const words = c.words.filter((w) => !w.cut);
  const box = style.box;

  const lineOpacity =
    style.animation === "line-fade"
      ? interpolate(frame, [c.from, c.from + 4, c.to - 3, c.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        left: pos.x * width,
        top: pos.y * height,
        width: style.maxWidth * width,
        translate: "-50% -50%",
        textAlign: "center",
        unicodeBidi: "plaintext",
        fontFamily: `"${style.fontFamily}"`,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.textColor,
        textShadow: style.shadow || undefined,
        WebkitTextStroke: style.strokeWidth ? `${style.strokeWidth}px ${style.strokeColor}` : undefined,
        paintOrder: "stroke fill",
        opacity: lineOpacity,
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      }}
    >
      <span
        style={
          box
            ? {
                background: hexA(box.color, box.opacity),
                borderRadius: box.radius,
                padding: `${box.padding * 0.5}px ${box.padding}px`,
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }
            : undefined
        }
      >
        {runs(words).map((run, r) => {
          const spans = run.words.map((w, i) => {
            const active = frame >= w.from && frame < Math.max(w.to, w.from + 1);
            const spoken = frame >= w.from;
            let color = w.word.emphasis ? style.emphasisColor : style.textColor;
            let scale = w.word.emphasis ? style.emphasisScale : 1;
            let opacity = 1;
            let background: string | undefined;
            if (style.animation === "word-highlight" && active) color = style.activeColor;
            if (style.animation === "word-pop") {
              const s = spring({ frame: frame - w.from, fps, config: { damping: 14, stiffness: 220 }, durationInFrames: 6 });
              opacity = spoken ? 1 : 0;
              scale *= spoken ? interpolate(s, [0, 1], [0.6, 1]) : 1;
            }
            if (style.animation === "box-follow" && active) {
              background = hexA(style.activeColor, 1);
              color = style.textColor === style.activeColor ? "#111" : style.textColor;
            }
            return (
              <React.Fragment key={w.word.id}>
                {i > 0 ? " " : null}
                <span
                  style={{
                    display: scale !== 1 || background ? "inline-block" : "inline",
                    color,
                    opacity,
                    scale: scale !== 1 ? String(scale) : undefined,
                    background,
                    borderRadius: background ? 12 : undefined,
                    padding: background ? "0 10px" : undefined,
                  }}
                >
                  {renderWord(displayText(w.word, style), run.ltr)}
                </span>
              </React.Fragment>
            );
          });
          return (
            <React.Fragment key={r}>
              {r > 0 ? " " : null}
              {run.ltr ? (
                <>
                  {run.prefix}
                  <span dir="ltr" style={{ unicodeBidi: "isolate", whiteSpace: "nowrap" }}>
                    {spans}
                  </span>
                  {splitWord(run.words[run.words.length - 1].word.text).punct}
                </>
              ) : (
                spans
              )}
            </React.Fragment>
          );
        })}
      </span>
    </div>
  );
};

export const CaptionLayer: React.FC<{ caption: CaptionTiming | null; style: CaptionStyle }> = ({ caption, style }) => {
  const frame = useCurrentFrame();
  if (!caption) return null;
  const s = caption.caption.styleOverride ? { ...style, ...caption.caption.styleOverride } : style;
  return <CaptionLine c={caption} style={s} frame={frame} />;
};
