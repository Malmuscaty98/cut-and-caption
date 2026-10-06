import fs from "node:fs";
import path from "node:path";
import { projectDir, readProject } from "@/lib/server-files";

export const dynamic = "force-dynamic";

const PEAKS_PER_SEC = 100;

// Peak envelope from the 16 kHz mono WAV the engine wrote (s16le). Cached next to it.
export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const dir = projectDir(name);
  const p = readProject(name);
  const wav = path.join(dir, p.source.audio);
  const cache = path.join(dir, "renders", "peaks.json");
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs > fs.statSync(wav).mtimeMs) {
    return new Response(fs.readFileSync(cache), { headers: { "Content-Type": "application/json" } });
  }
  const buf = fs.readFileSync(wav);
  // Find the "data" chunk (the header isn't always 44 bytes).
  let off = 12;
  let dataStart = 44;
  let dataLen = buf.length - 44;
  let rate = 16000;
  while (off < buf.length - 8) {
    const id = buf.toString("ascii", off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === "fmt ") rate = buf.readUInt32LE(off + 12);
    if (id === "data") {
      dataStart = off + 8;
      dataLen = Math.min(len, buf.length - dataStart);
      break;
    }
    off += 8 + len + (len % 2);
  }
  const n = Math.floor(dataLen / 2);
  const step = Math.max(1, Math.floor(rate / PEAKS_PER_SEC));
  const peaks: number[] = [];
  for (let i = 0; i < n; i += step) {
    let m = 0;
    for (let j = i; j < Math.min(n, i + step); j++) {
      const v = Math.abs(buf.readInt16LE(dataStart + j * 2));
      if (v > m) m = v;
    }
    peaks.push(Math.round((m / 32768) * 1000) / 1000);
  }
  const out = JSON.stringify({ perSec: rate / step, peaks });
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, out);
  return new Response(out, { headers: { "Content-Type": "application/json" } });
}
