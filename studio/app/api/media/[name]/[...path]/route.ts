import fs from "node:fs";
import path from "node:path";
import { MIME, projectDir, safeJoin } from "@/lib/server-files";

export const dynamic = "force-dynamic";

/** File range as a web stream with backpressure. Browsers abort media requests all the time
 *  (seeks, premounts); Readable.toWeb then throws "Controller is already closed" as an
 *  uncaught exception. Here an abort just destroys the file stream. */
function fileStream(file: string, start: number, end: number): ReadableStream<Uint8Array> {
  let rs: fs.ReadStream | null = null;
  let done = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      rs = fs.createReadStream(file, { start, end });
      rs.on("data", (chunk) => {
        if (done) return;
        try {
          controller.enqueue(new Uint8Array(chunk as Buffer));
          if ((controller.desiredSize ?? 1) <= 0) rs?.pause();
        } catch {
          done = true;
          rs?.destroy();
        }
      });
      rs.on("end", () => {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {
          /* consumer already gone */
        }
      });
      rs.on("error", (e) => {
        if (done) return;
        done = true;
        try {
          controller.error(e);
        } catch {
          /* consumer already gone */
        }
      });
    },
    pull() {
      rs?.resume();
    },
    cancel() {
      done = true;
      rs?.destroy();
    },
  });
}

// Range-capable file server for the project's media (proxy, mix, assets). Local only.
export async function GET(req: Request, ctx: { params: Promise<{ name: string; path: string[] }> }) {
  const { name, path: parts } = await ctx.params;
  let file: string;
  try {
    file = safeJoin(projectDir(name), parts.map(decodeURIComponent).join("/"));
  } catch {
    return new Response("bad path", { status: 400 });
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? Math.min(+range[2], size - 1) : size - 1;
    if (start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(fileStream(file, start, end), { status: 206, headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` } });
  }
  return new Response(fileStream(file, 0, size - 1), { headers: { ...headers, "Content-Length": String(size) } });
}
