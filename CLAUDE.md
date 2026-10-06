# Qass — developer notes

Claude Code plugin: **silence cuts, precise word-level captions, punch-in zooms** for talking-head
video, a local editor, and export. Exactly these three features — no montage, overlays, music,
transitions or audio processing. Nothing personal (brands, names, styles) belongs in this repo.

## Layout

```
.claude-plugin/   plugin.json + marketplace.json (this repo is both)
skills/qass/      SKILL.md + references/ + scripts/qass_project.py (run via `qass pj`)
bin/qass          launcher (bash: macOS, Linux, Windows Git Bash) · bin/qass.cmd (cmd/PowerShell)
engine/           Python, uv "virtual" project (deps only); run.py imports qass/ from source
  qass/paths.py   ROOT (plugin, read-only) · DATA (env, editor build) · HOME (user projects)
  qass/media.py   ffmpeg = imageio-ffmpeg wheel; probing = PyAV — no system ffmpeg/ffprobe
  qass/transcribe.py  mlx-whisper on Apple Silicon, faster-whisper (CPU int8 / CUDA) elsewhere
studio/           Next.js + Remotion editor; copied into DATA/studio by `qass setup`, npm-installed
                  and built there; started by `qass studio` (next start, 127.0.0.1:4318)
```

## Rules

- **macOS (Apple Silicon + Intel) and Windows x64 are first-class.** No bash-isms outside
  `bin/qass`; subprocess calls take arg lists (no shell); paths via `pathlib` / `path`; hide
  console windows on Windows (`creationflags`); Node is the nodejs-wheel binary (`paths.node_exe`).
- The plugin folder is read-only and replaced on update: write only to DATA and HOME.
- The editor binds to 127.0.0.1 only.
- Engine messages are English (Claude relays them); the editor UI is Arabic for now.
- Ask before big downloads (the Whisper model) — `qass setup` exits 3 until `--yes`.
- Every change that touches media handling must pass `.github/workflows/smoke.yml` on all three OSes.

## Develop

```bash
export QASS_DEV=1 QASS_DATA="$PWD/.dev/data" QASS_HOME="$PWD/.dev/home"
bin/qass setup            # venv + studio/node_modules in the repo, render browser
bin/qass analyze <video> --name test && bin/qass zoom test --apply && bin/qass studio test
```
