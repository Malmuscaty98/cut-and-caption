"use client";
import { useMemo } from "react";
import { buildTimeline } from "@/lib/timeline";
import { resolveStyle } from "@/lib/style";
import { useStore } from "@/lib/store";

export function useTimeline() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  return useMemo(() => (project ? buildTimeline(project, view) : null), [project, view]);
}

export function useResolvedStyle() {
  const project = useStore((s) => s.project);
  const presets = useStore((s) => s.presets);
  return useMemo(() => (project ? resolveStyle(presets, project.style.presetId, project.style.overrides) : null), [project, presets]);
}

/** Source seconds of the playhead (works in both views). */
export function usePlayheadSec() {
  const tl = useTimeline();
  const frame = useStore((s) => s.frame);
  if (!tl) return 0;
  return tl.outToSrc(frame) / tl.fps;
}
