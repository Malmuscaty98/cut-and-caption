"use client";
import { useEffect, useRef, useState } from "react";
import { captionText, editCaptionText } from "@/lib/edits";
import { useT } from "@/lib/i18n";
import { beginLiveEdit, useStore } from "@/lib/store";
import { contentDir } from "@/lib/lang";

/** Edit a whole caption line as text — add, remove or change words; the preview updates live. */
export function LineEditor({ captionId, onDone, autoFocus = true, rows = 2 }: { captionId: string; onDone?: () => void; autoFocus?: boolean; rows?: number }) {
  const project = useStore((s) => s.project)!;
  const t = useT();
  const c = project.captions.find((x) => x.id === captionId);
  const [value, setValue] = useState(() => (c ? captionText(project, c) : ""));
  const session = useRef<ReturnType<typeof beginLiveEdit> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in sync when the line changes from elsewhere (and we're not typing).
  useEffect(() => {
    if (!session.current && c) setValue(captionText(project, c));
  }, [project, c]);

  if (!c) return null;

  const change = (v: string) => {
    setValue(v);
    session.current ??= beginLiveEdit();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => session.current?.apply((p) => void editCaptionText(p, captionId, v)), 120);
  };
  const finish = (keep: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    const s = session.current;
    session.current = null;
    if (s) {
      if (keep) {
        s.apply((p) => void editCaptionText(p, captionId, value));
        s.commit(t("timeline.editLineText"));
      } else s.cancel();
    }
    onDone?.();
  };

  return (
    <textarea
      dir={project ? contentDir(project) : "auto"}
      rows={rows}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => change(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
        if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      style={{ width: "100%", fontSize: 15, lineHeight: 1.7, resize: "vertical" }}
      title={t("timeline.lineEditorTitle")}
    />
  );
}
