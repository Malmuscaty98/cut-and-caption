"use client";
import { useEffect, useState } from "react";
import { translate, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Field, Select } from "./fields";

type Job = { cmd: string; status: "running" | "done" | "error"; log: string[]; progress: number; out?: string } | null;

export function useJob(name: string) {
  const [job, setJob] = useState<Job>(null);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      const j = (await fetch(`/api/projects/${encodeURIComponent(name)}/run`).then((r) => r.json())) as Job;
      setJob(j);
      if (j?.status !== "running" && t) {
        clearInterval(t);
        t = null;
      }
    };
    void tick();
    const onStart = () => {
      if (!t) t = setInterval(tick, 800);
      void tick();
    };
    window.addEventListener("cc-job", onStart);
    return () => {
      window.removeEventListener("cc-job", onStart);
      if (t) clearInterval(t);
    };
  }, [name]);
  return job;
}

export async function runJob(name: string, cmd: string, opts: Record<string, string | boolean> = {}) {
  const r = await fetch(`/api/projects/${encodeURIComponent(name)}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd, opts }) });
  window.dispatchEvent(new Event("cc-job"));
  if (r.status === 409) useStore.getState().notify(translate(useStore.getState().lang, "shell.jobBusy"));
}

export function ExportPanel() {
  const t = useT();
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const dirty = useStore((s) => s.dirty);
  const [aspect, setAspect] = useState<string>(project.output.aspect);
  const job = useJob(name);
  const busy = job?.status === "running";
  const proposed = project.cuts.filter((c) => c.proposed).length;
  // Sentences with an element inside: the dictionary keeps the whole sentence, the element replaces {path} / {setting}.
  const [filesPre, filesPost] = t("shell.exportFilesIn").split("{path}");
  const [igPre, igPost] = t("shell.exportIgTip").split("{setting}");

  return (
    <>
      <div className="section">
        <h4>{t("shell.exportTitle")}</h4>
        <Field label={t("shell.exportSize")}>
          <Select value={aspect} onChange={setAspect} options={[["9:16", "9:16 — Reels / TikTok / Shorts"], ["4:5", t("shell.aspectPost")], ["1:1", t("shell.aspectSquare")], ["16:9", t("shell.aspectYoutube")]]} />
        </Field>
        {proposed ? <p style={{ margin: 0, color: "var(--cut-filler)" }}>{t("shell.exportProposed", { n: proposed })}</p> : null}
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="primary" disabled={busy || dirty} onClick={() => runJob(name, "render", { aspect })}>
            {t("shell.exportMp4")}
          </button>
          <button disabled={busy || dirty} onClick={() => runJob(name, "render", { aspect, draft: true })} title={t("shell.exportDraftTitle")}>
            {t("shell.exportDraft")}
          </button>
          <button disabled={busy || dirty} onClick={() => runJob(name, "srt")}>
            SRT
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {filesPre}
          <code dir="ltr">projects/{name}/renders/</code>
          {filesPost}
        </p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>
          {t("shell.exportQuality")}
          <br />
          {igPre}
          <b>{t("shell.exportIgSetting")}</b>
          {igPost}
        </p>
      </div>
      {job ? (
        <div className="section">
          <h4>
            {t(`common.job.${job.cmd}`)} — {job.status === "running" ? t("shell.jobRunning") : job.status === "done" ? t("shell.jobDone") : t("shell.jobFailed")}
          </h4>
          <div className="progress" style={{ width: "100%" }}>
            <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
          {job.out ? (
            <div className="row" style={{ flexWrap: "wrap" }}>
              <code dir="ltr" style={{ fontSize: 11, wordBreak: "break-all" }}>{job.out}</code>
              {job.out.replace(/\\/g, "/").includes(`/projects/${name}/`) ? (
                <a href={`/api/media/${encodeURIComponent(name)}/${job.out.replace(/\\/g, "/").split(`/projects/${name}/`)[1]}`} target="_blank" rel="noreferrer">
                  {t("shell.openFile")}
                </a>
              ) : null}
            </div>
          ) : null}
          <pre dir="ltr" style={{ margin: 0, maxHeight: 160, overflow: "auto", fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{job.log.slice(-12).join("\n")}</pre>
        </div>
      ) : null}
    </>
  );
}
