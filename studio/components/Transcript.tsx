"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cutWords, editWordText, splitCaptionAt } from "@/lib/edits";
import { useT } from "@/lib/i18n";
import { contentDir } from "@/lib/lang";
import { fmtTime, useStore } from "@/lib/store";
import { activeCaption } from "@/lib/timeline";
import { useTimeline } from "./hooks";
import { LineEditor } from "./LineEditor";

export function Transcript() {
  const project = useStore((s) => s.project)!;
  const selection = useStore((s) => s.selection);
  const frame = useStore((s) => s.frame);
  const playing = useStore((s) => s.playing);
  const t = useT();
  const tl = useTimeline()!;
  const [editing, setEditing] = useState<string | null>(null);
  const [lineEditing, setLineEditing] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const order = useMemo(() => new Map(project.words.map((w, i) => [w.id, i])), [project.words]);
  const status = useMemo(() => {
    const m = new Map<string, { cut: boolean; proposed: boolean }>();
    for (const w of project.words) {
      const mid = (w.start + w.end) / 2;
      const cs = project.cuts.filter((c) => mid >= c.start && mid < c.end);
      m.set(w.id, { cut: cs.some((c) => c.enabled), proposed: cs.some((c) => c.proposed && !c.enabled) });
    }
    return m;
  }, [project.words, project.cuts]);

  const cur = activeCaption(tl, frame);
  const srcNow = tl.outToSrc(frame) / tl.fps;
  const selWords = selection?.kind === "words" ? new Set(selection.ids) : new Set<string>();

  useEffect(() => {
    if (!playing || !cur) return;
    listRef.current?.querySelector(`[data-cap="${cur.caption.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur?.caption.id, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const seekWord = (id: string) => {
    const w = project.words.find((x) => x.id === id);
    if (!w) return;
    const f = Math.round(w.start * tl.fps);
    const out = tl.srcToOut(f) ?? tl.srcToOut(f + 1) ?? tl.captions.find((c) => c.words.some((x) => x.word.id === id))?.from ?? 0;
    useStore.getState().seek(out);
  };

  const clickWord = (e: React.MouseEvent, id: string) => {
    const s = useStore.getState();
    if (e.shiftKey && anchor.current) {
      const a = order.get(anchor.current)!;
      const b = order.get(id)!;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      s.select({ kind: "words", ids: project.words.slice(lo, hi + 1).map((w) => w.id) });
      return;
    }
    anchor.current = id;
    s.select({ kind: "words", ids: [id] });
    seekWord(id);
  };

  const upd = useStore.getState().update;
  const ids = selection?.kind === "words" ? selection.ids : [];
  const selectedAreCut = ids.length > 0 && ids.every((id) => status.get(id)?.cut);

  return (
    <div className="transcript" ref={listRef}>
      <div className="panel-title">
        {t("timeline.transcript")}
        <span className="muted" style={{ fontWeight: 400 }}>
          {t("timeline.lines", { lines: project.captions.length, words: project.words.length })}
        </span>
      </div>
      {ids.length ? (
        <div className="section" style={{ position: "sticky", top: 37, zIndex: 2, background: "var(--panel-2)" }}>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <span className="muted">{t("timeline.selectedWords", { n: ids.length })}</span>
            {selectedAreCut ? (
              <button
                onClick={() =>
                  upd(t("timeline.uncut"), (d) => {
                    const ws = d.words.filter((w) => ids.includes(w.id));
                    d.cuts.forEach((c) => {
                      if (c.enabled && ws.some((w) => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 < c.end)) {
                        c.enabled = false;
                        c.proposed = false;
                      }
                    });
                  })
                }
              >
                {t("timeline.restoreWords")}
              </button>
            ) : (
              <button onClick={() => upd(t("timeline.cutWords"), (d) => cutWords(d, ids))}>
                {t("timeline.cut")} <span className="kbd">C</span>
              </button>
            )}
            <button onClick={() => upd(t("timeline.emphasize"), (d) => {
              const on = !d.words.find((w) => w.id === ids[0])?.emphasis;
              d.words.forEach((w) => ids.includes(w.id) && (w.emphasis = on));
            })}>
              {t("timeline.emphasize")} <span className="kbd">E</span>
            </button>
            <button onClick={() => upd(t("timeline.newLine"), (d) => void splitCaptionAt(d, ids[0]))}>{t("timeline.newLineHere")}</button>
            <button title={t("timeline.kashidaTitle")} onClick={() => upd(t("timeline.kashida"), (d) => d.words.forEach((w) => ids.includes(w.id) && (w.kashida = !w.kashida)))}>
              {t("timeline.kashida")}
            </button>
          </div>
        </div>
      ) : null}
      {project.captions.map((c, i) => {
        const isCur = cur?.caption.id === c.id;
        const isSel = selection?.kind === "caption" && selection.id === c.id;
        return (
          <div key={c.id} data-cap={c.id} className={`cap-row${isCur ? " active" : ""}${isSel ? " selected" : ""}`}>
            <div className="cap-num" title={t("timeline.lineNumTitle", { time: fmtTime(c.start) })} onClick={() => useStore.getState().select({ kind: "caption", id: c.id })} onDoubleClick={() => setLineEditing(c.id)}>
              {i + 1}
              <div className="line-edit-btn" title={t("timeline.editLineTitle")} onClick={(e) => { e.stopPropagation(); setLineEditing(c.id); }}>✎</div>
              {c.styleOverride || c.position ? <div title={t("timeline.customStyle")}>◆</div> : null}
            </div>
            {lineEditing === c.id ? (
              <LineEditor captionId={c.id} onDone={() => setLineEditing(null)} />
            ) : (
            <div className="cap-words" dir={contentDir(project)}>
              {c.wordIds.map((id) => {
                const w = project.words.find((x) => x.id === id);
                if (!w) return null;
                const st = status.get(id)!;
                if (editing === id) {
                  return (
                    <input
                      key={id}
                      className="w-edit"
                      autoFocus
                      defaultValue={w.text}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.target as HTMLInputElement).value;
                          upd(t("timeline.editWord"), (d) => editWordText(d, id, v));
                          setEditing(null);
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== w.text) upd(t("timeline.editWord"), (d) => editWordText(d, id, v));
                        setEditing(null);
                      }}
                    />
                  );
                }
                const cls = [
                  "w",
                  w.conf < 0.6 || w.flags.includes("low_conf") ? "low" : "",
                  st.cut ? "cut" : "",
                  st.proposed ? "proposed" : "",
                  w.emphasis ? "emph" : "",
                  selWords.has(id) ? "sel" : "",
                  srcNow >= w.start && srcNow < w.end ? "now" : "",
                ].join(" ");
                const tip = [
                  t("timeline.wordInfo", { time: fmtTime(w.start), conf: w.conf.toFixed(2) }),
                  w.orig ? `Whisper: «${w.orig}»` : "",
                  st.proposed ? t("timeline.proposedCut") : "",
                  t("timeline.doubleClickToEdit"),
                ]
                  .filter(Boolean)
                  .join("\n");
                return (
                  <span key={id}>
                    <span className={cls} title={tip} onClick={(e) => clickWord(e, id)} onDoubleClick={() => setEditing(id)}>
                      {w.text}
                    </span>{" "}
                  </span>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
