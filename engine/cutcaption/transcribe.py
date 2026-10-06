"""Word-level transcription.

- Apple Silicon Macs: mlx-whisper (Metal GPU) — large-v3 by default.
- Intel Macs and Windows/Linux PCs: faster-whisper — an NVIDIA GPU is used when its CUDA
  libraries load, otherwise the CPU (int8); large-v3-turbo by default because large-v3 is slow on
  a CPU. CUTCAPTION_WHISPER=mlx|faster forces a backend.
"""
import json
import os
import platform

from .paths import GLOSSARY

APPLE_SILICON = platform.system() == "Darwin" and platform.machine() == "arm64"
MLX_MODELS = {
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "medium": "mlx-community/whisper-medium-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "tiny": "mlx-community/whisper-tiny-mlx",
}
MODEL_SIZE_GB = {"large-v3": 3.1, "large-v3-turbo": 1.6, "medium": 1.5, "small": 0.5, "base": 0.15, "tiny": 0.08}
APPEND_PUNCT = "\"'.。,，!！?？:：”)]}、،؛؟"
PUNCT_ONLY = set(APPEND_PUNCT + "«»-–— ")


def backend():
    forced = os.environ.get("CUTCAPTION_WHISPER")
    if forced in ("mlx", "faster"):
        return forced
    return "mlx" if APPLE_SILICON else "faster"


def default_model():
    return "large-v3" if backend() == "mlx" else "large-v3-turbo"


def glossary_prompt(language=None, limit=40):
    """Bias spelling toward the user's terms (product names, people, religious phrases…)."""
    if not GLOSSARY.exists():
        return None
    terms = [t["text"] for t in json.loads(GLOSSARY.read_text(encoding="utf-8")).get("terms", [])][:limit]
    if not terms:
        return None
    if language == "ar":
        return "في هذا الفيديو نتكلم عن " + "، ".join(terms) + "."
    return "Glossary: " + ", ".join(terms) + "."


def _mlx(wav, model, language, prompt):
    import mlx_whisper
    res = mlx_whisper.transcribe(
        str(wav), path_or_hf_repo=MLX_MODELS.get(model, model), language=language, word_timestamps=True,
        initial_prompt=prompt, condition_on_previous_text=False, hallucination_silence_threshold=2.0,
        append_punctuations=APPEND_PUNCT, verbose=None)
    words = [(w["word"], w["start"], w["end"], w.get("probability", 1.0))
             for seg in res["segments"] for w in seg.get("words", [])]
    return words, res.get("language") or language


def _wav_samples(wav):
    import wave

    import numpy as np
    with wave.open(str(wav), "rb") as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError(f"{wav}: expected 16 kHz mono 16-bit PCM")
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm.astype(np.float32) / 32768.0


def _faster(wav, model, language, prompt):
    from faster_whisper import WhisperModel
    m = None
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            m = WhisperModel(model, device="cuda", compute_type="float16")
    except Exception:
        m = None  # no usable CUDA (driver / cuBLAS / cuDNN missing) → CPU
    if m is None:
        m = WhisperModel(model, device="cpu", compute_type="int8")
    # Hand it the samples: faster-whisper's own file decoding calls PyAV with an argument newer PyAV
    # releases removed. audio16k.wav is already 16 kHz mono PCM, exactly what Whisper wants.
    segs, info = m.transcribe(_wav_samples(wav), language=language, word_timestamps=True, initial_prompt=prompt,
                              condition_on_previous_text=False, vad_filter=False,
                              append_punctuations=APPEND_PUNCT)
    words = [(w.word, w.start, w.end, w.probability) for seg in segs for w in seg.words or []]
    return words, info.language or language


def transcribe(wav, model=None, language=None, prompt=None):
    """→ (words, language). `language` None = detect."""
    model = model or default_model()
    raw, lang = (_mlx if backend() == "mlx" else _faster)(wav, model, language, prompt)
    words = []
    for text, start, end, conf in raw:
        text = text.strip()
        if not text:
            continue
        if all(ch in PUNCT_ONLY for ch in text) and words:
            words[-1]["text"] += text  # stray punctuation → previous word
            continue
        parts = text.split()  # Whisper occasionally emits "a b" as one token
        end = max(end, start + 0.02 * len(parts))
        total, t = sum(len(p) for p in parts), start
        for part in parts:  # split its time by character count
            dt = (end - start) * len(part) / total
            words.append({"text": part, "start": round(t, 3), "end": round(t + dt, 3), "conf": round(float(conf), 3)})
            t += dt
    return words, lang
