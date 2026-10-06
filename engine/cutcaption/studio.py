"""`cut-and-caption studio [project]` — start the editor if it isn't running, open it in the browser.

The editor is a local web app bound to 127.0.0.1 only (never reachable from the network).
It keeps running after the command returns; `cut-and-caption studio --stop` stops it.
"""
import json
import os
import signal
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import webbrowser

from .media import MediaError
from .paths import DATA, DEV, PORT, node_exe, studio_dir, tool_env

URL = f"http://127.0.0.1:{PORT}"
PID = DATA / "studio.pid"
LOG = DATA / "studio.log"


def alive():
    try:
        with urllib.request.urlopen(URL + "/api/health", timeout=1.5) as r:
            return json.loads(r.read()).get("app") == "cut-and-caption"
    except Exception:
        return False


def start(log=print):
    if alive():
        return URL
    studio = studio_dir()
    nxt = studio / "node_modules" / "next" / "dist" / "bin" / "next"
    if not nxt.exists():
        raise MediaError("the editor isn't installed yet — run: cut-and-caption setup")
    if not DEV and not (studio / ".next" / "BUILD_ID").exists():
        raise MediaError("the editor isn't built yet — run: cut-and-caption setup")
    DATA.mkdir(parents=True, exist_ok=True)
    cmd = [str(node_exe()), str(nxt), "dev" if DEV else "start", "-H", "127.0.0.1", "-p", str(PORT)]
    kw = ({"creationflags": 0x00000008 | 0x00000200}  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
          if sys.platform == "win32" else {"start_new_session": True})
    with open(LOG, "ab") as logf:
        proc = subprocess.Popen(cmd, cwd=studio, env=tool_env(), stdout=logf, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, **kw)
    PID.write_text(str(proc.pid))
    log("starting the editor…")
    for _ in range(240):
        time.sleep(0.5)
        if alive():
            return URL
        if proc.poll() is not None:
            break
    raise MediaError(f"the editor didn't start — see {LOG}")


def stop(log=print):
    if not PID.exists():
        log("the editor isn't running")
        return
    pid = int(PID.read_text() or 0)
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        else:
            os.killpg(pid, signal.SIGTERM)
    except Exception:
        pass
    PID.unlink(missing_ok=True)
    log("✓ editor stopped")


def open_project(slug=None, browser=True, log=print):
    url = start(log) + (f"/edit/{urllib.parse.quote(slug)}" if slug else "/")
    if browser:
        webbrowser.open(url)
    log(f"✓ editor: {url}")
    return url
