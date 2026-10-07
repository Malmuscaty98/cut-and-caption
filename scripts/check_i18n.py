#!/usr/bin/env python3
"""Every UI string key used in the editor exists in both the Arabic and the English dictionary,
and no Arabic text is left hard-coded in the UI code. Stdlib only; run from the repo root:

    python3 scripts/check_i18n.py
"""
import re
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parents[1] / "studio"
DICTS = STUDIO / "lib" / "i18n"
UI = [STUDIO / "components", STUDIO / "app", STUDIO / "lib"]
KEY = re.compile(r'"([a-z]+\.[A-Za-z0-9_.]+)"\s*:')
USE = re.compile(r'''\b(?:t|translate\([^,()]+,)\s*\(?\s*["']([a-z]+\.[A-Za-z0-9_.]+)["']''')
ARABIC = re.compile(r"[\u0600-\u06FF]")
COMMENT = re.compile(r"^\s*(//|\*|/\*)")
# Arabic that is code, not UI text: text-shaping helpers, and the product's own bilingual name.
CODE_FILES = {"style.ts", "server-files.ts", "Captions.tsx"}
NAME = "قص وكابشن"


def dict_keys():
    ar, en = set(), set()
    for f in DICTS.glob("*.ts"):
        text = f.read_text(encoding="utf-8")
        parts = re.split(r"\ben\s*:\s*{", text, maxsplit=1)
        if len(parts) != 2:
            sys.exit(f"✗ {f.name}: expected an `ar: {{…}}` block followed by an `en: {{…}}` block")
        ar |= set(KEY.findall(parts[0]))
        en |= set(KEY.findall(parts[1]))
    return ar, en


def main():
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to cp1252, which has no ✓/✗
        stream.reconfigure(encoding="utf-8")
    ar, en = dict_keys()
    problems = []
    for k in sorted(ar - en):
        problems.append(f"missing in en: {k}")
    for k in sorted(en - ar):
        problems.append(f"missing in ar: {k}")
    used = set()
    for root in UI:
        for f in root.rglob("*.ts*"):
            if f.parent == DICTS or f.name in ("i18n.ts",):
                continue
            for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                used |= set(USE.findall(line))
                if ARABIC.search(line.replace(NAME, "")) and not COMMENT.match(line) and f.name not in CODE_FILES:
                    # Arabic inside regexes / character classes (word splitting) is code, not UI text.
                    if not re.search(r"\\u06|[\[]?[؀-ۿ]-[؀-ۿ]|/[^/]*[؀-ۿ][^/]*/[a-z]*[,;)]", line):
                        problems.append(f"hard-coded Arabic: {f.relative_to(STUDIO)}:{n}: {line.strip()[:90]}")
    for k in sorted(used - (ar & en)):
        problems.append(f"used but not defined: {k}")
    if problems:
        print("\n".join(problems))
        print(f"✗ {len(problems)} problem(s)")
        return 1
    print(f"✓ {len(used)} keys used, {len(ar)} defined in both languages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
