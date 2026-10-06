import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { FONT_FILES } from "../lib/style";

let loaded = false;

// Same TTF files in the studio preview and the render (CLAUDE.md §1) — never system fonts.
export function ensureFonts() {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  for (const f of FONT_FILES) {
    loadFont({ family: f.family, url: staticFile(f.file), weight: String(f.weight), display: "block" }).catch((e) =>
      console.error(`font ${f.file} failed`, e),
    );
  }
}
