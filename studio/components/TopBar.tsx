"use client";
import Link from "next/link";
import { useLangSync, useT } from "@/lib/i18n";
import { MOD } from "@/lib/lang";
import { useStore } from "@/lib/store";
import { useJob } from "./ExportPanel";

export function TopBar() {
  const name = useStore((s) => s.name);
  const dirty = useStore((s) => s.dirty);
  const saving = useStore((s) => s.saving);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const lastLabel = useStore((s) => s.lastLabel);
  const job = useJob(name);
  const lang = useStore((s) => s.lang);
  const t = useT();
  useLangSync();
  return (
    <div className="topbar">
      <Link href="/" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
        {t("common.appName")}
      </Link>
      <strong dir="auto">{name}</strong>
      <span className="muted" style={{ fontSize: 11, direction: "ltr" }} title={t("common.top.versionTitle")}>
        v{(process.env.NEXT_PUBLIC_CUTCAPTION_BUILD ?? "dev").split("-")[0]}
      </span>
      <span className="muted">{saving ? t("common.top.saving") : dirty ? t("common.top.unsaved") : t("common.top.saved")}</span>
      <span className="grow" />
      {job?.status === "running" ? (
        <span className="row muted">
          {t(`common.job.${job.cmd}`)}
          <span className="progress">
            <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </span>
        </span>
      ) : null}
      <button disabled={!past} onClick={() => useStore.getState().undo()} title={t("common.top.undoTitle", { key: `${MOD}Z`, label: lastLabel })}>
        ↶ {t("common.top.undo")}
      </button>
      <button disabled={!future} onClick={() => useStore.getState().redo()} title={t("common.top.redoTitle", { key: `${MOD}⇧Z` })}>
        ↷ {t("common.top.redo")}
      </button>
      <span className="muted" style={{ fontSize: 11 }}>
        <span className="kbd">Space</span> <span className="kbd">J K L</span> <span className="kbd">S</span> {t("common.top.split")} <span className="kbd">M</span> {t("common.top.merge")} <span className="kbd">C</span> {t("common.top.cut")} <span className="kbd">E</span> {t("common.top.emphasis")}
      </span>
      <button onClick={() => useStore.setState({ lang: lang === "ar" ? "en" : "ar" })} title={t("common.lang.switchTitle")}>
        {t("common.lang.switch")}
      </button>
    </div>
  );
}
