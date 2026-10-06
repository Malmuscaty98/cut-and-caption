import { HomeList } from "@/components/HomeList";
import { listProjects, PROJECTS } from "@/lib/server-files";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = listProjects().filter((p) => !p.name.startsWith("_"));
  return <HomeList projects={projects} root={PROJECTS} />;
}
