"use client";
import { useCallback, useEffect, useRef } from "react";
import { cutWords, mergeCaptionWithNext, splitCaptionAt } from "@/lib/edits";
import { translate, useLangSync, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Preset, Project } from "@/lib/types";
import { useTimeline } from "./hooks";
import { Inspector } from "./Inspector";
import { PlayerPanel, player } from "./PlayerPanel";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { Transcript } from "./Transcript";

async function fetchProject(name: string) {
  const r = await fetch(`/api/projects/${encodeURIComponent(name)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { project: Project; mtime: number };
}

export function Editor({ name }: { name: string }) {
  useLangSync();
  const t = useT();
  const project = useStore((s) => s.project);
  const dirty = useStore((s) => s.dirty);
  const toast = useStore((s) => s.toast);
  const tl = useTimeline();
  const savingRef = useRef(false);

  // Load project + presets.
  useEffect(() => {
    (async () => {
      const [{ project, mtime }, presets] = await Promise.all([
        fetchProject(name),
        fetch("/api/presets").then((r) => r.json() as Promise<Preset[]>),
      ]);
      useStore.getState().load(name, project, mtime);
      useStore.setState({ presets });
    })().catch((e) => {
      const s = useStore.getState();
      s.notify(translate(s.lang, "shell.openFailed", { error: String(e) }));
    });
  }, [name]);

  // Autosave (debounced). On conflict (Claude wrote meanwhile) → take theirs, keep ours undoable.
  const save = useCallback(async () => {
    const s = useStore.getState();
    if (!s.project || !s.dirty || savingRef.current) return;
    savingRef.current = true;
    useStore.setState({ saving: true });
    const sent = s.project;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: sent, baseMtime: s.baseMtime }),
      });
      if (r.status === 409) {
        const fresh = await fetchProject(name);
        useStore.getState().replaceExternal(fresh.project, fresh.mtime);
      } else if (r.ok) {
        const { mtime } = await r.json();
        useStore.setState((st) => ({ baseMtime: mtime, dirty: st.project !== sent }));
      }
    } finally {
      savingRef.current = false;
      useStore.setState({ saving: false });
    }
  }, [name]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 500);
    return () => clearTimeout(t);
  }, [dirty, project, save]);

  // Hot-reload when project.json changes on disk (Claude editing from the chat).
  useEffect(() => {
    const es = new EventSource(`/api/projects/${encodeURIComponent(name)}/events`);
    es.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      // The server restarted with newer code than this tab is running → save, then reload.
      if (msg.type === "hello") {
        const mine = process.env.NEXT_PUBLIC_CUTCAPTION_BUILD;
        if (msg.build && mine && msg.build !== mine) {
          useStore.getState().notify(translate(useStore.getState().lang, "shell.newVersionReloading"));
          await save();
          window.location.reload();
        }
        return;
      }
      const s = useStore.getState();
      if (msg.type !== "project" || Math.abs(msg.mtime - s.baseMtime) < 2 || savingRef.current) return;
      const fresh = await fetchProject(name);
      if (Math.abs(fresh.mtime - useStore.getState().baseMtime) < 2) return;
      useStore.getState().replaceExternal(fresh.project, fresh.mtime);
    };
    return () => es.close();
  }, [name, save]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useStore.setState({ toast: null }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard (CLAUDE.md §6): Space, J/K/L, ←/→, S, M, Delete, ⌘Z / ⌘⇧Z, E, C.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;
      const s = useStore.getState();
      const p = s.project;
      if (!p || !tl) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod) return;
      const sel = s.selection;
      switch (key) {
        case " ":
          e.preventDefault();
          player.toggle(e as unknown as Parameters<typeof player.toggle>[0]);
          break;
        case "k":
          player.pause();
          break;
        case "l":
          player.play(player.rate() >= 1 ? Math.min(4, player.rate() * 2) : 1, e as unknown as Parameters<typeof player.toggle>[0]);
          break;
        case "j":
          player.play(player.rate() <= -1 ? Math.max(-4, player.rate() * 2) : -1, e as unknown as Parameters<typeof player.toggle>[0]);
          break;
        case "arrowleft":
        case "arrowright": {
          e.preventDefault();
          const d = (key === "arrowright" ? 1 : -1) * (e.shiftKey ? tl.fps : 1);
          player.pause();
          s.seek(Math.min(tl.durationInFrames - 1, Math.max(0, s.frame + d)));
          break;
        }
        case "s": {
          // Split the caption under the playhead at the word being spoken.
          const src = tl.outToSrc(s.frame) / tl.fps;
          const w = p.words.find((x) => src >= x.start && src < x.end) ?? p.words.find((x) => x.start >= src);
          if (w) s.update(translate(s.lang, "shell.splitLine"), (d) => void splitCaptionAt(d, w.id));
          break;
        }
        case "m":
          if (sel?.kind === "caption") s.update(translate(s.lang, "shell.mergeLines"), (d) => void mergeCaptionWithNext(d, sel.id));
          break;
        case "e":
          if (sel?.kind === "words")
            s.update(translate(s.lang, "shell.emphasize"), (d) => {
              const on = !d.words.find((w) => w.id === sel.ids[0])?.emphasis;
              d.words.forEach((w) => sel.ids.includes(w.id) && (w.emphasis = on));
            });
          break;
        case "c":
          if (sel?.kind === "words") {
            s.update(translate(s.lang, "shell.cutWords"), (d) => cutWords(d, sel.ids));
            s.select(null);
          }
          break;
        case "delete":
        case "backspace": {
          if (!sel) break;
          e.preventDefault();
          if (sel.kind === "cut") s.update(translate(s.lang, "shell.toggleCut"), (d) => d.cuts.forEach((c) => c.id === sel.id && ((c.enabled = !c.enabled), (c.proposed = false))));
          if (sel.kind === "zoom") s.update(translate(s.lang, "shell.deleteZoom"), (d) => void (d.zooms = d.zooms.filter((z) => z.id !== sel.id)));
          if (sel.kind === "words") s.update(translate(s.lang, "shell.cutWords"), (d) => cutWords(d, sel.ids));
          if (sel.kind !== "cut") s.select(null);
          break;
        }
        case "escape":
          s.select(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tl]);

  // Flush pending edits before leaving.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) {
        void save();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [save]);

  if (!project) return <div style={{ padding: 40 }}>{t("shell.loading")}</div>;
  return (
    <div className="editor">
      <TopBar />
      <Inspector />
      <PlayerPanel />
      <Transcript />
      <Timeline />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
