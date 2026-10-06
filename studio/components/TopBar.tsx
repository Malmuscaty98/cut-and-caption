"use client";
import Link from "next/link";
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
  return (
    <div className="topbar">
      <Link href="/" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
        قَص
      </Link>
      <strong>{name}</strong>
      <span className="muted" style={{ fontSize: 11, direction: "ltr" }} title="إصدار المحرر — لو ما يطابق آخر تحديث، أعد تحميل الصفحة">
        v{(process.env.NEXT_PUBLIC_QASS_BUILD ?? "dev").split("-")[0]}
      </span>
      <span className="muted">{saving ? "…يحفظ" : dirty ? "تعديلات غير محفوظة" : "محفوظ ✓"}</span>
      <span className="grow" />
      {job?.status === "running" ? (
        <span className="row muted">
          {job.cmd}
          <span className="progress">
            <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </span>
        </span>
      ) : null}
      <button disabled={!past} onClick={() => useStore.getState().undo()} title={`تراجع (⌘Z) — ${lastLabel}`}>
        ↶ تراجع
      </button>
      <button disabled={!future} onClick={() => useStore.getState().redo()} title="إعادة (⌘⇧Z)">
        ↷ إعادة
      </button>
      <span className="muted" style={{ fontSize: 11 }}>
        <span className="kbd">Space</span> <span className="kbd">J K L</span> <span className="kbd">S</span> قسم <span className="kbd">M</span> دمج <span className="kbd">C</span> قص <span className="kbd">E</span> إبراز
      </span>
    </div>
  );
}
