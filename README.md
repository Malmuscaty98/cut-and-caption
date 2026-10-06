# Cut & Caption · قص وكابشن

*من محمد المسقطي · by Mohammed Almuscaty*

**قص السكتات، كابشن دقيق كلمة بكلمة، وزوم — لفيديوهات التصوير المباشر (Reels · TikTok · Shorts)، مع محرر تتحكم فيه بكل التفاصيل. كل شي يشتغل على جهازك.**

*Cut silences, add precise word-level captions and punch-in zooms to talking-head videos, then fine-tune everything in a local editor. Everything runs on your computer.* — [English below](#english)

---

## وش يسوي؟

| الميزة | التفاصيل |
|---|---|
| **قص السكتات** | يقص السكوت الصوتي فقط ولا يقص أي حرف — إعداد «مشدود» أو «طبيعي»، وتعدّل كل قصة بالسحب |
| **كابشن دقيق** | تفريغ Whisper بتوقيت كل كلمة + مراجعة Claude (إملاء، مصطلحاتك، الحشو، تقسيم الأسطر). كل لغات Whisper، والعربي بكل اللهجات يُعرض صح |
| **زوم** | زوم مباشر يتبدّل عند القصات، وزوم ناعم على الكلمات المهمة — وتعدّله على مسار الزوم |
| **المحرر** | معاينة، نص قابل للتعديل، Timeline (قصات · كابشن · زوم)، خط وألوان ومكان وحركة الكابشن، تراجع/إعادة — الواجهة بالعربي أو الإنجليزي |
| **التصدير** | MP4 بجودة عالية (H.264 · BT.709) + ملف SRT، بمقاسات 9:16 · 4:5 · 1:1 · 16:9 |

**الخصوصية:** الفيديو والصوت ما يطلعون من جهازك أبداً. النص المفرّغ فقط يمر على Claude لأنه هو اللي يراجعه — مثل أي محادثة في Claude Code.

## المتطلبات

- [Claude Code](https://claude.com/claude-code)
- **Mac** (Apple Silicon أو Intel، macOS 13 أو أحدث) أو **Windows 10/11** (x64)
- حوالي **5 GB** مساحة، وإنترنت لأول تثبيت فقط
- [uv](https://docs.astral.sh/uv/) — Cut & Caption يطلب منك تثبيته بسطر واحد إذا مو موجود

## التثبيت

داخل Claude Code (الصفحة: [malmuscaty-site.vercel.app/cut-and-caption](https://malmuscaty-site.vercel.app/cut-and-caption)):

```
/plugin marketplace add https://malmuscaty-site.vercel.app/plugins/marketplace.json
/plugin install cut-and-caption@malmuscaty
```

أو مباشرة من GitHub: `/plugin marketplace add Malmuscaty98/cut-and-caption` ثم نفس أمر التثبيت.

وبعدها قول لـ Claude مثلاً: «قص السكتات وأضف كابشن لهذا الفيديو: ~/Desktop/video.mp4».
أول مرة يجهّز كل شي (٢–٥ دقائق) ويستأذنك قبل تحميل نموذج التفريغ:

| الجهاز | النموذج | الحجم | السرعة التقريبية لفيديو دقيقة |
|---|---|---|---|
| Mac Apple Silicon | large-v3 (Metal) | ~3.1 GB | ٢٠–٤٠ ثانية |
| Mac Intel / Windows | large-v3-turbo (CPU) | ~1.6 GB | ١–٣ دقائق (أسرع مع كرت NVIDIA) |

## الاستخدام

قول اللي تبيه بكلامك:
- «احذف السكوت وخلّه طبيعي» · «أضف كابشن» · «حط زوم عند القصات» · «صدّر للتيك توك»
- «صحح السطر ٧» · «كبّر الخط» · «نزّل الكابشن شوي» · «زوم على كلمة …»

أو افتح المحرر: «افتح المحرر» → `http://127.0.0.1:4318`. المشاريع والفيديوهات النهائية في
`~/Movies/Cut and Caption/projects` (Mac) أو `~\Videos\Cut and Caption\projects` (Windows).

---

## English

### What it does
- **Silence cuts** — only acoustic silence is cut, never a word; tight / natural presets; drag any cut.
- **Precise captions** — Whisper word timings + Claude's review (spelling, your glossary, fillers,
  line breaks). Any language Whisper knows; Arabic (every dialect) renders correctly.
- **Zooms** — hard punch-ins alternating at the cuts, smooth pushes on key words; edit them on the zoom track.
- **Editor** — preview, editable transcript, timeline (cuts · captions · zooms), caption font /
  colours / position / animation, auto contrast on light backgrounds, undo / redo. Arabic or English UI
  (one click in the top bar).
- **Export** — H.264 / BT.709 MP4 + SRT, 9:16 · 4:5 · 1:1 · 16:9.

Your video and audio never leave your computer; only the transcript text is shared with Claude
(it does the review), like anything else in a Claude Code conversation.

### Requirements & install
Claude Code · macOS 13+ (Apple Silicon or Intel) or Windows 10/11 x64 · ~5 GB disk · [uv](https://docs.astral.sh/uv/)
(Cut & Caption offers the one-line install if it's missing).

```
/plugin marketplace add https://malmuscaty-site.vercel.app/plugins/marketplace.json
/plugin install cut-and-caption@malmuscaty
```

(or straight from GitHub: `/plugin marketplace add Malmuscaty98/cut-and-caption`, then the same install command).
Then ask Claude, e.g. "cut the silences and caption ~/Desktop/video.mp4". The first run installs
the editor (2–5 min) and asks before downloading the speech model (large-v3 ~3.1 GB on Apple
Silicon; large-v3-turbo ~1.6 GB elsewhere).

### Where things are
- Projects and exports: `~/Movies/Cut and Caption/projects` (macOS), `~\Videos\Cut and Caption\projects` (Windows) — `CUTCAPTION_HOME` to change.
- Your glossary: `<Cut and Caption folder>/glossary.json` · your saved caption styles: `<Cut and Caption folder>/presets/`.
- The editor runs at `http://127.0.0.1:4318` (`CUTCAPTION_PORT` to change) and only accepts connections from this computer.

### Troubleshooting
- `uv` not found → macOS: `curl -LsSf https://astral.sh/uv/install.sh | sh` · Windows:
  `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`, then restart Claude Code.
- Windows: if transcription fails to start, install the
  [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).
- Check everything: ask Claude to run `cut-and-caption doctor`. Editor log: `<data folder>/studio.log`.

### Development
`CUTCAPTION_DEV=1 CUTCAPTION_DATA=.dev/data CUTCAPTION_HOME=.dev/home bin/cut-and-caption setup` installs into the repo
(`studio/node_modules`) and `bin/cut-and-caption studio` then runs `next dev`. CI (`.github/workflows/smoke.yml`)
runs setup → analyze → zoom → render → editor on an Apple-Silicon Mac, an Intel Mac and Windows.

### License
Cut & Caption is MIT (see `LICENSE`). It installs third-party software on your machine, under their own
licenses — see `NOTICE.md`. **Remotion** (the video engine) is free for individuals, non-profits
and companies of up to 3 people; larger companies need a [Remotion company license](https://www.remotion.pro).
