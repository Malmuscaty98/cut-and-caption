import { spawn } from "node:child_process";
import { engineCommand, projectDir, ROOT } from "@/lib/server-files";

export const dynamic = "force-dynamic";

type Job = { cmd: string; status: "running" | "done" | "error"; log: string[]; progress: number; out?: string; started: number };
const g = globalThis as unknown as { __qassJobs?: Map<string, Job> };
const jobs = (g.__qassJobs ??= new Map());

const COMMANDS: Record<string, (name: string, opts: Record<string, string | boolean>) => string[]> = {
  recut: (n, o) => [
    "recut",
    n,
    ...(o.preset ? ["--preset", String(o.preset)] : []),
    ...(["threshold", "min-silence", "padding", "min-speech"] as const).flatMap((k) => (o[k] != null && o[k] !== "" ? [`--${k}`, String(o[k])] : [])),
  ],
  render: (n, o) => ["render", n, ...(o.aspect ? ["--aspect", String(o.aspect)] : []), ...(o.draft ? ["--draft"] : [])],
  srt: (n) => ["srt", n],
  shots: (n) => ["shots", n],
  zoom: (n, o) => [
    "zoom",
    n,
    ...(o.cuts === false ? ["--no-cuts"] : []),
    ...(o.emphasis === false ? ["--no-emphasis"] : []),
    ...(o.apply ? ["--apply"] : []),
    ...(o.clear ? ["--clear"] : []),
    ...(["scale", "x", "y", "every"] as const).flatMap((k) => (o[k] != null && o[k] !== "" ? [`--${k}`, String(o[k])] : [])),
  ],
};

export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  return Response.json(jobs.get(name) ?? null);
}

// Runs the engine CLI for this project and keeps its progress for polling.
export async function POST(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  projectDir(name); // validates the name
  const { cmd, opts = {} } = (await req.json()) as { cmd: string; opts?: Record<string, string | boolean> };
  const build = COMMANDS[cmd];
  if (!build) return Response.json({ error: "unknown command" }, { status: 400 });
  const cur = jobs.get(name);
  if (cur?.status === "running") return Response.json({ error: "busy", job: cur }, { status: 409 });

  const job: Job = { cmd, status: "running", log: [], progress: 0, started: Date.now() };
  jobs.set(name, job);
  const [exe, args] = engineCommand([...build(name, opts), "--progress-json"]);
  const child = spawn(exe, args, { cwd: ROOT, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }, windowsHide: true, shell: exe.endsWith(".cmd") });
  const onLine = (line: string) => {
    if (!line.trim()) return;
    try {
      const j = JSON.parse(line);
      if (typeof j.progress === "number") job.progress = j.progress;
      if (j.out) job.out = j.out;
      if (j.msg) job.log.push(j.msg);
    } catch {
      job.log.push(line);
    }
    if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
  };
  let buf = "";
  const feed = (d: Buffer) => {
    buf += d.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    lines.forEach(onLine);
  };
  child.stdout.on("data", feed);
  child.stderr.on("data", feed);
  child.on("close", (code) => {
    onLine(buf);
    job.status = code === 0 ? "done" : "error";
    if (code === 0) job.progress = 1;
  });
  return Response.json(job);
}
