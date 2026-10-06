"""`cut-and-caption setup` — get everything ready (idempotent); `cut-and-caption doctor` — only report.

Nothing is installed system-wide. Python packages come from uv (already in place when this runs),
ffmpeg from the imageio-ffmpeg wheel, Node.js from the nodejs-wheel package. The editor is copied
from the plugin into the data folder, installed with npm and built once per version. The Whisper
model goes to the Hugging Face cache — downloaded only with consent (`--yes`), since it's big.
"""
import hashlib
import json
import platform
import shutil
import subprocess
import sys

from . import __version__
from .media import MediaError, ffmpeg
from .paths import DATA, DEV, GLOSSARY, HOME, PROJECTS, ROOT, STUDIO, STUDIO_SRC, node_exe, npm_cli, studio_dir, tool_env
from .transcribe import MLX_MODELS, MODEL_SIZE_GB, backend, default_model

NEEDS_CONSENT = 3  # exit code: the model must be downloaded — ask the user first
IGNORE = {"node_modules", ".next", ".remotion-bundle", "tsconfig.tsbuildinfo", "next-env.d.ts", ".cc-stamp"}
_NO_WINDOW = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


# ── Whisper model ───────────────────────────────────────────────────────────────────────────
def model_repo(model):
    if backend() == "mlx":
        return MLX_MODELS.get(model, model)
    from faster_whisper.utils import _MODELS
    return _MODELS.get(model, model)


def model_cached(model):
    from huggingface_hub import snapshot_download
    try:
        snapshot_download(model_repo(model), local_files_only=True)
        return True
    except Exception:
        return False


def download_model(model, log):
    from huggingface_hub import snapshot_download
    log(f"• downloading Whisper {model} (~{MODEL_SIZE_GB.get(model, '?')} GB, only once)…")
    snapshot_download(model_repo(model))
    log(f"  ✓ Whisper {model} ready")


# ── the editor ──────────────────────────────────────────────────────────────────────────────
def _files(root):
    for f in sorted(root.rglob("*")):
        rel = f.relative_to(root)
        if f.is_file() and not (set(rel.parts) & IGNORE):
            yield f, rel


def editor_stamp():
    h = hashlib.sha256(__version__.encode())
    for f, rel in _files(STUDIO_SRC):
        h.update(rel.as_posix().encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:16]


def _node(args, cwd, log, what):
    p = subprocess.run([str(node_exe()), *map(str, args)], cwd=cwd, env=tool_env(), capture_output=True,
                       text=True, encoding="utf-8", errors="replace", **_NO_WINDOW)
    if p.returncode != 0:
        tail = "\n".join((p.stdout + p.stderr).strip().splitlines()[-15:])
        raise MediaError(f"{what} failed:\n{tail}")
    return p


def editor_ready():
    d = studio_dir()
    if not (d / "node_modules" / "next").exists():
        return False
    if DEV:
        return True
    stamp = d / ".cc-stamp"
    return (d / ".next" / "BUILD_ID").exists() and stamp.exists() and stamp.read_text() == editor_stamp()


def install_editor(log):
    d = studio_dir()
    if not DEV:
        log("• copying the editor into the data folder…")
        d.mkdir(parents=True, exist_ok=True)
        for f in list(d.iterdir()):  # drop the old version, keep node_modules (faster reinstall)
            if f.name != "node_modules":
                shutil.rmtree(f) if f.is_dir() else f.unlink()
        for f, rel in _files(STUDIO_SRC):
            (d / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, d / rel)
    fresh = not (d / "node_modules").exists()
    log("• installing the editor's packages (npm, ~2–4 min the first time)…")
    _node([npm_cli(), "ci" if fresh and (d / "package-lock.json").exists() else "install",
           "--no-audit", "--no-fund", "--loglevel=error"], d, log, "npm install")
    log("• render browser (Chrome Headless Shell for Remotion)…")
    _node([d / "node_modules" / "tsx" / "dist" / "cli.mjs", "scripts/ensure-browser.ts"], d, log, "browser download")
    if not DEV:
        log("• building the editor (~1 min)…")
        _node([d / "node_modules" / "next" / "dist" / "bin" / "next", "build"], d, log, "next build")
        (d / ".cc-stamp").write_text(editor_stamp())
    log("  ✓ editor ready")


# ── report ──────────────────────────────────────────────────────────────────────────────────
def status(model=None):
    model = model or default_model()
    rows = []
    rows.append(("system", True, f"{platform.system()} {platform.release()} · {platform.machine()} · Python {platform.python_version()}"))
    try:
        v = subprocess.run([ffmpeg(), "-hide_banner", "-version"], capture_output=True, text=True, **_NO_WINDOW).stdout.split("\n")[0]
        rows.append(("ffmpeg", True, v.replace("ffmpeg version ", "")[:40]))
    except Exception as e:
        rows.append(("ffmpeg", False, str(e)))
    try:
        v = subprocess.run([str(node_exe()), "--version"], capture_output=True, text=True, **_NO_WINDOW).stdout.strip()
        rows.append(("node", True, v))
    except Exception as e:
        rows.append(("node", False, str(e)))
    rows.append(("editor", editor_ready(), str(studio_dir())))
    cached = model_cached(model)
    rows.append(("whisper", cached, f"{model} via {backend()}" + ("" if cached else f" — not downloaded (~{MODEL_SIZE_GB.get(model, '?')} GB)")))
    rows.append(("projects", True, str(PROJECTS)))
    return rows


def doctor(model=None, log=print):
    rows = status(model)
    for name, ok, info in rows:
        log(f"{'✓' if ok else '✗'} {name:9} {info}")
    ok = all(ok for _, ok, _ in rows)
    log("ready" if ok else "not ready — run: cut-and-caption setup")
    return 0 if ok else 1


def setup(model=None, yes=False, log=print):
    model = model or default_model()
    log(f"Cut & Caption {__version__} setup — data: {DATA} · projects: {HOME}")
    PROJECTS.mkdir(parents=True, exist_ok=True)
    (HOME / "presets").mkdir(parents=True, exist_ok=True)
    if not GLOSSARY.exists():
        shutil.copy2(ROOT / "glossary.example.json", GLOSSARY)
    ffmpeg()
    if not editor_ready():
        install_editor(log)
    else:
        log("• editor: up to date")
    if not model_cached(model):
        if not yes:
            log(json.dumps({"needs_consent": True, "model": model, "size_gb": MODEL_SIZE_GB.get(model)}))
            log(f"! the speech model Whisper {model} (~{MODEL_SIZE_GB.get(model, '?')} GB) must be downloaded once — "
                f"ask the user, then run: cut-and-caption setup --yes")
            return NEEDS_CONSENT
        download_model(model, log)
    return doctor(model, log)
