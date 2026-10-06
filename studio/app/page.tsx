import Link from "next/link";
import { listProjects, PROJECTS } from "@/lib/server-files";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = listProjects().filter((p) => !p.name.startsWith("_"));
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Cut & Caption · قص وكابشن</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        مشروع جديد: قل لـ Claude «قص السكتات وأضف كابشن لـ …» مع مسار الفيديو. المشاريع محفوظة في <code dir="ltr">{PROJECTS}</code>
      </p>
      <div style={{ display: "grid", gap: 8, marginTop: 24 }}>
        {projects.map((p) => (
          <Link key={p.name} href={`/edit/${encodeURIComponent(p.name)}`} style={{ color: "inherit", textDecoration: "none" }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 16 }}>
              <strong className="grow">{p.name}</strong>
              <span className="muted">{p.duration.toFixed(1)} ث</span>
              <span className="muted">{p.words} كلمة</span>
              <span className="muted">{new Date(p.mtime).toLocaleString("ar")}</span>
            </div>
          </Link>
        ))}
        {!projects.length && <p className="muted">ما في مشاريع بعد.</p>}
      </div>
    </main>
  );
}
