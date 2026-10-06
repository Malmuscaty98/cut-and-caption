"""`qass analyze` — media → project.json (words, silence cuts, first-pass captions, shots)."""
import json
import os
import re
import shutil
import tempfile
import time
from datetime import datetime
from pathlib import Path

from . import __version__, remap
from .captions import group
from .cutlist import reconcile, silence_cuts
from .ingest import ingest
from .paths import PROJECTS
from .shots import measure as measure_shots
from .silences import PRESETS, detect
from .transcribe import MLX_MODELS, backend, default_model, glossary_prompt, transcribe

LOW_CONF = 0.6
DEFAULT_PRESET = "classic"
OUTPUT_SIZE = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080), "4:5": (1080, 1350)}


def slugify(name):
    s = re.sub(r"[^\w؀-ۿ.-]+", "-", name.strip()).strip("-.")
    return s or "project"


def guess_aspect(w, h):
    r = w / h
    return "9:16" if r < 0.7 else "4:5" if r < 0.9 else "1:1" if r < 1.25 else "16:9"


def fmt(t):
    m, s = divmod(max(t, 0.0), 60)
    return f"{int(m):02d}:{s:04.1f}"


def write_atomic(path: Path, data):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def project_path(slug) -> Path:
    return PROJECTS / slug


def analyze(inp, name=None, aspect=None, preset="tight", model=None, language=None, force=False, like=None,
            no_cuts=False, **overrides):
    inp = Path(inp).expanduser()
    slug = slugify(name or inp.stem)
    proj = project_path(slug)
    pj = proj / "project.json"
    if pj.exists() and not force:
        raise SystemExit(f"✗ project «{slug}» already exists — use --force to redo it (the current one is "
                         f"kept in .history) or --name for a new one.")
    proj.mkdir(parents=True, exist_ok=True)
    if pj.exists():
        hist = proj / ".history"
        hist.mkdir(exist_ok=True)
        shutil.copy2(pj, hist / f"project.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.json")
    like_p = None
    if like:
        lp = project_path(like) / "project.json"
        if not lp.exists():
            raise SystemExit(f"✗ project «{like}» (to copy the look from) not found.")
        like_p = json.loads(lp.read_text(encoding="utf-8"))

    settings = {**PRESETS[preset], **{k: v for k, v in overrides.items() if v is not None}}
    model = model or default_model()
    timings = {}

    t0 = time.time()
    print("1) preparing the files (source, preview copy, 16 kHz audio)…", flush=True)
    source = ingest(inp, proj)
    timings["ingest"] = round(time.time() - t0, 1)

    t0 = time.time()
    print(f"2) transcribing with Whisper {model} ({backend()})…", flush=True)
    prompt = glossary_prompt(language)
    raw_words, lang = transcribe(proj / source["audio"], model=model, language=language, prompt=prompt)
    timings["transcribe"] = round(time.time() - t0, 1)

    t0 = time.time()
    print("3) silences and cuts…", flush=True)
    dur = source["duration"]
    raw_sil = detect(proj / source["audio"], settings["threshold"], settings["min_silence"], dur)
    words = [{"id": f"w{i}", "text": w["text"], "start": w["start"], "end": min(w["end"], dur),
              "conf": w["conf"], "flags": ["low_conf"] if w["conf"] < LOW_CONF else [],
              "emphasis": False, "orig": None} for i, w in enumerate(raw_words, 1)]
    silences = reconcile(words, raw_sil, settings["padding"])
    # Silences still snap the word timings; with no_cuts nothing is cut (the editor can do it later).
    cuts = [] if no_cuts else silence_cuts(silences, dur, words, settings["padding"], settings["min_speech"], source["fps"])
    timings["silences"] = round(time.time() - t0, 1)

    aspect = aspect or (like_p and like_p["output"]["aspect"]) or guess_aspect(source["width"], source["height"])
    ow, oh = OUTPUT_SIZE[aspect]
    project = {
        "version": 1,
        "name": slug,
        "source": source,
        "output": {"aspect": aspect, "width": ow, "height": oh, "fps": source["fps"]},
        "analysis": {
            "engine": __version__, "at": datetime.now().isoformat(timespec="seconds"),
            "input": str(inp.resolve()), "model": MLX_MODELS.get(model, model) if backend() == "mlx" else model,
            "backend": backend(), "language": lang, "prompt": prompt,
            "silencePreset": None if no_cuts else preset,
            "silence": {"threshold": settings["threshold"], "minSilence": settings["min_silence"],
                        "padding": settings["padding"], "minSpeech": settings["min_speech"]},
            "timings": timings,
        },
        "words": words,
        "captions": group(words, source["segments"], aspect),
        "cuts": cuts,
        "style": like_p["style"] if like_p else {"presetId": DEFAULT_PRESET, "overrides": {}},
        "zooms": [],
    }
    t0 = time.time()
    print("4) brightness behind the captions, per shot (auto contrast)…", flush=True)
    project["shots"] = measure_shots(proj, project)
    timings["shots"] = round(time.time() - t0, 1)
    if like:
        project["analysis"]["like"] = like
    write_atomic(pj, project)
    summary(project, pj)
    return pj


def summary(p, path):
    src, words, cuts = p["source"], p["words"], p["cuts"]
    m = remap.merged(cuts)
    out = remap.output_duration(src["duration"], m)
    low = [w for w in words if w["conf"] < LOW_CONF]
    t = p["analysis"]["timings"]
    print()
    print(f"✓ «{p['name']}» → {path}")
    print(f"  source: {len(src['segments'])} clip(s), {fmt(src['duration'])}, {src['width']}×{src['height']} "
          f"@ {src['fps']:g} fps ({src['codec']}){' — copied bit-exact' if src.get('lossless') else ''}")
    print(f"  language: {p['analysis']['language']} · words: {len(words)} (low confidence: {len(low)}) · "
          f"caption lines (first pass): {len(p['captions'])} · shots: {len(p.get('shots', []))}")
    if p["analysis"]["silencePreset"] is None:
        print("  silences: not cut (--no-cuts) — the editor's Cuts tab can compute them later")
    else:
        print(f"  silences: {len(cuts)} cuts, {sum(c['end'] - c['start'] for c in cuts):.1f} s "
              f"(preset {p['analysis']['silencePreset']}) → {fmt(src['duration'])} → {fmt(out)} "
              f"(−{100 * (1 - out / src['duration']):.0f}%)")
    print(f"  time: prepare {t['ingest']} s · transcribe {t['transcribe']} s · silences {t['silences']} s · "
          f"shots {t.get('shots', 0)} s")
    if low:
        print("  words to check: " + ", ".join(f"«{w['text']}» {fmt(w['start'])}" for w in low[:8])
              + (" …" if len(low) > 8 else ""))
