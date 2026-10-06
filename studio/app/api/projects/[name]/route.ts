import fs from "node:fs";
import path from "node:path";
import { projectDir, projectFile, readProject, writeJsonAtomic } from "@/lib/server-files";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const SNAPSHOT_EVERY_MS = 60_000; // studio edits are frequent; keep a restore point per minute
const lastSnapshot = new Map<string, number>();

export async function GET(_: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  try {
    const project = readProject(name);
    const mtime = fs.statSync(projectFile(name)).mtimeMs;
    return Response.json({ project, mtime });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 404 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const body = (await req.json()) as { project: Project; baseMtime?: number };
  const p = body.project;
  if (!p || p.version !== 1 || !Array.isArray(p.words) || !Array.isArray(p.captions) || !Array.isArray(p.cuts)) {
    return Response.json({ error: "invalid project" }, { status: 400 });
  }
  const file = projectFile(name);
  const cur = fs.statSync(file).mtimeMs;
  // Someone else (Claude, via the skill) wrote since the editor loaded → let the client merge.
  if (body.baseMtime && Math.abs(cur - body.baseMtime) > 1) {
    return Response.json({ error: "conflict", mtime: cur }, { status: 409 });
  }
  const now = Date.now();
  if (now - (lastSnapshot.get(name) ?? 0) > SNAPSHOT_EVERY_MS) {
    const hist = path.join(projectDir(name), ".history");
    fs.mkdirSync(hist, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").replace(/\..+/, "");
    fs.copyFileSync(file, path.join(hist, `project.${stamp}-studio.json`));
    lastSnapshot.set(name, now);
  }
  writeJsonAtomic(file, p);
  return Response.json({ mtime: fs.statSync(file).mtimeMs });
}
