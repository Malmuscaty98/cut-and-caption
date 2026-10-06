# Review pass — turning a raw transcript into precise captions

You do this yourself after `analyze`. Output: a **staged** file `project.review.json` (next to
`project.json`) and a short summary in the user's language; nothing is saved until they agree.

Order matters: **1 spelling & glossary → 2 fillers → 3 retakes → 4 emphasis → 5 lines.**
Read the whole transcript first (`PJ captions <slug> --times`) — most errors only show in context.
The language is in `analysis.language`.

## 1. Spelling, dialect, glossary

**Fix the spelling, keep the speaker's words.** Never translate dialect into the standard
language, never "improve" grammar, never paraphrase.

- **Glossary** (`<Qass folder>/glossary.json`, `PJ` prints its path in `summary`): every
  `variants` match → the term's `text`. Product names, people, places, religious phrases.
  When the user corrects a name, offer to add it to the glossary so it's right next time.
- **Arabic** (any dialect — Gulf, Levantine, Egyptian, Maghrebi, Iraqi…):
  - Whisper "standardizes" dialect: restore what was said when timing/context make it clear
    (الحين not الآن, شنو not ماذا, ايش, شو, ازاي, بزاف…). If unsure, keep Whisper's word.
  - Orthography: hamza (إن / أن، إلى، أيضاً، مسؤول), ة / ه and ى / ي at word ends, split / merged
    words («ان شاء الله» → «إن شاء الله»: 3 words, split the timing by characters).
  - Religious phrases canonical: الله، إن شاء الله، الحمد لله، سبحان الله، صلى الله عليه وسلم.
  - English said in English stays Latin (ChatGPT, iPhone, API); arabized words stay Arabic.
  - A one-letter prefix on a Latin word or number keeps a tatweel joiner: بـChatGPT، لـiPhone، بـ20%.
    No other tatweel, no zero-width or bidi characters in word text.
- **English / other languages:** proper nouns, numbers and casing; keep contractions and slang.
- **Numbers:** digits for quantities, prices, versions («3 خطوات», «$250», «5.5») — Whisper often
  splits «5.5» into «5» + «.5» or «$» + «250»: merge them into one word (first start, last end).
  Spoken numbers that are part of an expression stay words («ولا مرة», "once or twice").

Editing mechanics (timing is sacred):
- Text change only → keep `start`/`end`; set `orig` (if null) and flag `edited`.
- Merge N words → one word: first `start`, last `end`, lowest `conf`, new id; fix `wordIds`.
- Split a word → divide its time by character count; `orig` on each; flag `edited`.
- A word Whisper missed → only when sure; take time from the neighbours' gap; flag `inserted`, `conf: 0`.

## 2. Fillers — propose, never apply

| Language | Usual fillers |
|---|---|
| Arabic (all) | اممم، إمم، آآ، اه، ها، يعني (as a pause) |
| Gulf | شلون أقول، شنو اسمه، شسمه، خلني أقول، ترى (as a tic) |
| Levantine | يعني، هيك (as a tic)، شو اسمه، بتعرف |
| Egyptian | يعني، بص، إيه ده، أصل |
| English | um, uh, er, like (as a tic), you know, I mean, basically, kind of |

Context decides: «يعني» introducing an explanation is content; before a pause or a restart it's
a filler. Pure vocalizations are always fillers. For each one: flag the word `filler` and add a cut
`{ reason: "filler", enabled: false, proposed: true, note: "filler: «…»" }` over the word (swallow
an adjacent short pause). Multi-word fillers get one cut. Leave the words in their caption lines.

## 3. Retakes — propose, never apply

Same 2+ opening words again within ~10 s, an abandoned clause then a cleaner restart, or a
spoken restart cue ("let me say that again", «خلني أعيد», «من جديد»). Keep the **last complete
take**; one cut `{ reason: "retake", enabled: false, proposed: true, note: "retake: «…» — keeping the last" }`
from the first attempt's first word to the last attempt word (never into the kept take). Flag
`retake`. If the earlier take is better, propose the reverse and say why.

## 4. Emphasis (it also drives the emphasis zooms)

The words a viewer must catch with the sound off: key nouns, numbers, names, the verb that
carries the point. 10–20 % of lines get one, never more than one per line (two only for a name).
Never fillers, prepositions or pronouns. Set `emphasis: true`.

## 5. Caption lines

Rebuild `captions` from the edited words. Budget per line:

| aspect | words | ~chars | lines |
|---|---|---|---|
| 9:16 | 2–4 (max 5) | 26 | 1–2 |
| 4:5 · 1:1 | 4–6 | 28 | 1–2 |
| 16:9 | 5–8 | 42 | 1–2 |

1. Never split a word, a name, or a fixed phrase («إن شاء الله», "New York").
2. Break at pauses ≥ 0.3 s; always at ≥ 0.7 s; at clause ends and after «؟» / "?".
3. Keep together: noun + its adjective, إضافة (مضاف + مضاف إليه), preposition + its noun, number +
   counted noun, a negation + its verb, article + noun (English).
4. Don't end a line on a preposition or conjunction; don't start one with a lone connector.
5. On screen ≥ 0.6 s; shorter → merge with a neighbour.
6. Words inside a *proposed* cut stay in their natural line; words inside an *enabled* cut
   shouldn't exist — report it.

Keep a caption's id when its words are unchanged, otherwise mint `cN` (next free number);
`start`/`end` from its words.

## What to show the user (in their language)

```
Review of «<name>»:
• spelling / dialect: 14 words (e.g. الان → الحين)
• glossary: 3 (ChatGPT, …)
• fillers proposed: 9 (≈ 4.2 s) — off until you say yes
• retakes proposed: 2 (≈ 6.8 s)
• emphasized words: 11 · lines: 38 → 41
Unsure: «…» at 01:05 (low confidence). Save?
```
