"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLangSync, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export type ProjectItem = { name: string; duration: number; words: number; mtime: number };

// The language lives in the browser (saved choice / browser language), so the server can't render it:
// show the list only once hydrated — no server/client text mismatch.
const noSubscribe = () => () => {};

export function HomeList({ projects, root }: { projects: ProjectItem[]; root: string }) {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const lang = useStore((s) => s.lang);
  const t = useT();
  useLangSync();
  if (!hydrated) return null;
  const [hintPre, hintPost] = t("shell.homeHint").split("{path}");
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: 16 }}>
      <div className="row" style={{ alignItems: "baseline" }}>
        <h1 className="grow" style={{ fontSize: 26, marginBottom: 4 }}>
          {t("shell.homeTitle")}
        </h1>
        <button onClick={() => useStore.setState({ lang: lang === "ar" ? "en" : "ar" })} title={t("common.lang.switchTitle")}>
          {t("common.lang.switch")}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {hintPre}
        <code dir="ltr">{root}</code>
        {hintPost}
      </p>
      <div style={{ display: "grid", gap: 8, marginTop: 24 }}>
        {projects.map((p) => (
          <Link key={p.name} href={`/edit/${encodeURIComponent(p.name)}`} style={{ color: "inherit", textDecoration: "none" }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 16 }}>
              <strong className="grow">
                <span dir="auto">{p.name}</span>
              </strong>
              <span className="muted">
                {p.duration.toFixed(1)} {t("common.sec")}
              </span>
              <span className="muted">{t("shell.homeWords", { n: p.words })}</span>
              <span className="muted">{new Date(p.mtime).toLocaleString(lang)}</span>
            </div>
          </Link>
        ))}
        {!projects.length && <p className="muted">{t("shell.homeEmpty")}</p>}
      </div>
    </main>
  );
}
