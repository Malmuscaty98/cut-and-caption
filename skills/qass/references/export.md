# Export

```bash
Q render <slug> [--aspect 9:16|4:5|1:1|16:9] [--draft]
```

What it makes: the editor's own composition rendered frame by frame — H.264 High, BT.709 (the
colour standard phones and editors use), lossless PNG frame capture (sharp caption edges),
x264 "slow", CRF 17 capped at 20 Mb/s, the source frame rate. Sound: with no cuts, the original
audio stream is copied untouched; with cuts, the original sound is joined with 12 ms fades at
every cut (no clicks). Next to the MP4: an `.srt` in output time and a `.project.json` snapshot.
`--draft` renders from the preview copy, fast, for checking only.

## Platforms

| Platform | Size | Notes |
|---|---|---|
| Instagram Reels | 1080×1920 (9:16) | turn on **Settings → Data usage and media quality → Upload at highest quality** in the app, or Instagram compresses harder |
| TikTok | 1080×1920 | enable "Upload HD" / high-quality upload when posting |
| YouTube Shorts | 1080×1920 | ≤ 3 min |
| Feed / LinkedIn | 1080×1350 (4:5) or 1080×1080 | `--aspect 4:5` / `1:1` re-frames by centre crop |
| YouTube | 1920×1080 (16:9) | `--aspect 16:9` for a landscape source |

Safe areas: the editor's «حدود Reels» toggle shades where the platform UI covers the video (top bar,
caption/buttons at the bottom and right). Keep captions inside the dashed box.

## Checks before you hand it over

- The render line reports size, fps, bitrate and colour (`bt709`) — say them.
- If the user changed captions after the last render, render again.
- Uploading a 60 fps source? Fine — the export keeps the source frame rate.
