import { listProjects } from "@/lib/server-files";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(listProjects());
}
