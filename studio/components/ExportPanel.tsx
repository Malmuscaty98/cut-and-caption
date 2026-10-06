"use client";
import { useEffect, useState } from "react";
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
  if (r.status === 409) useStore.getState().notify("فيه عملية شغّالة — انتظرها تخلص");
}

export function ExportPanel() {
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const dirty = useStore((s) => s.dirty);
  const [aspect, setAspect] = useState<string>(project.output.aspect);
  const job = useJob(name);
  const busy = job?.status === "running";
  const proposed = project.cuts.filter((c) => c.proposed).length;

  return (
    <>
      <div className="section">
        <h4>تصدير الفيديو</h4>
        <Field label="المقاس">
          <Select value={aspect} onChange={setAspect} options={[["9:16", "9:16 — Reels / TikTok / Shorts"], ["4:5", "4:5 — منشور"], ["1:1", "1:1 — مربع"], ["16:9", "16:9 — يوتيوب"]]} />
        </Field>
        {proposed ? <p style={{ margin: 0, color: "var(--cut-filler)" }}>فيه {proposed} قصة مقترحة ما قررت فيها — بتنصدّر بدونها.</p> : null}
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="primary" disabled={busy || dirty} onClick={() => runJob(name, "render", { aspect })}>
            صدّر MP4
          </button>
          <button disabled={busy || dirty} onClick={() => runJob(name, "render", { aspect, draft: true })} title="من الـ proxy — أسرع، للمراجعة">
            نسخة سريعة
          </button>
          <button disabled={busy || dirty} onClick={() => runJob(name, "srt")}>
            SRT
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>الملفات تنحفظ في <code dir="ltr">projects/{name}/renders/</code> مع نسخة من project.json.</p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>
          الجودة: 1080×1920، BT.709، x264 slow (CRF 17)، والصوت من ملفك بدون إعادة ضغط لو ما فيه قصات.
          <br />انستقرام: الإعدادات ← استخدام البيانات وجودة الوسائط ← فعّل <b>«Upload at highest quality»</b>. تيك توك: فعّل الرفع بجودة عالية (HD).
        </p>
      </div>
      {job ? (
        <div className="section">
          <h4>
            {job.cmd} — {job.status === "running" ? "شغّال" : job.status === "done" ? "خلص ✓" : "فشل ✗"}
          </h4>
          <div className="progress" style={{ width: "100%" }}>
            <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
          {job.out ? (
            <div className="row" style={{ flexWrap: "wrap" }}>
              <code dir="ltr" style={{ fontSize: 11, wordBreak: "break-all" }}>{job.out}</code>
              {job.out.includes(`/projects/${name}/`) ? (
                <a href={`/api/media/${encodeURIComponent(name)}/${job.out.split(`/projects/${name}/`)[1]}`} target="_blank" rel="noreferrer">
                  افتح
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
