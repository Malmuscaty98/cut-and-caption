# Third-party software

Cut & Caption's own code is MIT-licensed. It doesn't ship these projects — `cut-and-caption setup` installs them on
your machine from their usual registries (PyPI, npm, Hugging Face), each under its own license:

| Component | Used for | License |
|---|---|---|
| [Remotion](https://www.remotion.dev) (`remotion`, `@remotion/*`) | the editor preview and the video render | Remotion License — free for individuals, non-profits and for-profit organizations with up to 3 people; larger companies need a company license (remotion.pro) |
| [Next.js](https://nextjs.org), [React](https://react.dev), [zustand](https://github.com/pmndrs/zustand) | the editor | MIT |
| [OpenAI Whisper](https://github.com/openai/whisper) model weights | speech recognition | MIT |
| [mlx-whisper](https://github.com/ml-explore/mlx-examples) / [MLX](https://github.com/ml-explore/mlx) | transcription on Apple Silicon | MIT |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) / [CTranslate2](https://github.com/OpenNMT/CTranslate2) | transcription on Intel Macs and Windows | MIT |
| [FFmpeg](https://ffmpeg.org) via [imageio-ffmpeg](https://github.com/imageio/imageio-ffmpeg) | decoding, encoding, silence detection | FFmpeg: LGPL / GPL (static build with x264); imageio-ffmpeg: BSD-2 |
| [PyAV](https://github.com/PyAV-Org/PyAV) | reading media metadata | BSD-3 (bundles FFmpeg libraries, LGPL) |
| [Node.js](https://nodejs.org) via [nodejs-wheel](https://github.com/njzjz/nodejs-wheel) | running the editor | MIT |
| [NumPy](https://numpy.org), [huggingface_hub](https://github.com/huggingface/huggingface_hub) | engine | BSD-3 / Apache-2.0 |
| [Chrome Headless Shell](https://developer.chrome.com/blog/chrome-headless-shell) (downloaded by Remotion) | rendering frames | BSD-3 (Chromium) |

Bundled in this repository:

| Component | License |
|---|---|
| IBM Plex Sans Arabic fonts (`studio/public/fonts/IBMPlexSansArabic-*.ttf`) | SIL Open Font License 1.1 (`OFL-IBMPlexSansArabic.txt`) |
| Tajawal fonts (`studio/public/fonts/Tajawal-*.ttf`) | SIL Open Font License 1.1 (`OFL-Tajawal.txt`) |
