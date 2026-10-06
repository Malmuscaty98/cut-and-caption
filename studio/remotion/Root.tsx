import React from "react";
import { Composition, registerRoot } from "remotion";
import { buildTimeline } from "../lib/timeline";
import { DEFAULT_STYLE } from "../lib/style";
import type { Project, CaptionedVideoProps } from "../lib/types";
import { CaptionedVideo } from "./CaptionedVideo";

const EMPTY: Project = {
  version: 1,
  name: "empty",
  source: { path: "", duration: 1, fps: 25, width: 1080, height: 1920, proxy: "", audio: "", segments: [] },
  output: { aspect: "9:16", width: 1080, height: 1920, fps: 25 },
  words: [],
  captions: [],
  cuts: [],
  style: { presetId: "classic", overrides: {} },
  zooms: [],
};

const Root: React.FC = () => (
  <Composition
    id="CaptionedVideo"
    component={CaptionedVideo}
    width={1080}
    height={1920}
    fps={25}
    durationInFrames={25}
    defaultProps={{ project: EMPTY, style: DEFAULT_STYLE, media: { video: "" }, view: "output" } satisfies CaptionedVideoProps}
    calculateMetadata={({ props }) => {
      const tl = buildTimeline(props.project, props.view);
      return { durationInFrames: tl.durationInFrames, fps: tl.fps, width: props.project.output.width, height: props.project.output.height };
    }}
  />
);

registerRoot(Root);
