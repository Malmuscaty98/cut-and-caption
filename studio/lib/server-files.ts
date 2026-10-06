// Node-only helpers shared by the Next API routes and the render scripts.
// Where things live (same rules as engine/cutcaption/paths.py):
//   HOME  = CUTCAPTION_HOME, else ~/Movies/Cut and Caption (macOS) or ~/Videos/Cut and Caption — the user's projects and presets
//   ROOT  = CUTCAPTION_ROOT (the plugin folder; the engine is ROOT/engine), else the repo next to this studio
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Preset, Project } from "./types";

export const STUDIO_DIR = path.resolve(process.cwd());
export const ROOT = path.resolve(process.env.CUTCAPTION_ROOT || path.join(STUDIO_DIR, ".."));
export const HOME = path.resolve(process.env.CUTCAPTION_HOME || path.join(os.homedir(), process.platform === "darwin" ? "Movies" : "Videos", "Cut and Caption"));
export const PROJECTS = path.join(HOME, "projects");
export const USER_PRESETS = path.join(HOME, "presets");
export const BUILTIN_PRESETS = path.join(STUDIO_DIR, "presets");
export const DEFAULT_PRESET = "classic";

// Letters and digits of any script (the engine's slugify keeps the same), "_", "." and "-".
const SAFE = /^[\p{L}\p{M}\p{N}_.-]+$/u;

export function projectDir(name: string) {
  if (!SAFE.test(name) || name.startsWith(".")) throw new Error(`bad project name: ${name}`);
  return path.join(PROJECTS, name);
}

export function projectFile(name: string) {
  return path.join(projectDir(name), "project.json");
}

export function readProject(name: string): Project {
  return JSON.parse(fs.readFileSync(projectFile(name), "utf-8"));
}

/** A project by name (in HOME/projects) or by its folder path (what the engine passes). */
export function resolveProject(arg: string): { dir: string; project: Project } {
  const dir = fs.existsSync(path.join(arg, "project.json")) ? path.resolve(arg) : projectDir(arg);
  return { dir, project: JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf-8")) };
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs
    .readdirSync(PROJECTS)
    .filter((n) => SAFE.test(n) && !n.startsWith(".") && fs.existsSync(path.join(PROJECTS, n, "project.json")))
    .map((n) => {
      const p = readProject(n);
      return { name: n, duration: p.source.duration, words: p.words.length, mtime: fs.statSync(projectFile(n)).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function presetsIn(dir: string): Preset[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Preset];
      } catch {
        return [];
      }
    });
}

/** Built-in presets, then the user's own (saved from the style panel) — same id = the user's wins. */
export function readPresets(): Preset[] {
  const byId = new Map<string, Preset>();
  for (const p of [...presetsIn(BUILTIN_PRESETS), ...presetsIn(USER_PRESETS)]) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => (a.id === DEFAULT_PRESET ? -1 : b.id === DEFAULT_PRESET ? 1 : a.name.localeCompare(b.name)));
}

export function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, file);
}

/** Resolve a path inside `dir`, refusing anything that escapes it (case-insensitive on Windows). */
export function safeJoin(dir: string, rel: string) {
  const base = path.resolve(dir);
  const p = path.resolve(base, rel);
  const norm = (s: string) => (process.platform === "win32" ? s.toLowerCase() : s);
  if (norm(p) !== norm(base) && !norm(p).startsWith(norm(base) + path.sep)) throw new Error("path escapes base");
  return p;
}

/** The engine command for a job: the env's Python + engine/run.py (set by `cut-and-caption studio`),
 *  or bin/cut-and-caption when the editor was started by hand while developing. */
export function engineCommand(args: string[]): [string, string[]] {
  const py = process.env.CUTCAPTION_PY;
  if (py) return [py, [path.join(ROOT, "engine", "run.py"), ...args]];
  return [path.join(ROOT, "bin", process.platform === "win32" ? "cut-and-caption.cmd" : "cut-and-caption"), args];
}

export const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".json": "application/json", ".srt": "application/x-subrip",
};
