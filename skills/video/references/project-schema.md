# project.json — schema & invariants (version 1)

Contract shared by the engine, the editor and this skill. When one changes it, update this file
and `scripts/project_tool.py validate` together. Projects live in `<Cut and Caption folder>/projects/<slug>/`
(`~/Movies/Cut and Caption` on macOS, `~\Videos\Cut and Caption` on Windows, or `CUTCAPTION_HOME`).

## Shape

```jsonc
{
  "version": 1,
  "name": "episode-12",
  "source": { "path": "source.mp4", "duration": 77.24, "fps": 25, "width": 1728, "height": 3072,
              "codec": "hevc yuv420p10le",         // of the ORIGINAL clips (source.mp4 is H.264)
              "proxy": "proxy.mp4",                // H.264 720p, keyframe/0.5 s — studio only
              "audio": "audio16k.wav",             // what Whisper & silencedetect read
              "segments": [                        // original clips, in order (1 entry for a single file)
                { "file": "/abs/clips/01_intro.mp4", "start": 0, "end": 4.52 } ] },
  "output": { "aspect": "9:16", "width": 1080, "height": 1920, "fps": 30 },
  "analysis": {                                   // written by the engine, informational
    "model": "mlx-community/whisper-large-v3-mlx", "backend": "mlx", "language": "ar",
    "silence": { "threshold": -35, "minSilence": 0.45, "padding": 0.10, "minSpeech": 0.25 }
  },
  "words": [
    { "id": "w1", "text": "السلام", "start": 0.42, "end": 0.81, "conf": 0.93,
      "flags": [], "emphasis": false, "orig": null }
  ],
  "captions": [
    { "id": "c1", "wordIds": ["w1", "w2", "w3"], "start": 0.42, "end": 1.90,
      "styleOverride": null, "position": null }
  ],
  "cuts": [
    { "id": "k1", "start": 3.10, "end": 3.90, "reason": "silence",
      "enabled": true, "proposed": false, "note": "" }
  ],
  "style": { "presetId": "classic", "overrides": {} },
  "zooms": [
    { "id": "z1", "start": 4.88, "end": 8.08, "scale": 1.2, "x": 0.5, "y": 0.35,
      "mode": "cut", "reason": "cut-zoom", "enabled": true, "proposed": false } ],
  "shots": [ { "start": 0, "end": 4.52, "grid": [ /* 200 numbers */ ] } ]
}
```

## Fields

**source** — `path` / `proxy` / `audio` are relative to the project folder. `source.mp4` is a
bit-exact copy of a finished export (H.264 8-bit, constant frame rate, starts at 0 — `lossless:
true`) or a normalized H.264 mezzanine of anything else; the originals are never read again. `segments` map the
concatenated timeline back to the original clips; a segment boundary is always a valid caption
break and never inside a word.

**words[]**
- `id` — stable, unique, never reused. New words get the next free `wN`.
- `text` — one orthographic word, no spaces. Punctuation (، ؟ ؛ . !) attaches to the word it follows.
- `start` / `end` — seconds, **source time**, `0 ≤ start < end ≤ source.duration`.
- `conf` — 0–1 from Whisper. `< 0.6` is "low confidence" (underlined in the studio).
- `flags` — subset of `filler`, `retake`, `low_conf`, `edited`, `glossary`, `inserted`.
- `emphasis` — true → rendered with the emphasis color/style.
- `orig` — original Whisper text if the word was edited, else `null`. Set once; never overwrite
  an existing `orig` (it's how the diff and the studio show "what Whisper heard").

**captions[]** — one on-screen line (or line pair).
- `wordIds` — contiguous run of words, in order. A word belongs to at most one caption.
- `start` / `end` — source time. Default = first word start / last word end; the user may
  retime in the timeline, so don't "fix" small differences.
- `styleOverride` — partial style object (same keys as `style.overrides`) or `null`.
- `position` — `{ "x": 0.5, "y": 0.72 }` normalized to the output frame, or `null` (use style).

**cuts[]**
- `reason` — `silence` | `filler` | `retake` | `manual`.
- `start` / `end` — engine cuts are snapped to the frame grid (multiples of 1/fps), rounded
  toward keeping speech. Keep new cuts on the grid too.
- `enabled` — only enabled cuts affect the preview/render.
- `proposed` — true for anything Claude suggested that the user hasn't decided on yet.
  When the user enables or rejects it, set `proposed: false` (rejected → delete the cut,
  or keep it with `enabled: false` if they might want it later).
- `note` — short Arabic reason shown in the studio, e.g. «إعادة: الجملة تكررت عند 00:31».

**style.overrides / captions[].styleOverride** (keys finalized in M3/M4):

| key | example | notes |
|---|---|---|
| `fontFamily` | `"IBM Plex Sans Arabic"` \| `"Tajawal"` | bundled fonts only |
| `fontWeight` | `700` | |
| `fontSize` | `64` | px at output resolution |
| `lineHeight` | `1.3` | |
| `maxWidth` | `0.86` | fraction of frame width |
| `textColor` / `activeColor` / `emphasisColor` | `"#F5EFE0"` | hex |
| `strokeColor` / `strokeWidth` | `"#1F2A1A"` / `6` | via `paint-order: stroke fill` |
| `shadow` | `"0 4px 12px rgba(0,0,0,.35)"` | CSS text-shadow |
| `box` | `{ "color": "#3B4A2F", "radius": 18, "padding": 14, "opacity": 0.85 }` | or `null` |
| `position` | `{ "x": 0.5, "y": 0.72 }` | normalized |
| `animation` | `none` \| `word-highlight` \| `word-pop` \| `line-fade` \| `box-follow` | |
| `digits` | `western` \| `arabic-indic` | default `western` |
| `autoContrast` | `{ "enabled": true, "threshold": 0.5, "textColor": "#161C1A", "shadow": "0 2px 4px rgba(255,255,255,.6), …" }` | dark variant where the area behind the text is brighter than `threshold`; decided per shot from `shots[]` (on in the `classic` preset) |

Never add `letterSpacing` for Arabic text — it breaks letter joining.

**zooms[]** — source time like everything else (they follow the cuts); `enabled` + `proposed`
work like cuts. `x`/`y` = the zoom centre (0–1 of the frame); `mode`: `cut` (hard punch-in) or
`smooth` (eased push). `reason`: `cut-zoom`, `emphasis «word»` or `manual`. See `zoom.md`.

**shots[]** — written by `analyze` / `Q shots`: hard cut to hard cut, source seconds; `grid` = the
median brightness (0–1) of a 10 × 20 grid, row-major. Read-only — re-run `Q shots <slug>` instead
of editing it. Full type definitions: `studio/lib/types.ts`.

## Invariants (enforced by `project_tool.py validate`)

Errors (must fix):
- ids unique within each array; every `captions[].wordIds` entry exists.
- `start < end` everywhere; words within `[0, source.duration]` (+50 ms tolerance).
- words sorted by `start`; captions sorted by `start`.
- caption `wordIds` are a contiguous, in-order run of `words`; no word in two captions.
- `cuts[].reason` in the allowed set; `enabled` is boolean.
- word `text` is non-empty and contains no whitespace.

Warnings (report, don't block):
- caption lines over the length budget for the output aspect (9:16: 5 words / ~26 chars over up to 2 lines;
  1:1: 6 words / ~28 chars; 16:9: 8 words / ~42 chars).
- overlapping captions, overlapping cuts.
- words not in any caption (fine if they're inside an enabled cut).
- zero-width / bidi control characters, or tatweel (ـ) anywhere except the prefix joiner
  before Latin/digits (بـChatGPT، لـiPhone، بـ20%).
- `style.presetId` not found among the built-in or the user's presets.

## Time model

- Everything stored is **source time**. Output time is computed (engine `remap.py`, and
  the studio) by removing the union of **enabled** cuts.
- A word is dropped from output if its midpoint falls inside an enabled cut. A caption whose
  words are all dropped disappears; partially-cut captions show only the surviving words.
- Toggling a cut never changes word or caption timestamps.
