import fs from "node:fs";
import { projectDir, projectFile } from "@/lib/server-files";

export const dynamic = "force-dynamic";

// Server-sent events: tells the editor when project.json changes on disk —
// e.g. when Claude edits the project from the chat. The client ignores its own writes by mtime.
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const dir = projectDir(name);
  const file = projectFile(name);
  const enc = new TextEncoder();
  let watcher: fs.FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const stop = () => {
    closed = true;
    watcher?.close();
    if (timer) clearTimeout(timer);
    if (ping) clearInterval(ping);
  };

  const stream = new ReadableStream({
    start(controller) {
      // The browser can disconnect at any moment; never enqueue into a closed stream.
      const push = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          stop();
        }
      };
      const send = (data: unknown) => push(`data: ${JSON.stringify(data)}\n\n`);
      send({ type: "hello", build: process.env.NEXT_PUBLIC_CUTCAPTION_BUILD });
      // Watch the folder: atomic writes replace the file, which breaks a file-level watch.
      watcher = fs.watch(dir, { recursive: true }, (_ev, f) => {
        const fn = String(f ?? "");
        if (fn !== "project.json") return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            send({ type: "project", mtime: fs.statSync(file).mtimeMs });
          } catch {
            /* file mid-replace */
          }
        }, 120);
      });
      ping = setInterval(() => push(": ping\n\n"), 20_000);
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
