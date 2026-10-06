// qass srt — captions in OUTPUT time, from the same timeline the video renders with.
//   tsx scripts/srt.ts <project> [--out file.srt]
import fs from "node:fs";
import path from "node:path";
import { buildTimeline } from "../lib/timeline";
import { resolveProject } from "../lib/server-files";

const [name, ...rest] = process.argv.slice(2);
if (!name) {
  console.error("usage: srt.ts <project> [--out file.srt]");
  process.exit(2);
}
const { dir, project: p } = resolveProject(name);
const tl = buildTimeline(p, "output");
const ts = (f: number) => {
  const ms = Math.round((f / tl.fps) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
const blocks = tl.captions.map((c, i) => {
  const text = c.words.filter((w) => !w.cut).map((w) => w.word.text).join(" ");
  // RTL lines (Arabic, Hebrew…): RLE…PDF keeps mixed RTL/Latin text in order in players that ignore
  // paragraph direction. LTR lines are written as they are.
  const rtl = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text);
  return `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${rtl ? `\u202B${text}\u202C` : text}\n`;
});
const oi = rest.indexOf("--out");
const out = oi >= 0 ? rest[oi + 1] : path.join(dir, "renders", `${p.name}.srt`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, blocks.join("\n"), "utf-8");
console.log(JSON.stringify({ msg: `✓ ${out} (${blocks.length} lines)`, out, done: true }));
