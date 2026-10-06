"""Merge acoustic silences with word timings → silence cuts.

Acoustic silence is exact; Whisper word edges are ±100 ms. So word edges that spill into a
silence are pulled back to it, and a word Whisper heard *inside* a silence (quiet speech) is
carved out of that silence and flagged for review — a cut never silently deletes a word.
"""
import math


def _mid(w):
    return (w["start"] + w["end"]) / 2


def _speech_pieces(start, end, silences):
    """Parts of [start, end] not covered by any silence → [(s, e, bounded_left, bounded_right)]."""
    pieces, t, left = [], start, False
    for a, b in silences:
        if b <= t or a >= end:
            continue
        if a > t:
            pieces.append((t, a, left, True))
        t, left = max(t, b), True
    if t < end:
        pieces.append((t, end, left, False))
    return pieces


def reconcile(words, silences, pad):
    """Snap word spans to acoustic speech; return silences with quiet words carved out.

    Whisper words are gap-less, so a pause is usually swallowed by the *next* word (or the
    previous one). Each word keeps its longest acoustic speech piece (+pad into the silence);
    a word with no speech at all was said quietly → keep it, carve it out, flag it.
    """
    quiet = []
    for w in words:
        pieces = _speech_pieces(w["start"], w["end"], silences)
        if not pieces:
            quiet.append(w)
            w["flags"] = sorted(set(w.get("flags", [])) | {"low_conf"})
            w["conf"] = round(min(w["conf"], 0.5), 3)
            continue
        s, e, bl, br = max(pieces, key=lambda p: p[1] - p[0])
        w["start"] = round(max(w["start"], s - pad) if bl else s, 3)
        w["end"] = round(min(w["end"], e + pad) if br else e, 3)
    out = []
    for a, b in silences:
        t = a
        for w in sorted((w for w in quiet if a <= w["start"] and w["end"] <= b), key=lambda w: w["start"]):
            if w["start"] - pad > t:
                out.append((t, w["start"] - pad))
            t = max(t, w["end"] + pad)
        if b > t:
            out.append((t, b))
    return out


def silence_cuts(silences, duration, words, pad, min_speech, fps, min_len=0.04):
    """Cuts are snapped to the frame grid, rounding toward keeping speech, so video and audio
    are cut at exactly the same instants (no A/V drift across many cuts)."""
    spans = []
    for a, b in silences:
        s = 0.0 if a <= 0.001 else math.ceil((a + pad) * fps - 1e-6) / fps
        e = duration if b >= duration - 0.001 else math.floor((b - pad) * fps + 1e-6) / fps
        if e - s >= min_len:
            spans.append([s, e])
    merged = []
    for s, e in spans:                                        # swallow micro-islands with no words
        if merged and s - merged[-1][1] < min_speech and not any(merged[-1][1] <= _mid(w) < s for w in words):
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [{"id": f"k{i}", "start": round(s, 3), "end": round(e, 3), "reason": "silence",
             "enabled": True, "proposed": False, "note": ""} for i, (s, e) in enumerate(merged, 1)]
