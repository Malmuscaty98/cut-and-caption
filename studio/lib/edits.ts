// Pure edit operations on a Project (mutating the draft passed by store.update).
import { newId } from "./store";
import type { Caption, Project } from "./types";

const snap = (t: number, fps: number, dir: "floor" | "ceil" | "round" = "round") => Math[dir](t * fps + (dir === "floor" ? 1e-6 : dir === "ceil" ? -1e-6 : 0)) / fps;

export function captionOfWord(p: Project, wordId: string) {
  return p.captions.findIndex((c) => c.wordIds.includes(wordId));
}

function refreshCaptionTimes(p: Project, c: Caption) {
  const ws = c.wordIds.map((id) => p.words.find((w) => w.id === id)).filter(Boolean);
  if (!ws.length) return;
  c.start = Math.min(c.start, ws[0]!.start);
  c.end = Math.max(c.end, ws[ws.length - 1]!.end);
}

/** Split caption so that `wordId` starts a new line. */
export function splitCaptionAt(p: Project, wordId: string) {
  const i = captionOfWord(p, wordId);
  if (i < 0) return false;
  const c = p.captions[i];
  const k = c.wordIds.indexOf(wordId);
  if (k <= 0) return false;
  const wmap = new Map(p.words.map((w) => [w.id, w]));
  const left = c.wordIds.slice(0, k);
  const right = c.wordIds.slice(k);
  const nc: Caption = {
    id: newId("c", p.captions),
    wordIds: right,
    start: wmap.get(right[0])!.start,
    end: c.end,
    styleOverride: c.styleOverride ? { ...c.styleOverride } : null,
    position: c.position ? { ...c.position } : null,
  };
  c.wordIds = left;
  c.end = wmap.get(left[left.length - 1])!.end;
  p.captions.splice(i + 1, 0, nc);
  return true;
}

export function mergeCaptionWithNext(p: Project, captionId: string) {
  const i = p.captions.findIndex((c) => c.id === captionId);
  if (i < 0 || i >= p.captions.length - 1) return false;
  const a = p.captions[i];
  const b = p.captions[i + 1];
  a.wordIds = [...a.wordIds, ...b.wordIds];
  a.end = Math.max(a.end, b.end);
  p.captions.splice(i + 1, 1);
  return true;
}

/** Manual cut over a word range (frame-snapped toward removing the words). */
export function cutWords(p: Project, wordIds: string[]) {
  const ws = p.words.filter((w) => wordIds.includes(w.id));
  if (!ws.length) return;
  const fps = p.output.fps;
  const start = snap(Math.min(...ws.map((w) => w.start)), fps, "floor");
  const end = snap(Math.max(...ws.map((w) => w.end)), fps, "ceil");
  p.cuts.push({ id: newId("k", p.cuts), start, end, reason: "manual", enabled: true, proposed: false, note: `قص يدوي: «${ws.map((w) => w.text).join(" ")}»` });
  p.cuts.sort((a, b) => a.start - b.start);
}

export function addCutRange(p: Project, start: number, end: number) {
  const fps = p.output.fps;
  const a = snap(Math.min(start, end), fps);
  const b = snap(Math.max(start, end), fps);
  if (b - a < 1 / fps) return null;
  const id = newId("k", p.cuts);
  p.cuts.push({ id, start: a, end: b, reason: "manual", enabled: true, proposed: false, note: "" });
  p.cuts.sort((x, y) => x.start - y.start);
  return id;
}

/** Edit a word's text; keeps timing, remembers what Whisper heard. Spaces → split into words. */
export function editWordText(p: Project, wordId: string, text: string) {
  const idx = p.words.findIndex((w) => w.id === wordId);
  if (idx < 0) return;
  const w = p.words[idx];
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || (parts.length === 1 && parts[0] === w.text)) return;
  if (w.orig == null) w.orig = w.text;
  if (parts.length === 1) {
    w.text = parts[0];
    w.flags = Array.from(new Set([...w.flags, "edited" as const]));
    return;
  }
  // Split: divide the word's time by character count.
  const total = parts.reduce((s, t) => s + t.length, 0);
  let t = w.start;
  const created = parts.map((txt, k) => {
    const dt = ((w.end - w.start) * txt.length) / total;
    const nw = { ...w, id: k === 0 ? w.id : newId("w", p.words), text: txt, start: +t.toFixed(3), end: +(t + dt).toFixed(3), flags: Array.from(new Set([...w.flags, "edited" as const])) };
    t += dt;
    if (k > 0) p.words.push(nw); // push first so newId sees it
    return nw;
  });
  p.words = p.words.filter((x) => !created.slice(1).some((c) => c.id === x.id));
  p.words.splice(idx, 1, ...created);
  const ci = captionOfWord(p, wordId);
  if (ci >= 0) {
    const c = p.captions[ci];
    const k = c.wordIds.indexOf(wordId);
    c.wordIds.splice(k, 1, ...created.map((x) => x.id));
  }
}

export function setOrToggle<T>(arr: T[], v: T, on: boolean) {
  const s = new Set(arr);
  if (on) s.add(v);
  else s.delete(v);
  return Array.from(s);
}

export { refreshCaptionTimes };

/**
 * Replace a caption's text, keeping timing where possible (CLAUDE.md §6 transcript editing).
 * Words are aligned by LCS: unchanged words keep their time; replaced words take the old word's
 * slot; new words borrow time from the gap around them or split a neighbour; removed words are
 * dropped from the caption text (the audio is untouched — cutting audio is a separate action).
 */
export function editCaptionText(p: Project, captionId: string, text: string) {
  const c = p.captions.find((x) => x.id === captionId);
  if (!c) return false;
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const wmap = new Map(p.words.map((w) => [w.id, w]));
  const old = c.wordIds.map((id) => wmap.get(id)!).filter(Boolean);

  // LCS on exact text
  const n = old.length;
  const m = tokens.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i][j] = old[i].text === tokens[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (old[i].text === tokens[j]) pairs.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  pairs.push([n, m]); // sentinel

  type Slot = { word?: (typeof old)[number]; text: string };
  const result: Slot[] = [];
  const removed: string[] = [];
  let pi = 0;
  let pj = 0;
  for (const [ai, aj] of pairs) {
    const oldRun = old.slice(pi, ai);
    const newRun = tokens.slice(pj, aj);
    const k = Math.min(oldRun.length, newRun.length);
    for (let x = 0; x < k; x++) result.push({ word: oldRun[x], text: newRun[x] }); // replaced
    for (let x = k; x < newRun.length; x++) result.push({ text: newRun[x] }); // inserted
    for (let x = k; x < oldRun.length; x++) removed.push(oldRun[x].id); // removed
    if (ai < n) result.push({ word: old[ai], text: tokens[aj] }); // unchanged
    pi = ai + 1;
    pj = aj + 1;
  }

  // Apply text changes to kept words.
  for (const s of result) {
    if (!s.word || s.word.text === s.text) continue;
    if (s.word.orig == null) s.word.orig = s.word.text;
    s.word.text = s.text;
    s.word.flags = Array.from(new Set([...s.word.flags, "edited" as const]));
  }

  // Time for inserted words: runs of new words between existing neighbours.
  const MIN = 0.06;
  for (let i = 0; i < result.length; ) {
    if (result[i].word) {
      i++;
      continue;
    }
    let j = i;
    while (j < result.length && !result[j].word) j++;
    const prev = result[i - 1]?.word;
    const next = result[j]?.word;
    const run = result.slice(i, j);
    let a = prev ? prev.end : Math.min(c.start, next ? next.start : c.start);
    let b = next ? next.start : Math.max(c.end, a);
    if (b - a < MIN * run.length) {
      // No room: split the neighbour (prefer the previous word) by characters.
      const host = prev ?? next!;
      const total = host.text.length + run.reduce((s, r) => s + r.text.length, 0);
      const cut = host.start + ((host.end - host.start) * host.text.length) / total;
      if (prev) {
        a = cut;
        b = host.end;
        host.end = +cut.toFixed(3);
      } else {
        a = host.start;
        b = cut;
        host.start = +cut.toFixed(3);
      }
    }
    const chars = run.reduce((s, r) => s + r.text.length, 0);
    let t = a;
    for (const r of run) {
      const dt = ((b - a) * r.text.length) / chars;
      const w = {
        id: newId("w", p.words),
        text: r.text,
        start: +t.toFixed(3),
        end: +(t + dt).toFixed(3),
        conf: 1,
        flags: ["inserted" as const],
        emphasis: false,
        orig: null,
      };
      t += dt;
      p.words.push(w);
      r.word = w;
    }
    i = j;
  }

  c.wordIds = result.map((r) => r.word!.id);
  const removedSet = new Set(removed);
  p.words = p.words.filter((w) => !removedSet.has(w.id)).sort((x, y) => x.start - y.start || x.end - y.end);
  const ws = c.wordIds.map((id) => p.words.find((w) => w.id === id)!);
  c.start = Math.min(c.start, ws[0].start);
  c.end = Math.max(c.end, ws[ws.length - 1].end);
  return true;
}

export function captionText(p: Project, c: Caption) {
  return c.wordIds.map((id) => p.words.find((w) => w.id === id)?.text ?? "").join(" ");
}
