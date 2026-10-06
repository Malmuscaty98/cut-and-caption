"""Where things live — the same rules on macOS, Windows and Linux.

ROOT      the plugin folder (read-only once installed as a Claude Code plugin)
DATA      runtime files: the Python env, the editor build, logs
          (QASS_DATA, else CLAUDE_PLUGIN_DATA, else ~/.qass)
HOME      the user's own things: projects, saved presets, glossary
          (QASS_HOME, else ~/Movies/Qass on macOS, ~/Videos/Qass elsewhere)
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env_path(*names):
    for n in names:
        v = os.environ.get(n)
        if v and "${" not in v:  # an unexpanded placeholder is not a path
            return Path(v).expanduser()
    return None


DATA = _env_path("QASS_DATA", "CLAUDE_PLUGIN_DATA") or Path.home() / ".qass"
HOME = _env_path("QASS_HOME") or Path.home() / ("Movies" if sys.platform == "darwin" else "Videos") / "Qass"

PROJECTS = HOME / "projects"
USER_PRESETS = HOME / "presets"
GLOSSARY = HOME / "glossary.json"
BUILTIN_PRESETS = ROOT / "presets"
STUDIO_SRC = ROOT / "studio"
STUDIO = DATA / "studio"  # writable copy: node_modules + production build
PORT = int(os.environ.get("QASS_PORT", "4318"))
DEV = os.environ.get("QASS_DEV") == "1"  # run the editor from ROOT/studio with `next dev`


def studio_dir() -> Path:
    return STUDIO_SRC if DEV else STUDIO


def node_home() -> Path:
    """Folder of the real Node.js binary shipped in the nodejs-wheel package (QASS_NODE_DIR
    overrides it, e.g. to use a system Node)."""
    env = _env_path("QASS_NODE_DIR")
    if env:
        return env
    import nodejs_wheel
    pkg = Path(nodejs_wheel.__file__).parent
    for d in (pkg / "bin", pkg):
        if (d / "node").exists() or (d / "node.exe").exists():
            return d
    raise FileNotFoundError(f"no node binary in {pkg}")


def node_exe() -> Path:
    d = node_home()
    return d / ("node.exe" if (d / "node.exe").exists() else "node")


def npm_cli() -> Path:
    pkg = node_home()
    for c in (pkg.parent / "lib" / "node_modules" / "npm" / "bin" / "npm-cli.js",
              pkg / "node_modules" / "npm" / "bin" / "npm-cli.js",
              pkg / "lib" / "node_modules" / "npm" / "bin" / "npm-cli.js"):
        if c.exists():
            return c
    raise FileNotFoundError("npm-cli.js not found next to node")


def tool_env() -> dict:
    """Environment for every child process: our Node first on PATH (npm scripts and the
    editor spawn `node` by name), and where the user's things live."""
    env = dict(os.environ)
    env["PATH"] = os.pathsep.join([str(node_home()), str(Path(sys.executable).parent), env.get("PATH", "")])
    env.update({"QASS_HOME": str(HOME), "QASS_DATA": str(DATA), "QASS_ROOT": str(ROOT), "QASS_PY": sys.executable,
                "QASS_PORT": str(PORT), "REMOTION_DISABLE_TELEMETRY": "1", "NEXT_TELEMETRY_DISABLED": "1"})
    return env
