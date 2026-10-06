# Conversational edits

Every edit: **resolve → `PJ snapshot` → edit → `PJ validate` → tell the user before → after.**
Numbers the user gives may be Arabic-Indic («٥–١٢») — `PJ` accepts them.

## Resolving what the user means

| The user says | Resolve with |
|---|---|
| "lines 5–12", «السطر ٧» | `PJ captions <slug> --range 5-12` (1-based, output order) |
| "at 1:20" | `PJ captions <slug> --times` → the line covering that **output** time (the editor's clock) |
| "the word X" | `PJ words <slug>` + search; several matches → list them and ask |
| "the words you weren't sure about" | `PJ words <slug> --low-conf 0.6` |
| "the suggestions / fillers / retakes" | `PJ cuts <slug> --proposed` / `--reason filler` / `--reason retake` |

## Recipes

**Fix lines 5–12** — review-pass step 1 on those lines only; show before → after; don't regroup.
**X should be Y** — edit the word (`orig` + `edited`); offer to add it to the glossary.
**Emphasize the key words** — review-pass step 4; **emphasize / un-emphasize X** — toggle `emphasis`.
**Split line 7 / merge 7 and 8 / new line at X** — review-pass step 5 rules unless they name the word.

**Apply the suggestions** — `enabled: true, proposed: false` on proposed cuts (all, or the
reason / range named); report the time saved (`PJ summary` before and after).
**Don't cut X** — the proposed cut covering X → `enabled: false, proposed: false`; drop the flag.
**Cut 1:20–1:25** — output → source time (walk the enabled cuts), add
`{ reason: "manual", enabled: true, proposed: false }`; say which words it removes.
**More / fewer silence cuts** — `Q recut <slug> --preset natural` (looser) or `--min-silence 0.15
--padding 0.03` (tighter). It never cuts a word; manual / filler / retake cuts stay.

**Font, size, colours, position** — `style.overrides` (`fontFamily`: bundled `IBM Plex Sans Arabic`
or `Tajawal` only; `fontSize`; `textColor`; `position.y` ±0.03–0.05 for "a bit lower/higher";
`box` for a background box; `animation`: `none` | `word-highlight` | `word-pop` | `line-fade` |
`box-follow`). One line only → `captions[i].styleOverride` / `captions[i].position`.
**Captions unreadable on a white shirt / bright wall** — auto contrast is on by default
(`style.autoContrast`); lower its `threshold` (e.g. 0.45) or set that line's `textColor`.
**Use / save a style** — `style.presetId`; the editor's «احفظ كـ preset» saves the user's own.

**More / less zoom** — `scale` on the zooms ±0.05; **no zooms** → `Q zoom <slug> --clear` or
`zooms = []`; **zoom on X** → a `smooth` zoom from 0.35 s before the word to 0.9 s after.

**Square / landscape / 4:5 export** — `Q render <slug> --aspect 1:1 | 16:9 | 4:5`.

**Undo** — `PJ restore <slug> --latest`; "go back to before the review" → `PJ restore <slug> --list`,
pick by time, confirm with the user. In the editor: ⌘Z / Ctrl+Z.

## Writing project.json safely

Atomic write (the editor's watcher must never see half a file): write a temp file in the same
folder, then rename over `project.json` — or stage `project.review.json` and `PJ save` it.
