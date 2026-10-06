// cut-and-caption render — the same Remotion composition the editor previews, rendered to MP4 / stills.
//   tsx scripts/render.ts <project name or folder> [--out file.mp4] [--stills 0,50,100] [--view source]
//                         [--proxy] [--muted] [--crf 17] [--aspect 9:16] [--frames 0-250] [--progress-json]
// The engine (cut-and-caption render) runs it with --muted and adds the sound itself afterwards.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { buildTimeline } from "../lib/timeline";
import { resolveStyle } from "../lib/style";
import { MIME, readPresets, resolveProject, safeJoin, STUDIO_DIR } from "../lib/server-files";
import type { CaptionedVideoProps } from "../lib/types";

const args = process.argv.slice(2);
const name = args[0];
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i > 0 ? args[i + 1] : undefined;
};
const flag = (k: string) => args.includes(k);
if (!name) {
  console.error("usage: render.ts <project> [--out f.mp4] [--stills 0,50] [--view source] [--proxy] [--muted]");
  process.exit(2);
}
const jsonProgress = flag("--progress-json");
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  jsonProgress ? console.log(JSON.stringify({ msg, ...extra })) : console.log(msg);

// Tiny range-capable file server so headless Chrome can stream the project's media.
function serve(dirs: Record<string, string>): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    try {
      const u = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      const [, mount, ...rest] = u.split("/");
      const base = dirs[mount];
      if (!base) throw new Error("404");
      const file = safeJoin(base, rest.join("/"));
      const stat = fs.statSync(file);
      const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Accept-Ranges", "bytes");
      if (range) {
        const start = range[1] ? +range[1] : 0;
        const end = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${stat.size}` });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size });
        fs.createReadStream(file).pipe(res);
      }
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    }),
  );
}

async function main() {
  const { dir, project } = resolveProject(name);
  const aspectOpt = opt("--aspect") as "9:16" | "16:9" | "1:1" | "4:5" | undefined;
  if (aspectOpt && aspectOpt !== project.output.aspect) {
    const size = { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1080, 1080], "4:5": [1080, 1350] }[aspectOpt];
    project.output = { ...project.output, aspect: aspectOpt, width: size[0], height: size[1] };
  }
  const view = (opt("--view") as "output" | "source") ?? "output";
  const style = resolveStyle(readPresets(), project.style.presetId, project.style.overrides);
  const srv = await serve({ p: dir });
  const inputProps: CaptionedVideoProps = {
    project,
    style,
    view,
    media: { video: `${srv.url}/p/${flag("--proxy") ? project.source.proxy : project.source.path}`, muted: flag("--muted") },
  };

  log("• bundling the composition…");
  const serveUrl = await bundle({
    entryPoint: path.join(STUDIO_DIR, "remotion", "Root.tsx"),
    publicDir: path.join(STUDIO_DIR, "public"),
    outDir: path.join(STUDIO_DIR, ".remotion-bundle"),
  });
  const composition = await selectComposition({ serveUrl, id: "CaptionedVideo", inputProps });
  const outDir = path.join(dir, "renders");
  fs.mkdirSync(outDir, { recursive: true });

  const stills = opt("--stills");
  if (stills) {
    for (const f of stills.split(",").map(Number)) {
      const out = path.join(outDir, "stills", `frame-${String(f).padStart(5, "0")}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await renderStill({ composition, serveUrl, inputProps, frame: f, output: out });
      log(`  ✓ ${out}`);
    }
    srv.close();
    return;
  }

  const tl = buildTimeline(project, view);
  const aspect = project.output.aspect.replace(":", "x");
  const out = opt("--out") ?? path.join(outDir, `${project.name}-${aspect}${flag("--proxy") ? "-draft" : ""}.mp4`);
  const range = opt("--frames")?.split("-").map(Number) as [number, number] | undefined;
  log(`• rendering ${tl.durationInFrames} frames (${(tl.durationInFrames / tl.fps).toFixed(1)} s)…`);
  const t0 = Date.now();
  let last = -1;
  // Made for social platforms (they re-encode everything; a clean, correctly tagged master survives
  // it best): BT.709 like phones and editors export (Remotion v4 defaults to BT.601), lossless PNG
  // frame capture (the default JPEG q80 softens text edges), x264 "slow", CRF 17 with a 20 Mb/s
  // ceiling (Reels/TikTok/Shorts land around 8–12 Mb/s for a talking head).
  const crf = Number(opt("--crf") ?? 17);
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    crf,
    x264Preset: flag("--proxy") ? "veryfast" : "slow",
    colorSpace: "bt709",
    imageFormat: flag("--proxy") ? "jpeg" : "png",
    jpegQuality: 95,
    encodingMaxRate: "20M",
    encodingBufferSize: "40M",
    pixelFormat: "yuv420p",
    muted: flag("--muted"),
    audioCodec: "aac",
    audioBitrate: "320k",
    outputLocation: out,
    frameRange: range,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        log(`  ${pct}%`, { progress });
      }
    },
  });
  srv.close();
  log(`✓ ${out}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`, { done: true, out });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
