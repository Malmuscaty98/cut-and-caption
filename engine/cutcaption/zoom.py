"""`cut-and-caption zoom` — punch-in zooms, the third feature.

- cut zooms: every other kept piece is punched in (hard cut wide ↔ tight), the classic
  jump-cut rhythm of short-form video. Pieces shorter than MIN_PIECE stay wide.
- emphasis zooms: a smooth push-in on each word marked `emphasis` (Claude marks the key words in
  its review pass; the user can mark more in the editor with E).

Without --apply new zooms are *proposed* (dashed in the editor until accepted); with --apply they
are on. Existing zooms the user made or edited are kept; earlier proposals of the same kind are
replaced.
"""
import json
from datetime import datetime
from pathlib import Path

from .analyze import write_atomic
from .audio import kept_frames

MIN_PIECE = 0.6       # s
CUT_SCALE = 1.2
EMPHASIS_SCALE = 1.12
LEAD, TAIL = 0.35, 0.9  # s before / after the emphasized word


def cut_zooms(p, scale, x, y, every=2):
    fps, segs, _ = kept_frames(p)
    out = []
    for i, (s, e, _o) in enumerate(segs):
        if i % every == every - 1 and (e - s) / fps >= MIN_PIECE:
            out.append({"start": round(s / fps, 3), "end": round(e / fps, 3), "scale": scale, "x": x, "y": y,
                        "mode": "cut", "reason": "cut-zoom"})
    return out


def emphasis_zooms(p, scale, x, y, avoid):
    out = []
    for w in p["words"]:
        if not w.get("emphasis"):
            continue
        mid = (w["start"] + w["end"]) / 2
        if any(z["start"] <= mid < z["end"] for z in avoid + out):
            continue  # already punched in
        out.append({"start": round(max(0.0, w["start"] - LEAD), 3), "end": round(w["end"] + TAIL, 3), "scale": scale,
                    "x": x, "y": y, "mode": "smooth", "reason": f"emphasis «{w['text']}»"})
    return out


def run(project_dir: Path, cuts=True, emphasis=True, apply=False, scale=None, x=0.5, y=0.35, every=2, clear=False,
        log=print):
    pj = project_dir / "project.json"
    p = json.loads(pj.read_text(encoding="utf-8"))
    hist = project_dir / ".history"
    hist.mkdir(exist_ok=True)
    (hist / f"project.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}-zoom.json").write_text(
        pj.read_text(encoding="utf-8"), encoding="utf-8")

    zooms = [] if clear else p.get("zooms", [])
    kinds = ({"cut-zoom"} if cuts else set()) | ({"emphasis"} if emphasis else set())
    kind = lambda z: "cut-zoom" if z.get("reason") == "cut-zoom" else "emphasis" if str(z.get("reason", "")).startswith("emphasis") else "manual"
    # keep the user's own zooms and anything already accepted; replace pending proposals we regenerate
    keep = [z for z in zooms if kind(z) not in kinds or (not z.get("proposed") and not apply)]
    keep_ids = {z["id"] for z in keep}
    new = []
    if cuts and not any(kind(z) == "cut-zoom" for z in keep):
        new += cut_zooms(p, scale or CUT_SCALE, x, y, every)
    if emphasis:
        new += emphasis_zooms(p, scale or EMPHASIS_SCALE, x, y, [z for z in keep + new if z.get("mode") == "cut"])
    n = max([int(z["id"][1:]) for z in keep if z["id"][1:].isdigit()] + [0])
    for z in new:
        n += 1
        z.update({"id": f"z{n}", "enabled": apply, "proposed": not apply})
    p["zooms"] = sorted(keep + new, key=lambda z: z["start"])
    write_atomic(pj, p)
    nc = sum(1 for z in new if z["mode"] == "cut")
    ne = len(new) - nc
    state = "on" if apply else "proposed (accept them in the editor)"
    log(f"✓ zooms: {nc} at cuts, {ne} on emphasized words — {state}; {len(keep_ids)} existing kept")
    if emphasis and not any(w.get("emphasis") for w in p["words"]):
        log("  no word is marked as emphasis yet — mark key words (review pass or E in the editor) for emphasis zooms")
    return p
