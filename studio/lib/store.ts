"use client";
import { create } from "zustand";
import { translate } from "./i18n";
import { initialLang, type Lang } from "./lang";
import type { Preset, Project } from "./types";

export type Selection =
  | { kind: "caption"; id: string }
  | { kind: "cut"; id: string }
  | { kind: "zoom"; id: string }
  | { kind: "words"; ids: string[] }
  | null;

interface State {
  name: string;
  project: Project | null;
  presets: Preset[];
  baseMtime: number;
  past: Project[];
  future: Project[];
  dirty: boolean;
  saving: boolean;
  lastLabel: string;
  selection: Selection;
  view: "output" | "source";
  guides: boolean;
  frame: number; // output frame (or source frame in source view)
  seekTo: number | null; // request for the player
  playing: boolean;
  pxPerSec: number;
  toast: string | null;
  lang: Lang;

  load: (name: string, project: Project, mtime: number) => void;
  update: (label: string, fn: (p: Project) => void) => void;
  replaceExternal: (project: Project, mtime: number) => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  set: (s: Partial<State>) => void;
  seek: (frame: number) => void;
  notify: (msg: string) => void;
}

const MAX_HISTORY = 300;

export const useStore = create<State>((set, get) => ({
  name: "",
  project: null,
  presets: [],
  baseMtime: 0,
  past: [],
  future: [],
  dirty: false,
  saving: false,
  lastLabel: "",
  selection: null,
  view: "output",
  guides: false,
  frame: 0,
  seekTo: null,
  playing: false,
  pxPerSec: 60,
  toast: null,
  // The editor is browser-only (no SSR), so the saved / browser language can be read right away.
  lang: typeof window === "undefined" ? "ar" : initialLang(),

  load: (name, project, mtime) => set({ name, project, baseMtime: mtime, past: [], future: [], dirty: false, selection: null }),

  // Every edit goes through here: snapshot for undo, mutate a copy, mark dirty (autosave picks it up).
  update: (label, fn) => {
    const cur = get().project;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    set((s) => ({
      project: next,
      past: [...s.past.slice(-MAX_HISTORY + 1), cur],
      future: [],
      dirty: true,
      lastLabel: label,
    }));
  },

  // Claude (or another tool) changed project.json on disk: take it, but keep it undoable.
  replaceExternal: (project, mtime) => {
    const cur = get().project;
    set((s) => ({
      project,
      baseMtime: mtime,
      past: cur ? [...s.past.slice(-MAX_HISTORY + 1), cur] : s.past,
      future: [],
      dirty: false,
      toast: translate(s.lang, "shell.externalChange"),
    }));
  },

  undo: () => {
    const { past, project } = get();
    if (!past.length || !project) return;
    set((s) => ({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...s.future], dirty: true, lastLabel: translate(s.lang, "shell.undo") }));
  },
  redo: () => {
    const { future, project } = get();
    if (!future.length || !project) return;
    set((s) => ({ project: future[0], future: future.slice(1), past: [...s.past, project], dirty: true, lastLabel: translate(s.lang, "shell.redo") }));
  },

  select: (selection) => set({ selection }),
  set: (s) => set(s),
  seek: (frame) => set({ seekTo: Math.max(0, Math.round(frame)), frame: Math.max(0, Math.round(frame)) }),
  notify: (toast) => set({ toast }),
}));

/**
 * Live edits (typing, dragging): every change shows immediately in the preview and is autosaved,
 * but the whole gesture is ONE undo step. `apply` always starts from the state at `begin`.
 */
export function beginLiveEdit() {
  const before = useStore.getState().project!;
  let changed = false;
  return {
    apply(fn: (p: Project) => void) {
      const next = structuredClone(before);
      fn(next);
      changed = true;
      useStore.setState({ project: next, dirty: true });
    },
    commit(label: string) {
      if (!changed) return;
      useStore.setState((s) => ({ past: [...s.past, before], future: [], lastLabel: label, dirty: true }));
    },
    cancel() {
      useStore.setState({ project: before, dirty: true });
    },
  };
}

export function newId(prefix: string, taken: { id: string }[]) {
  const nums = taken.map((x) => parseInt(x.id.replace(/^\D+/, ""), 10)).filter((n) => !isNaN(n));
  return `${prefix}${Math.max(0, ...nums) + 1}`;
}

export const fmtTime = (sec: number) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
