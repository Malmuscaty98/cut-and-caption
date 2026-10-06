---
name: qass
description: >-
  Qass — cut silences, add precise word-level captions and punch-in zooms on talking-head
  videos (Reels, TikTok, Shorts, YouTube), fine-tune everything in a local editor, then export.
  Any language Whisper knows; Arabic in every dialect is rendered correctly. Use this whenever
  the user gives a video file or a folder of clips and wants silences / pauses / dead air
  removed, captions / subtitles / كابشن / ترجمة added, zooms / punch-ins added, or the result
  exported — e.g. "caption this", "cut the silences", "add zooms", "make it ready for TikTok",
  «قص السكتات»، «أضف كابشن»، «حط زوم»، «صدّر الفيديو» — and for any follow-up edit to a Qass
  project (caption text, style, cuts, zooms). Everything runs on the user's computer.
---

# Qass — silence cuts, precise captions, zooms

| # | Feature | Where it's controlled |
|---|---|---|
| 1 | **Silence cuts** — only acoustic silence is cut, never a word; tight / natural presets | editor «القص» tab + the cuts track |
| 2 | **Captions** — Whisper word timings + your review pass (spelling, glossary, fillers, lines) | editor «الستايل» tab, transcript, captions track |
| 3 | **Zooms** — punch-ins at the cuts, smooth pushes on emphasized words | editor «الزوم» tab + the zoom track |

…and **export**: MP4 (H.264, BT.709) + SRT, sized for the platform.

## Ground rules

1. **Speak the user's language** (the engine's output is English — relay it).
2. **Local only.** Videos and audio never leave the computer. Don't upload anything anywhere.
3. **Non-destructive.** Originals are only read; cuts and zooms are data in `project.json`.
4. **Ask first** before the one-time model download (size below) and before installing `uv`.
5. **Snapshot before every project write, validate after** (`pj snapshot` / `pj validate`).
6. **Proposals need a yes.** Filler / retake cuts you suggest stay `proposed` until the user agrees.
   If the user asked for zooms, apply them (`--apply`); if you're only suggesting, propose.

## Step 0 — the launcher, first-time setup

Every command goes through the plugin's launcher, with the plugin's data folder:

```bash
QASS_DATA="${CLAUDE_PLUGIN_DATA}" "${CLAUDE_PLUGIN_ROOT}/bin/qass" doctor
```

Below, `Q` means exactly that prefix (`QASS_DATA="${CLAUDE_PLUGIN_DATA}" "${CLAUDE_PLUGIN_ROOT}/bin/qass"`)
and `PJ` means `Q pj`. Quote paths — they often contain spaces or Arabic.

- `Q doctor` → all ✓: go on. Otherwise run `Q setup` (2–5 min the first time: installs the editor).
- Exit **127** = `uv` isn't installed. Tell the user it's the one tool Qass needs, show the one-liner
  the launcher printed for their OS, and run it only after they agree.
- Exit **3** from setup = the speech model must be downloaded once: **large-v3** (~3.1 GB) on
  Apple-Silicon Macs, **large-v3-turbo** (~1.6 GB) on Intel Macs and Windows. Say the size, ask,
  then `Q setup --yes`. (A slow PC can use `--model medium` / `small`: faster, less accurate.)
- Projects are saved in `~/Movies/Qass/projects` (macOS) or `~\Videos\Qass\projects` (Windows).

## Step 1 — analyze

```bash
Q analyze "<video or folder of clips>" [--name <slug>] [--language ar|en|…] [--no-cuts] [--preset natural]
```

- A folder = clips joined in file-name order (`01_…`, `02_…`). Phone video (HEVC, 10-bit) is fine.
- Language is detected; pass `--language` when the user tells you, or for short / mixed clips.
- `--no-cuts` if the pauses are already trimmed; `--preset natural` keeps breathing room
  (default `tight` = punchy short-form).
- Report the summary in the user's words: length before → after, words, lines, anything to check.

## Step 2 — captions review pass

Read `references/review-pass.md` and do it: spelling & glossary → fillers → retakes → emphasis
→ line grouping. Write `project.review.json`, show `PJ diff`, save with `PJ save` after the yes.

## Step 3 — zooms (when asked, or offer them)

Read `references/zoom.md`. Typical: `Q zoom <slug> --apply` (punch-in every other piece + smooth
pushes on emphasized words). The user fine-tunes in the editor.

## Step 4 — the editor

```bash
Q studio <slug>          # starts it if needed and opens http://127.0.0.1:4318/edit/<slug>
```

Tell the user what they can do: click a word to jump; ✎ to retype a line (timing kept); drag
captions on the preview; «الستايل» font / size / colors / position / animation / auto contrast;
«القص» silence settings; «الزوم» automatic zooms; on the timeline, drag edges of cuts, captions and
zooms, drag on an empty track to add one; ⌘Z / Ctrl+Z undoes. Your edits to `project.json`
appear live in the editor.

## Step 5 — export

```bash
Q render <slug> [--aspect 9:16|4:5|1:1|16:9]
```

→ `<projects>/<slug>/renders/<slug>-9x16.mp4` + `.srt`. Read `references/export.md` for platform
tips (upload-quality settings, safe areas). Report path, length and quality line.

## Conversational edits

Read `references/edits.md`. Loop: resolve the target (`PJ captions <slug> --range 5-12`) →
`PJ snapshot` → edit → `PJ validate` → tell the user before → after.

## Commands

`setup` · `doctor` · `analyze` · `recut` (silence settings again — never cuts a word) · `zoom` ·
`shots` (re-measure brightness for caption auto contrast) · `render` · `srt` · `studio [--stop]` ·
`projects` · `pj` (summary · captions · words · cuts · validate · diff · snapshot · restore · save).
`Q <command> --help` has the options. Schema: `references/project-schema.md`.
