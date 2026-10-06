"""First-pass caption lines. Claude's review pass regroups them properly (skill review-pass §5)."""

BUDGET = {"9:16": (4, 22), "1:1": (6, 28), "16:9": (8, 42)}   # (max words, max chars); 9:16 = one line (brand v2)
BREAK_AFTER = tuple(".!؟?،,؛:")
HARD_GAP = 0.50     # always break at a pause this long (source time)


def group(words, segments, aspect="9:16"):
    max_words, max_chars = BUDGET.get(aspect, BUDGET["9:16"])
    bounds = [s["start"] for s in segments[1:]]
    lines, cur = [], []
    for w in words:
        if cur:
            prev = cur[-1]
            text_len = len(" ".join(x["text"] for x in cur + [w]))
            crosses = any(prev["end"] <= b <= w["start"] + 0.05 for b in bounds)
            if (len(cur) >= max_words or text_len > max_chars or w["start"] - prev["end"] >= HARD_GAP
                    or crosses or (prev["text"].endswith(BREAK_AFTER) and len(cur) >= 2)):
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return [{"id": f"c{i}", "wordIds": [w["id"] for w in ln], "start": ln[0]["start"], "end": ln[-1]["end"],
             "styleOverride": None, "position": None} for i, ln in enumerate(lines, 1)]
