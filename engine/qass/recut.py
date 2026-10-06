"""`qass recut` — recompute the silence cuts with new settings (the editor's Cuts tab).

Same rule as `qass analyze` (verified by re-transcribing renders): only acoustic silence is cut,
padded on both sides, and any word Whisper heard inside a "silence" (said quietly) is carved out
of it. The stored words are not modified. Manual, filler and retake cuts are kept as they are.
"""
import copy
import json
import shutil
from datetime import datetime
from pathlib import Path

from .analyze import write_atomic
from .cutlist import reconcile, silence_cuts
from .silences import PRESETS, detect


def recut(project_dir: Path, preset="tight", log=print, **overrides):
    pj = project_dir / "project.json"
    p = json.loads(pj.read_text(encoding="utf-8"))
    s = {**PRESETS.get(preset or "tight", PRESETS["tight"]), **{k: v for k, v in overrides.items() if v is not None}}
    dur = p["source"]["duration"]
    fps = p["output"].get("fps") or p["source"]["fps"]

    silences = detect(project_dir / p["source"]["audio"], s["threshold"], s["min_silence"], dur)
    words = copy.deepcopy(p["words"])  # reconcile snaps a scratch copy; the project's words stay as edited
    silences = reconcile(words, silences, s["padding"])
    new = silence_cuts(silences, dur, words, s["padding"], s["min_speech"], fps)

    keep = [c for c in p["cuts"] if c.get("reason") != "silence"]
    used = [int(c["id"][1:]) for c in keep if c["id"][1:].isdigit()]
    n = max(used, default=0)
    for c in new:
        n += 1
        c["id"] = f"k{n}"
    p["cuts"] = sorted(keep + new, key=lambda c: c["start"])
    p.setdefault("analysis", {})["silencePreset"] = preset if not any(v is not None for v in overrides.values()) else "custom"
    p["analysis"]["silence"] = {"threshold": s["threshold"], "minSilence": s["min_silence"],
                                "padding": s["padding"], "minSpeech": s["min_speech"]}

    hist = project_dir / ".history"
    hist.mkdir(exist_ok=True)
    shutil.copy2(pj, hist / f"project.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}-recut.json")
    write_atomic(pj, p)
    total = sum(c["end"] - c["start"] for c in new)
    log(f"✓ {len(new)} silence cuts ({total:.1f} s) — threshold {s['threshold']} dB, min silence "
        f"{s['min_silence']} s, padding {s['padding']} s — no word was touched")
    return p
