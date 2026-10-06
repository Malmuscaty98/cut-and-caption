# Cut & Caption — developer notes

Claude Code plugin: **silence cuts, precise word-level captions, punch-in zooms** for talking-head
video, a local editor, and export. Exactly these three features — no montage, overlays, music,
transitions or audio processing. Nothing personal (brands, names, styles) belongs in this repo.

## Layout

```
.claude-plugin/   plugin.json + marketplace.json (this repo is both)
skills/video/      SKILL.md + references/ + scripts/project_tool.py (run via `cut-and-caption pj`)
bin/cut-and-caption          launcher (bash: macOS, Linux, Windows Git Bash) · bin/cut-and-caption.cmd (cmd/PowerShell)
engine/           Python, uv "virtual" project (deps only); run.py imports cutcaption/ from source
  cutcaption/paths.py   ROOT (plugin, read-only) · DATA (env, editor build) · HOME (user projects)
  cutcaption/media.py   ffmpeg = imageio-ffmpeg wheel; probing = PyAV — no system ffmpeg/ffprobe
  cutcaption/transcribe.py  mlx-whisper on Apple Silicon, faster-whisper (CPU int8 / CUDA) elsewhere
studio/           Next.js + Remotion editor; copied into DATA/studio by `cut-and-caption setup`, npm-installed
                  and built there; started by `cut-and-caption studio` (next start, 127.0.0.1:4318)
```

## Rules

- **macOS (Apple Silicon + Intel) and Windows x64 are first-class.** No bash-isms outside
  `bin/cut-and-caption`; subprocess calls take arg lists (no shell); paths via `pathlib` / `path`; hide
  console windows on Windows (`creationflags`); Node is the nodejs-wheel binary (`paths.node_exe`).
- The plugin folder is read-only and replaced on update: write only to DATA and HOME.
- The editor binds to 127.0.0.1 only.
- Engine messages are English (Claude relays them); the editor UI is Arabic for now.
- Ask before big downloads (the Whisper model) — `cut-and-caption setup` exits 3 until `--yes`.
- Every change that touches media handling must pass `.github/workflows/smoke.yml` on all three OSes.

## Develop

```bash
export CUTCAPTION_DEV=1 CUTCAPTION_DATA="$PWD/.dev/data" CUTCAPTION_HOME="$PWD/.dev/home"
bin/cut-and-caption setup            # venv + studio/node_modules in the repo, render browser
bin/cut-and-caption analyze <video> --name test && bin/cut-and-caption zoom test --apply && bin/cut-and-caption studio test
```

## Release

Users install from `https://malmuscaty-site.vercel.app/plugins/marketplace.json` (the website repo,
`web/public/plugins/marketplace.json`, points at `Malmuscaty98/cut-and-caption` on GitHub) or from the
GitHub repo's own `.claude-plugin/marketplace.json`. Claude Code updates installed copies when the
`version` in `.claude-plugin/plugin.json` changes: bump it (and `engine/cutcaption/__init__.py`,
`studio/package.json`) for every release, push, and let CI pass on all three OSes first.
