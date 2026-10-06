import fs from "node:fs";
import path from "node:path";
import { readPresets, USER_PRESETS, writeJsonAtomic } from "@/lib/server-files";
import type { Preset } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(readPresets());
}

// Save (create or overwrite) a preset from the style panel — into the user's own presets folder.
export async function POST(req: Request) {
  const p = (await req.json()) as Preset;
  if (!p?.id || !/^[a-z0-9-]+$/.test(p.id) || !p.style) return Response.json({ error: "invalid preset" }, { status: 400 });
  fs.mkdirSync(USER_PRESETS, { recursive: true });
  writeJsonAtomic(path.join(USER_PRESETS, `${p.id}.json`), p);
  return Response.json(readPresets());
}
