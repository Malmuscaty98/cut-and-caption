"""Source time ↔ output time, given the enabled cuts."""


def merged(cuts):
    """Union of enabled cuts → sorted [[start, end]]."""
    iv = sorted((c["start"], c["end"]) for c in cuts if c.get("enabled"))
    out = []
    for s, e in iv:
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def to_output(t, cuts_merged):
    """Source → output time. Inside a cut, snaps to the cut's output position."""
    removed = 0.0
    for s, e in cuts_merged:
        if t >= e:
            removed += e - s
        elif t > s:
            return s - removed
        else:
            break
    return t - removed


def kept(duration, cuts_merged):
    """Kept source intervals [(start, end)] — what the render plays, in order."""
    out, t = [], 0.0
    for s, e in cuts_merged:
        if s > t:
            out.append((t, min(s, duration)))
        t = max(t, e)
    if t < duration:
        out.append((t, duration))
    return out


def output_duration(duration, cuts_merged):
    return sum(e - s for s, e in kept(duration, cuts_merged))
