# Zooms

A zoom scales the whole frame around a centre point for a stretch of time. Two kinds:

| mode | look | made by |
|---|---|---|
| `cut` | hard punch-in for the whole piece, switching wide ↔ tight at the cuts — the classic jump-cut rhythm | `Q zoom <slug>` at the cuts, or drawn on the zoom track |
| `smooth` | an eased push in (0.35 s), hold, ease out — draws attention to a word | `Q zoom <slug>` on emphasized words |

```bash
Q zoom <slug> --apply                      # both kinds, switched on
Q zoom <slug> --apply --no-emphasis        # only at the cuts
Q zoom <slug> --apply --no-cuts            # only on emphasized words (mark them first)
Q zoom <slug> --scale 1.15 --y 0.32 --every 3 --apply
Q zoom <slug> --clear --apply              # start over
```

- `--every 2` (default) punches in every other piece between cuts; `3` is calmer, `1` zooms every
  piece (only makes sense with a varying scale — usually not). Pieces < 0.6 s stay wide.
- `--scale`: 1.15–1.25 for cut zooms (1.2 default), 1.08–1.15 for emphasis pushes (1.12 default).
  Above ~1.35 a 1080p phone shot gets soft.
- `--x` / `--y`: the centre, 0–1 of the frame. Talking head: x 0.5, y 0.30–0.40 (the face). Look at
  a frame if unsure; the user can drag the sliders in «الزوم» or per zoom in the Inspector.
- Without `--apply` new zooms are **proposed** (dashed on the track; «اقبل الزوم المقترح» accepts).
  Zooms the user drew or edited by hand are kept; regenerating replaces earlier automatic ones.
- No cuts in the video → cut zooms have nothing to alternate on: use emphasis pushes, or draw
  zooms on the track.

In `project.json`: `zooms[] = { id, start, end, scale, x, y, mode, reason, enabled, proposed }`,
source seconds (they follow cuts automatically). Edit by hand for anything the CLI doesn't do —
e.g. «زوم أكثر على الجملة ٧» → find the caption's time span, add or adjust a zoom there.
