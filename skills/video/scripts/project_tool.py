#!/usr/bin/env python3
"""Inspect, validate, diff and snapshot Cut & Caption project.json files.

Stdlib only, Python >= 3.9. Used by the Cut & Caption Claude Code skill; see ../SKILL.md.
"""
import argparse
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# Projects live in the user's Cut and Caption folder (same rule as engine/cutcaption/paths.py).
HOME = Path(os.environ.get("CUTCAPTION_HOME") or Path.home() / ("Movies" if sys.platform == "darwin" else "Videos") / "Cut and Caption")
PRESET_DIRS = [Path(__file__).resolve().parents[3] / "studio" / "presets", HOME / "presets"]
HISTORY_KEEP = 50
LOW_CONF = 0.6
CUT_REASONS = {"silence", "filler", "retake", "manual"}
WORD_FLAGS = {"filler", "retake", "low_conf", "edited", "glossary", "inserted"}
LINE_BUDGET = {"9:16": (5, 26), "4:5": (6, 28), "1:1": (6, 28), "16:9": (8, 42)}  # (words, chars), up to 2 lines
BAD_CHARS = re.compile("[\u200b-\u200f\u061c\u202a-\u202e\u2066-\u2069]")
# Tatweel is fine as the standard prefix joiner before Latin/digits (بـClaude، بـ20%), not elsewhere.
BAD_TATWEEL = re.compile("\u0640(?![A-Za-z0-9$])")
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
TIME_EPS = 0.05


# ---------------------------------------------------------------- io

def resolve(arg):
    """Slug, project folder or project.json path -> Path to project.json."""
    p = Path(arg).expanduser()
    if p.is_dir():
        p = p / "project.json"
    elif not p.exists() and "/" not in arg:
        p = HOME / "projects" / arg / "project.json"
    if not p.exists():
        sys.exit(f"✗ project not found: {p}")
    return p


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_atomic(path, data):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def history_dir(path):
    return path.parent / ".history"


def snapshot(path):
    h = history_dir(path)
    h.mkdir(exist_ok=True)
    dst = h / f"project.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.json"
    shutil.copy2(path, dst)
    for old in sorted(h.glob("project.*.json"))[:-HISTORY_KEEP]:
        old.unlink()
    return dst


# ---------------------------------------------------------------- time

def fmt(t):
    if t is None:
        return "--:--.-"
    m, s = divmod(max(t, 0.0), 60)
    return f"{int(m):02d}:{s:04.1f}"


def enabled_cuts(d):
    """Union of enabled cuts as sorted, merged (start, end) intervals."""
    iv = sorted((c["start"], c["end"]) for c in d.get("cuts", []) if c.get("enabled"))
    merged = []
    for s, e in iv:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return merged


def to_output(t, cuts):
    """Source time -> output time (None if t falls inside an enabled cut)."""
    removed = 0.0
    for s, e in cuts:
        if t >= e:
            removed += e - s
        elif t > s:
            return None
        else:
            break
    return t - removed


def is_cut(word, cuts):
    mid = (word["start"] + word["end"]) / 2
    return any(s <= mid < e for s, e in cuts)


def output_duration(d):
    dur = d.get("source", {}).get("duration") or 0.0
    return dur - sum(min(e, dur) - max(s, 0) for s, e in enabled_cuts(d) if e > 0 and s < dur)


# ---------------------------------------------------------------- views

def word_map(d):
    return {w["id"]: w for w in d.get("words", [])}


def caption_text(c, words, cuts=None, mark=True):
    parts = []
    for wid in c["wordIds"]:
        w = words.get(wid)
        if w is None:
            parts.append(f"<{wid}?>")
            continue
        t = w["text"]
        if mark and w.get("emphasis"):
            t = f"*{t}*"
        if mark and cuts is not None and is_cut(w, cuts):
            t = f"[{t}]"
        parts.append(t)
    return " ".join(parts)


def parse_range(spec, n):
    spec = spec.translate(DIGITS).replace("إلى", "-").replace("الى", "-")
    spec = re.sub(r"[–—~]", "-", spec).replace("،", ",")
    out = set()
    for part in filter(None, (p.strip() for p in spec.split(","))):
        if "-" in part:
            a, b = (int(x) for x in part.split("-", 1))
            out.update(range(min(a, b), max(a, b) + 1))
        else:
            out.add(int(part))
    return sorted(i for i in out if 1 <= i <= n)


def cmd_summary(a):
    d = load(resolve(a.project))
    words, caps, allcuts = d.get("words", []), d.get("captions", []), d.get("cuts", [])
    dur = d.get("source", {}).get("duration") or 0.0
    out = output_duration(d)
    low = sum(1 for w in words if w.get("conf", 1) < LOW_CONF)
    print(f"project: {d.get('name') or resolve(a.project).parent.name}")
    print(f"source: {d.get('source', {}).get('path', '?')}  ·  language: {d.get('analysis', {}).get('language', '?')}")
    print(f"duration: {fmt(dur)}  →  after cuts: {fmt(out)}  (saved {dur - out:.1f} s)")
    print(f"words: {len(words)}  (low confidence < {LOW_CONF}: {low})")
    print(f"caption lines: {len(caps)}  ·  emphasized words: {sum(1 for w in words if w.get('emphasis'))}"
          f"  ·  zooms: {len(d.get('zooms', []))} ({sum(1 for z in d.get('zooms', []) if z.get('enabled'))} on)")
    print("cuts:")
    for r in ("silence", "filler", "retake", "manual"):
        cs = [c for c in allcuts if c.get("reason") == r]
        if not cs:
            continue
        on = [c for c in cs if c.get("enabled")]
        prop = [c for c in cs if c.get("proposed")]
        secs = sum(c["end"] - c["start"] for c in cs)
        print(f"  • {r}: {len(cs)} ({secs:.1f} s) — on {len(on)}, proposed {len(prop)}")
    st = d.get("style", {})
    print(f"style: {st.get('presetId')}  overrides={json.dumps(st.get('overrides', {}), ensure_ascii=False)}")


def cmd_captions(a):
    d = load(resolve(a.project))
    words, caps, cuts = word_map(d), d.get("captions", []), enabled_cuts(d)
    idx = parse_range(a.range, len(caps)) if a.range else range(1, len(caps) + 1)
    for i in idx:
        c = caps[i - 1]
        ws = [words[w] for w in c["wordIds"] if w in words]
        gone = ws and all(is_cut(w, cuts) for w in ws)
        head = f"#{i:<3} {c['id']:<6}"
        if a.times:
            o = to_output(c["start"], cuts)
            head += f" out {fmt(o)}  src {fmt(c['start'])}–{fmt(c['end'])}"
        tail = "  (fully cut)" if gone else ""
        if c.get("styleOverride") or c.get("position"):
            tail += "  (own style)"
        print(f"{head}  {caption_text(c, words, cuts)}{tail}")
    print("\n* = emphasized   [..] = inside an enabled cut")


def cmd_words(a):
    d = load(resolve(a.project))
    words = d.get("words", [])
    if a.caption:
        caps = d.get("captions", [])
        n = int(str(a.caption).translate(DIGITS))
        if not 1 <= n <= len(caps):
            sys.exit(f"✗ there is no line {n} ({len(caps)} lines)")
        ids = set(caps[n - 1]["wordIds"])
        words = [w for w in words if w["id"] in ids]
    if a.low_conf is not None:
        words = [w for w in words if w.get("conf", 1) < a.low_conf]
    if a.flag:
        words = [w for w in words if a.flag in w.get("flags", [])]
    cap_of = {wid: i for i, c in enumerate(d.get("captions", []), 1) for wid in c["wordIds"]}
    for w in words:
        extra = []
        if w.get("emphasis"):
            extra.append("emphasis")
        if w.get("flags"):
            extra.append(",".join(w["flags"]))
        if w.get("orig"):
            extra.append(f"was «{w['orig']}»")
        print(f"{w['id']:<7} {fmt(w['start'])}–{fmt(w['end'])}  conf {w.get('conf', 1):.2f}  "
              f"#{cap_of.get(w['id'], '-')!s:<4} {w['text']}  {' · '.join(extra)}")
    print(f"\n{len(words)} words", file=sys.stderr)


def cmd_cuts(a):
    d = load(resolve(a.project))
    cs = d.get("cuts", [])
    if a.reason:
        cs = [c for c in cs if c.get("reason") == a.reason]
    if a.proposed:
        cs = [c for c in cs if c.get("proposed")]
    for c in cs:
        state = "on" if c.get("enabled") else "off"
        if c.get("proposed"):
            state += "·proposed"
        print(f"{c['id']:<6} {c.get('reason', '?'):<8} {fmt(c['start'])}–{fmt(c['end'])} "
              f"({c['end'] - c['start']:.2f} s)  {state}  {c.get('note', '')}")
    print(f"\n{len(cs)} cuts, {sum(c['end'] - c['start'] for c in cs):.1f} s", file=sys.stderr)


# ---------------------------------------------------------------- validate

def validate(d):
    errors, warnings = [], []
    E, W = errors.append, warnings.append
    if d.get("version") != 1:
        E(f"version = {d.get('version')!r} (expected 1)")
    dur = d.get("source", {}).get("duration") or 0.0
    words, caps, cuts = d.get("words", []), d.get("captions", []), d.get("cuts", [])

    def check_ids(items, kind):
        seen = set()
        for it in items:
            i = it.get("id")
            if not i:
                E(f"{kind}: item without id")
            elif i in seen:
                E(f"{kind}: duplicate id {i}")
            seen.add(i)

    check_ids(words, "words")
    check_ids(caps, "captions")
    check_ids(cuts, "cuts")

    def check_span(it, kind):
        s, e = it.get("start"), it.get("end")
        if not isinstance(s, (int, float)) or not isinstance(e, (int, float)):
            E(f"{kind} {it.get('id')}: start/end are not numbers")
            return False
        if s >= e:
            E(f"{kind} {it.get('id')}: start ({s}) ≥ end ({e})")
        if s < -TIME_EPS or (dur and e > dur + TIME_EPS):
            E(f"{kind} {it.get('id')}: outside the source duration [{s}, {e}]")
        return True

    prev = -1.0
    for w in words:
        if not check_span(w, "word"):
            continue
        t = w.get("text", "")
        if not t:
            E(f"word {w.get('id')}: empty text")
        elif re.search(r"\s", t):
            E(f"word {w['id']}: contains a space «{t}» — split it into two words")
        elif BAD_CHARS.search(t) or BAD_TATWEEL.search(t):
            W(f"word {w['id']}: tatweel or invisible characters «{t}»")
        if w["start"] < prev - 1e-6:
            E(f"word {w['id']}: words are not in time order")
        prev = w["start"]
        conf = w.get("conf", 1)
        if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
            E(f"word {w['id']}: conf outside [0,1]")
        unknown = set(w.get("flags", [])) - WORD_FLAGS
        if unknown:
            W(f"word {w['id']}: unknown flags {sorted(unknown)}")

    pos = {w.get("id"): i for i, w in enumerate(words)}
    owner = {}
    prev = -1.0
    aspect = d.get("output", {}).get("aspect", "9:16")
    max_w, max_c = LINE_BUDGET.get(aspect, LINE_BUDGET["9:16"])
    wm = word_map(d)
    for n, c in enumerate(caps, 1):
        check_span(c, "caption")
        ids = c.get("wordIds", [])
        if not ids:
            E(f"caption #{n} {c.get('id')}: no words")
            continue
        missing = [i for i in ids if i not in pos]
        if missing:
            E(f"caption #{n} {c.get('id')}: missing words {missing}")
            continue
        idx = [pos[i] for i in ids]
        if idx != list(range(idx[0], idx[0] + len(idx))):
            E(f"caption #{n} {c['id']}: words not contiguous / in order")
        for i in ids:
            if i in owner:
                E(f"word {i}: in two lines ({owner[i]} and {c['id']})")
            owner[i] = c["id"]
        if isinstance(c.get("start"), (int, float)):
            if c["start"] < prev - 1e-6:
                E(f"caption #{n} {c['id']}: lines are not in time order")
            prev = c["start"]
        text = caption_text(c, wm, mark=False)
        if len(ids) > max_w or len(text) > max_c:
            W(f"caption #{n}: long for {aspect} ({len(ids)} words, {len(text)} chars) «{text}»")

    for a_, b_ in zip(caps, caps[1:]):
        if a_.get("end", 0) > b_.get("start", 0) + TIME_EPS:
            W(f"captions {a_.get('id')} and {b_.get('id')} overlap")

    ecuts = enabled_cuts(d)
    orphans = [w["id"] for w in words if w.get("id") not in owner and not is_cut(w, ecuts)]
    if orphans:
        W(f"{len(orphans)} words in no line: {orphans[:10]}{' …' if len(orphans) > 10 else ''}")

    for c in cuts:
        check_span(c, "cut")
        if c.get("reason") not in CUT_REASONS:
            E(f"cut {c.get('id')}: unknown reason {c.get('reason')!r}")
        if not isinstance(c.get("enabled"), bool):
            E(f"cut {c.get('id')}: enabled must be true/false")
    sc = sorted(cuts, key=lambda c: c.get("start", 0))
    for a_, b_ in zip(sc, sc[1:]):
        if a_.get("end", 0) > b_.get("start", 0) + TIME_EPS:
            W(f"cuts {a_.get('id')} and {b_.get('id')} overlap")

    preset = d.get("style", {}).get("presetId")
    pdir = next((d for d in PRESET_DIRS if (d / f"{preset}.json").exists()), PRESET_DIRS[0])
    if preset and pdir.is_dir() and not (pdir / f"{preset}.json").exists():
        W(f"style.presetId «{preset}» is not a known preset")
    if "letterSpacing" in json.dumps(d.get("style", {})):
        W("letterSpacing in the style — it breaks Arabic letter joining")
    return errors, warnings


def report(errors, warnings):
    for w in warnings:
        print(f"⚠ {w}")
    for e in errors:
        print(f"✗ {e}")
    if errors:
        print(f"\n✗ {len(errors)} errors, {len(warnings)} warnings")
    else:
        print(f"✓ valid ({len(warnings)} warnings)")
    return 1 if errors else 0


def cmd_validate(a):
    return report(*validate(load(resolve(a.project))))


# ---------------------------------------------------------------- diff

def cmd_diff(a):
    old, new = load(Path(a.old)), load(Path(a.new))
    ow, nw = word_map(old), word_map(new)
    out = []

    txt = [(i, ow[i]["text"], nw[i]["text"]) for i in ow if i in nw and ow[i]["text"] != nw[i]["text"]]
    added = [nw[i] for i in nw if i not in ow]
    removed = [ow[i] for i in ow if i not in nw]
    if txt or added or removed:
        out.append(f"── words: {len(txt)} edited, {len(added)} new, {len(removed)} removed/merged")
        for i, a_, b_ in txt:
            out.append(f"   {i:<7} {fmt(nw[i]['start'])}  {a_} → {b_}")
        for w in added:
            out.append(f"   + {w['id']:<5} {fmt(w['start'])}  {w['text']}" + (f"  (was «{w['orig']}»)" if w.get("orig") else ""))
        for w in removed:
            out.append(f"   - {w['id']:<5} {fmt(w['start'])}  {w['text']}")

    def diff_flag(label, get):
        on = [i for i in nw if get(nw[i]) and not (i in ow and get(ow[i]))]
        off = [i for i in ow if get(ow[i]) and not (i in nw and get(nw[i]))]
        if on or off:
            out.append(f"── {label}: +{len(on)} / -{len(off)}")
            if on:
                out.append("   + " + ", ".join(nw[i]["text"] for i in on))
            if off:
                out.append("   - " + ", ".join(ow[i]["text"] for i in off))

    diff_flag("emphasized", lambda w: w.get("emphasis"))
    diff_flag("fillers", lambda w: "filler" in w.get("flags", []))
    diff_flag("retakes", lambda w: "retake" in w.get("flags", []))

    oc, nc = old.get("captions", []), new.get("captions", [])
    olines = [caption_text(c, ow, mark=False) for c in oc]
    nlines = [caption_text(c, nw, mark=False) for c in nc]
    if olines != nlines:
        out.append(f"── lines: {len(oc)} → {len(nc)}")
        if a.full or len(nlines) <= 60:
            oldset = set(olines)
            for n, line in enumerate(nlines, 1):
                mark = " " if line in oldset else "~"
                out.append(f"   {mark} #{n:<3} {line}")

    ok = {c["id"]: c for c in old.get("cuts", [])}
    nk = {c["id"]: c for c in new.get("cuts", [])}
    cadd = [nk[i] for i in nk if i not in ok]
    crem = [ok[i] for i in ok if i not in nk]
    cchg = [(ok[i], nk[i]) for i in nk if i in ok and ok[i] != nk[i]]
    if cadd or crem or cchg:
        out.append(f"── cuts: +{len(cadd)} / -{len(crem)} / ~{len(cchg)}")
        for c in cadd:
            st = "proposed" if c.get("proposed") else ("on" if c.get("enabled") else "off")
            out.append(f"   + {c['id']:<5} {c.get('reason'):<7} {fmt(c['start'])}–{fmt(c['end'])}  {st}  {c.get('note', '')}")
        for c in crem:
            out.append(f"   - {c['id']:<5} {c.get('reason'):<7} {fmt(c['start'])}–{fmt(c['end'])}")
        for o, n in cchg:
            keys = [k for k in set(o) | set(n) if o.get(k) != n.get(k)]
            out.append(f"   ~ {n['id']:<5} " + ", ".join(f"{k}: {o.get(k)!r} → {n.get(k)!r}" for k in sorted(keys)))

    if old.get("style") != new.get("style"):
        out.append("── style:")
        out.append(f"   before: {json.dumps(old.get('style'), ensure_ascii=False)}")
        out.append(f"   after:  {json.dumps(new.get('style'), ensure_ascii=False)}")

    od, nd = output_duration(old), output_duration(new)
    if abs(od - nd) > 1e-6:
        out.append(f"── duration after cuts: {fmt(od)} → {fmt(nd)}")
    print("\n".join(out) if out else "no differences.")


# ---------------------------------------------------------------- history

def cmd_snapshot(a):
    print(f"✓ snapshot: {snapshot(resolve(a.project))}")


def cmd_restore(a):
    path = resolve(a.project)
    snaps = sorted(history_dir(path).glob("project.*.json"))
    if a.list or not (a.latest or a.file):
        for s in snaps:
            d = load(s)
            print(f"{s.name}  ({len(d.get('words', []))} words, {len(d.get('captions', []))} lines, {len(d.get('cuts', []))} cuts)")
        if not snaps:
            print("no snapshots.")
        return 0
    if a.latest:
        if not snaps:
            sys.exit("✗ no snapshots.")
        src = snaps[-1]
    else:
        src = Path(a.file)
        if not src.exists():
            src = history_dir(path) / a.file
    if not src.exists():
        sys.exit(f"✗ not found: {a.file}")
    data = load(src)
    current = snapshot(path)  # so the restore itself can be undone
    write_atomic(path, data)
    print(f"✓ restored {src.name}  (the state before is saved as {current.name})")


def cmd_save(a):
    staged, path = Path(a.staged), resolve(a.project)
    data = load(staged)
    errors, warnings = validate(data)
    if report(errors, warnings):
        sys.exit("✗ not saved — fix the errors first.")
    snap = snapshot(path)
    write_atomic(path, data)
    staged.unlink()
    print(f"✓ saved {path}  (previous version: {snap.name})")


# ---------------------------------------------------------------- cli

def main():
    ap = argparse.ArgumentParser(prog="project_tool", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("summary"); p.add_argument("project"); p.set_defaults(fn=cmd_summary)
    p = sub.add_parser("captions"); p.add_argument("project")
    p.add_argument("--range"); p.add_argument("--times", action="store_true"); p.set_defaults(fn=cmd_captions)
    p = sub.add_parser("words"); p.add_argument("project")
    p.add_argument("--low-conf", type=float, nargs="?", const=LOW_CONF)
    p.add_argument("--caption"); p.add_argument("--flag", choices=sorted(WORD_FLAGS)); p.set_defaults(fn=cmd_words)
    p = sub.add_parser("cuts"); p.add_argument("project")
    p.add_argument("--reason", choices=sorted(CUT_REASONS)); p.add_argument("--proposed", action="store_true")
    p.set_defaults(fn=cmd_cuts)
    p = sub.add_parser("validate"); p.add_argument("project"); p.set_defaults(fn=cmd_validate)
    p = sub.add_parser("diff"); p.add_argument("old"); p.add_argument("new")
    p.add_argument("--full", action="store_true"); p.set_defaults(fn=cmd_diff)
    p = sub.add_parser("snapshot"); p.add_argument("project"); p.set_defaults(fn=cmd_snapshot)
    p = sub.add_parser("restore"); p.add_argument("project"); p.add_argument("file", nargs="?")
    p.add_argument("--list", action="store_true"); p.add_argument("--latest", action="store_true")
    p.set_defaults(fn=cmd_restore)
    p = sub.add_parser("save"); p.add_argument("staged"); p.add_argument("project"); p.set_defaults(fn=cmd_save)

    a = ap.parse_args()
    sys.exit(a.fn(a) or 0)


if __name__ == "__main__":
    main()
