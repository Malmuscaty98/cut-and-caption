"use client";
import { useEffect, useState } from "react";
import { AUTO_CONTRAST_DEFAULT, FONT_FAMILIES, FONT_FILES } from "@/lib/style";
import { fmtTime, useStore } from "@/lib/store";
import type { CaptionStyle, Project } from "@/lib/types";
import { Check, Color, Field, Num, Select, Slider } from "./fields";
import { useResolvedStyle, useTimeline } from "./hooks";
import { ExportPanel, runJob, useJob } from "./ExportPanel";
import { LineEditor } from "./LineEditor";

type Tab = "item" | "style" | "cuts" | "zoom" | "export";

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const [tab, setTab] = useState<Tab>("style");
  useEffect(() => {
    if (selection) setTab("item");
  }, [selection]);
  return (
    <div className="inspector">
      <div className="tabs">
        {(
          [
            ["item", "المحدد"],
            ["style", "الستايل"],
            ["cuts", "القص"],
            ["zoom", "الزوم"],
            ["export", "تصدير"],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "item" ? <ItemPanel /> : tab === "style" ? <StylePanel /> : tab === "cuts" ? <CutsPanel /> : tab === "zoom" ? <ZoomPanel /> : <ExportPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function StyleFields({ s, set }: { s: CaptionStyle; set: (patch: Partial<CaptionStyle>) => void }) {
  const weights = FONT_FILES.filter((f) => f.family === s.fontFamily).map((f) => f.weight);
  return (
    <>
      <div className="section">
        <h4>الخط</h4>
        <Field label="النوع">
          <Select value={s.fontFamily} onChange={(v) => set({ fontFamily: v, fontWeight: FONT_FILES.filter((f) => f.family === v).map((f) => f.weight).reduce((a, b) => (Math.abs(b - s.fontWeight) < Math.abs(a - s.fontWeight) ? b : a)) })} options={FONT_FAMILIES.map((f) => [f, f])} />
        </Field>
        <Field label="السماكة">
          <Select value={String(s.fontWeight)} onChange={(v) => set({ fontWeight: +v })} options={weights.map((w) => [String(w), String(w)])} />
        </Field>
        <Field label="الحجم">
          <Slider value={s.fontSize} min={28} max={130} step={1} onChange={(v) => set({ fontSize: v })} />
        </Field>
        <Field label="تباعد الأسطر">
          <Slider value={s.lineHeight} min={1} max={2} onChange={(v) => set({ lineHeight: v })} />
        </Field>
        <Field label="أقصى عرض">
          <Slider value={s.maxWidth} min={0.3} max={0.98} onChange={(v) => set({ maxWidth: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        </Field>
        <Field label="الأرقام">
          <Select value={s.digits} onChange={(v) => set({ digits: v })} options={[["western", "123"], ["arabic-indic", "١٢٣"]]} />
        </Field>
      </div>
      <div className="section">
        <h4>الألوان</h4>
        <Field label="النص"><Color value={s.textColor} onChange={(v) => set({ textColor: v })} /></Field>
        <Field label="الكلمة الحالية"><Color value={s.activeColor} onChange={(v) => set({ activeColor: v })} /></Field>
        <Field label="الكلمة المبرزة"><Color value={s.emphasisColor} onChange={(v) => set({ emphasisColor: v })} /></Field>
        <Field label="تكبير المبرزة"><Slider value={s.emphasisScale} min={1} max={1.5} onChange={(v) => set({ emphasisScale: v })} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label="الحد (Stroke)">
          <Color value={s.strokeColor} onChange={(v) => set({ strokeColor: v })} />
          <Num value={s.strokeWidth} min={0} max={30} onChange={(v) => set({ strokeWidth: v })} suffix="px" />
        </Field>
        <Field label="الظل">
          <Check value={!!s.shadow} onChange={(on) => set({ shadow: on ? "0 3px 6px rgba(0,0,0,0.55), 0 6px 22px rgba(0,0,0,0.45)" : "" })} />
          <input type="text" dir="ltr" className="grow" value={s.shadow} onChange={(e) => set({ shadow: e.target.value })} />
        </Field>
        <AutoContrastFields s={s} set={set} />
        <Field label="خلفية (صندوق)">
          <Check value={!!s.box} onChange={(on) => set({ box: on ? { color: "#000000", radius: 16, padding: 18, opacity: 0.7 } : null })} />
        </Field>
        {s.box ? (
          <>
            <Field label="لون الصندوق"><Color value={s.box.color} onChange={(v) => set({ box: { ...s.box!, color: v } })} /></Field>
            <Field label="الشفافية"><Slider value={s.box.opacity} min={0} max={1} onChange={(v) => set({ box: { ...s.box!, opacity: v } })} /></Field>
            <Field label="الزوايا / الهامش">
              <Num value={s.box.radius} min={0} max={60} onChange={(v) => set({ box: { ...s.box!, radius: v } })} />
              <Num value={s.box.padding} min={0} max={60} onChange={(v) => set({ box: { ...s.box!, padding: v } })} />
            </Field>
          </>
        ) : null}
      </div>
      <div className="section">
        <h4>المكان والحركة</h4>
        <Field label="أفقي X"><Slider value={s.position.x} min={0.05} max={0.95} onChange={(v) => set({ position: { ...s.position, x: v } })} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label="عمودي Y"><Slider value={s.position.y} min={0.05} max={0.95} onChange={(v) => set({ position: { ...s.position, y: v } })} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label="الحركة">
          <Select
            value={s.animation}
            onChange={(v) => set({ animation: v })}
            options={[
              ["none", "بدون — الجملة كاملة"],
              ["word-highlight", "تلوين الكلمة الحالية"],
              ["word-pop", "الكلمات تطلع وحدة وحدة"],
              ["line-fade", "ظهور تدريجي للسطر"],
              ["box-follow", "صندوق يتبع الكلمة"],
            ]}
          />
        </Field>
        <p className="muted" style={{ margin: 0 }}>تقدر تسحب الكابشن مباشرة على المعاينة.</p>
      </div>
    </>
  );
}

// Dark text on light backgrounds, decided per shot (engine: cut-and-caption shots).
function AutoContrastFields({ s, set }: { s: CaptionStyle; set: (patch: Partial<CaptionStyle>) => void }) {
  const name = useStore((st) => st.name);
  const shots = useStore((st) => st.project?.shots);
  const job = useJob(name);
  const ac = s.autoContrast;
  return (
    <>
      <Field label="لون تلقائي">
        <Check value={!!ac?.enabled} onChange={(on) => set({ autoContrast: { ...(ac ?? AUTO_CONTRAST_DEFAULT), enabled: on } })} />
        <span className="muted" style={{ fontSize: 11 }}>نص داكن لما تكون الخلفية فاتحة — لكل لقطة</span>
      </Field>
      {ac?.enabled ? (
        <>
          <Field label="العتبة"><Slider value={ac.threshold} min={0.3} max={0.8} onChange={(v) => set({ autoContrast: { ...ac, threshold: v } })} fmt={(v) => v.toFixed(2)} /></Field>
          <Field label="النص الداكن"><Color value={ac.textColor} onChange={(v) => set({ autoContrast: { ...ac, textColor: v } })} /></Field>
          {shots?.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>{shots.length} لقطة مقاسة</p>
          ) : (
            <button disabled={job?.status === "running"} onClick={() => runJob(name, "shots")}>قِس الإضاءة لهذا الفيديو</button>
          )}
        </>
      ) : null}
    </>
  );
}

function StylePanel() {
  const project = useStore((s) => s.project)!;
  const presets = useStore((s) => s.presets);
  const style = useResolvedStyle()!;
  const upd = useStore.getState().update;
  const overridden = Object.keys(project.style.overrides).length;

  const savePreset = async () => {
    const label = prompt("اسم الـ preset الجديد؟", "ستايلي");
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `preset-${Date.now()}`;
    const base = presets.find((p) => p.id === project.style.presetId);
    const r = await fetch("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: label, style, zoom: base?.zoom }) });
    useStore.setState({ presets: await r.json() });
    upd("preset جديد", (p) => void (p.style = { presetId: id, overrides: {} }));
  };

  return (
    <>
      <div className="section">
        <h4>Preset</h4>
        <Select value={project.style.presetId} onChange={(v) => upd("تغيير الـ preset", (p) => void (p.style = { presetId: v, overrides: {} }))} options={presets.map((p) => [p.id, p.name])} />
        <p className="muted" style={{ margin: 0 }}>{presets.find((p) => p.id === project.style.presetId)?.["description" as never]}</p>
        <div className="row">
          <button onClick={savePreset}>احفظ كـ preset</button>
          <button disabled={!overridden} onClick={() => upd("رجوع للـ preset", (p) => void (p.style.overrides = {}))}>
            رجّع للأصل {overridden ? `(${overridden})` : ""}
          </button>
        </div>
      </div>
      <StyleFields s={style} set={(patch) => upd("ستايل", (p) => void (p.style.overrides = { ...p.style.overrides, ...patch }))} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function ItemPanel() {
  const selection = useStore((s) => s.selection);
  const project = useStore((s) => s.project)!;
  const style = useResolvedStyle()!;
  const upd = useStore.getState().update;

  if (!selection) return <p className="muted" style={{ padding: 12 }}>اختر شي من التايملاين أو النص.</p>;

  if (selection.kind === "words") {
    const ws = project.words.filter((w) => selection.ids.includes(w.id));
    return (
      <div className="section">
        <h4>{ws.length} كلمة</h4>
        <div dir="rtl" style={{ fontSize: 16 }}>{ws.map((w) => w.text).join(" ")}</div>
        {ws.length === 1 ? (
          <>
            <Field label="الوقت">{fmtTime(ws[0].start)} – {fmtTime(ws[0].end)}</Field>
            <Field label="الثقة">{ws[0].conf.toFixed(2)}</Field>
            {ws[0].orig ? <Field label="Whisper سمع">«{ws[0].orig}»</Field> : null}
          </>
        ) : null}
        <p className="muted" style={{ margin: 0 }}>دبل كلك على الكلمة في النص لتعديلها. C قص، E إبراز.</p>
      </div>
    );
  }

  const sel = selection;
  if (sel.kind === "caption") {
    const i = project.captions.findIndex((c) => c.id === sel.id);
    const c = project.captions[i];
    if (!c) return null;
    const s = { ...style, ...(c.styleOverride ?? {}), position: c.position ?? style.position };
    const setC = (fn: (c: Project["captions"][number]) => void) => upd("سطر", (p) => fn(p.captions.find((x) => x.id === sel.id)!));
    return (
      <>
        <div className="section">
          <h4>السطر {i + 1}</h4>
          <LineEditor key={c.id} captionId={c.id} autoFocus={false} rows={2} />
          <p className="muted" style={{ margin: 0 }}>اكتب مباشرة: المعاينة تتغير وأنت تكتب. Enter للحفظ، Esc للإلغاء.</p>
          <Field label="البداية"><Num value={c.start} step={0.04} onChange={(v) => setC((x) => void (x.start = v))} suffix="ث" /></Field>
          <Field label="النهاية"><Num value={c.end} step={0.04} onChange={(v) => setC((x) => void (x.end = v))} suffix="ث" /></Field>
          <div className="row">
            <button onClick={() => upd("دمج", (p) => { const k = p.captions.findIndex((x) => x.id === sel.id); if (k < p.captions.length - 1) { p.captions[k].wordIds.push(...p.captions[k + 1].wordIds); p.captions[k].end = p.captions[k + 1].end; p.captions.splice(k + 1, 1); } })}>
              دمج مع اللي بعده <span className="kbd">M</span>
            </button>
            <button disabled={!c.styleOverride && !c.position} onClick={() => setC((x) => { x.styleOverride = null; x.position = null; })}>
              رجّع للستايل العام
            </button>
          </div>
        </div>
        <div className="section">
          <h4>ستايل خاص بهالسطر</h4>
          <Field label="الحجم"><Slider value={s.fontSize} min={28} max={130} step={1} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), fontSize: v }))} /></Field>
          <Field label="لون النص"><Color value={s.textColor} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), textColor: v }))} /></Field>
          <Field label="لون المبرزة"><Color value={s.emphasisColor} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), emphasisColor: v }))} /></Field>
          <Field label="عمودي Y"><Slider value={s.position.y} min={0.05} max={0.95} onChange={(v) => setC((x) => void (x.position = { x: s.position.x, y: v }))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
          <Field label="أفقي X"><Slider value={s.position.x} min={0.05} max={0.95} onChange={(v) => setC((x) => void (x.position = { x: v, y: s.position.y }))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        </div>
      </>
    );
  }

  if (sel.kind === "cut") {
    const c = project.cuts.find((x) => x.id === sel.id);
    if (!c) return null;
    const setK = (fn: (c: Project["cuts"][number]) => void) => upd("قصة", (p) => fn(p.cuts.find((x) => x.id === sel.id)!));
    const words = project.words.filter((w) => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 < c.end);
    return (
      <div className="section">
        <h4>قصة — {({ silence: "سكوت", filler: "حشو", retake: "إعادة", manual: "يدوي" } as Record<string, string>)[c.reason]}{c.proposed ? " (مقترحة)" : ""}</h4>
        {c.note ? <p style={{ margin: 0 }}>{c.note}</p> : null}
        {words.length ? <div className="muted" dir="rtl">تشيل: «{words.map((w) => w.text).join(" ")}»</div> : null}
        <Field label="مفعّلة"><Check value={c.enabled} onChange={(v) => setK((x) => { x.enabled = v; x.proposed = false; })} /></Field>
        <Field label="البداية"><Num value={c.start} step={1 / project.output.fps} onChange={(v) => setK((x) => void (x.start = v))} suffix="ث" /></Field>
        <Field label="النهاية"><Num value={c.end} step={1 / project.output.fps} onChange={(v) => setK((x) => void (x.end = v))} suffix="ث" /></Field>
        <Field label="المدة">{(c.end - c.start).toFixed(2)} ث</Field>
        <Field label="السبب">
          <Select value={c.reason} onChange={(v) => setK((x) => void (x.reason = v))} options={[["silence", "سكوت"], ["filler", "حشو"], ["retake", "إعادة"], ["manual", "يدوي"]]} />
        </Field>
        <div className="row">
          <button className="danger" onClick={() => { upd("حذف قصة", (p) => void (p.cuts = p.cuts.filter((x) => x.id !== sel.id))); useStore.getState().select(null); }}>
            احذف القصة
          </button>
        </div>
      </div>
    );
  }

  if (sel.kind === "zoom") {
    const z = project.zooms.find((x) => x.id === sel.id);
    if (!z) return null;
    const setZ = (fn: (z: Project["zooms"][number]) => void) => upd("زوم", (p) => fn(p.zooms.find((x) => x.id === sel.id)!));
    return (
      <div className="section">
        <h4>زوم{z.proposed ? " (مقترح)" : ""}</h4>
        {z.reason ? <p className="muted" style={{ margin: 0 }}>{z.reason === "cut-zoom" ? "زوم تلقائي عند القصة" : z.reason === "manual" ? "زوم يدوي" : z.reason.replace(/^emphasis/, "إبراز")}</p> : null}
        <Field label="مفعّل"><Check value={z.enabled} onChange={(v) => setZ((x) => { x.enabled = v; x.proposed = false; })} /></Field>
        <Field label="التكبير"><Slider value={z.scale} min={1} max={2} onChange={(v) => setZ((x) => void (x.scale = v))} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label="المركز X"><Slider value={z.x} min={0} max={1} onChange={(v) => setZ((x) => void (x.x = v))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label="المركز Y"><Slider value={z.y} min={0} max={1} onChange={(v) => setZ((x) => void (x.y = v))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label="النوع"><Select value={z.mode} onChange={(v) => setZ((x) => void (x.mode = v))} options={[["cut", "قطع مباشر"], ["smooth", "دخول ناعم"]]} /></Field>
        <Field label="من / إلى">
          <Num value={z.start} step={0.04} onChange={(v) => setZ((x) => void (x.start = v))} />
          <Num value={z.end} step={0.04} onChange={(v) => setZ((x) => void (x.end = v))} />
        </Field>
        <div className="row">
          <button className="danger" onClick={() => { upd("حذف زوم", (p) => void (p.zooms = p.zooms.filter((x) => x.id !== sel.id))); useStore.getState().select(null); }}>
            احذف الزوم
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------------------------
const SILENCE_PRESETS = {
  tight: { threshold: -35, minSilence: 0.2, padding: 0.05, minSpeech: 0.2 },
  natural: { threshold: -35, minSilence: 0.45, padding: 0.1, minSpeech: 0.25 },
};

// Feature 1 — silence cuts with detailed control. Recomputing never cuts a word (engine `cut-and-caption
// recut`); manual / filler / retake cuts are kept. Fine edits happen on the timeline.
function CutsPanel() {
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const dirty = useStore((s) => s.dirty);
  const tl = useTimeline()!;
  const job = useJob(name);
  const upd = useStore.getState().update;
  const saved = (project.analysis?.silence as typeof SILENCE_PRESETS.tight | undefined) ?? SILENCE_PRESETS.tight;
  const [v, setV] = useState(saved);
  const silence = project.cuts.filter((c) => c.reason === "silence");
  const on = silence.filter((c) => c.enabled).length;
  const busy = job?.status === "running" && job.cmd === "recut";

  return (
    <>
      <div className="section">
        <h4>قص السكوت</h4>
        <div className="muted">
          {silence.length ? `${silence.length} قصة سكوت · مفعّل ${on}` : "ما فيه قصات سكوت"} · المدة {fmtTime(project.source.duration)} ← {fmtTime(tl.durationInFrames / tl.fps)}
        </div>
        <div className="row">
          <button onClick={() => setV(SILENCE_PRESETS.tight)}>مشدود</button>
          <button onClick={() => setV(SILENCE_PRESETS.natural)}>طبيعي</button>
        </div>
        <Field label="الحساسية" hint="كم لازم يكون الصوت واطي عشان ينحسب سكوت. أقل (مثلاً −45) = يحافظ على الأصوات الخفيفة ويقص أقل">
          <Slider value={v.threshold} min={-60} max={-25} step={1} onChange={(x) => setV({ ...v, threshold: x })} fmt={(x) => `${x} dB`} />
        </Field>
        <Field label="أقل سكوت" hint="أي وقفة أقصر من هذي ما تنقص">
          <Slider value={v.minSilence} min={0.1} max={1} step={0.05} onChange={(x) => setV({ ...v, minSilence: x })} fmt={(x) => `${x.toFixed(2)} ث`} />
        </Field>
        <Field label="الهامش" hint="كم نترك من السكوت قبل وبعد الكلام — أكبر = أنعم وأأمن على أطراف الكلمات">
          <Slider value={v.padding} min={0} max={0.25} step={0.01} onChange={(x) => setV({ ...v, padding: x })} fmt={(x) => `${x.toFixed(2)} ث`} />
        </Field>
        <Field label="أقل كلام" hint="جزر صوت قصيرة بدون كلمات بين سكوتين تنقص معهم">
          <Slider value={v.minSpeech} min={0.1} max={0.6} step={0.05} onChange={(x) => setV({ ...v, minSpeech: x })} fmt={(x) => `${x.toFixed(2)} ث`} />
        </Field>
        <div className="row">
          <button
            className="primary"
            disabled={busy || dirty}
            title={dirty ? "انتظر الحفظ" : ""}
            onClick={() => runJob(name, "recut", { threshold: String(v.threshold), "min-silence": String(v.minSilence), padding: String(v.padding), "min-speech": String(v.minSpeech) })}
          >
            {busy ? "…يحسب" : "احسب القصات"}
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>ما تنقص أي كلمة أبداً. قصاتك اليدوية وقصات الحشو تبقى مثل ما هي. ⌘Z يرجّع.</p>
      </div>
      <div className="section">
        <h4>تحكم سريع</h4>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button disabled={!silence.length} onClick={() => upd("تفعيل كل قصات السكوت", (p) => p.cuts.forEach((c) => c.reason === "silence" && ((c.enabled = true), (c.proposed = false))))}>فعّل الكل</button>
          <button disabled={!silence.length} onClick={() => upd("تعطيل كل قصات السكوت", (p) => p.cuts.forEach((c) => c.reason === "silence" && (c.enabled = false)))}>عطّل الكل</button>
          <button disabled={!silence.length} onClick={() => upd("حذف قصات السكوت", (p) => void (p.cuts = p.cuts.filter((c) => c.reason !== "silence")))}>احذف قصات السكوت</button>
        </div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>
          في التايملاين: كلك على القصة يحددها وكلك ثاني يفعّلها/يعطّلها، اسحب أطرافها لتعديلها، أو اسحب في مكان فاضي لقصة يدوية. زر «الأصل» يعرض الفيديو كامل والقصات بالأحمر.
          <br />في النص: حدد كلمات واضغط <span className="kbd">C</span> لقصها.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Feature 3 — punch-in zooms for the whole video (engine `cut-and-caption zoom`); single zooms are drawn and
// edited on the timeline's zoom track.
function ZoomPanel() {
  const project = useStore((s) => s.project)!;
  const name = useStore((s) => s.name);
  const dirty = useStore((s) => s.dirty);
  const job = useJob(name);
  const busy = job?.status === "running";
  const upd = useStore.getState().update;
  const [scale, setScale] = useState(1.2);
  const [y, setY] = useState(0.35);
  const [every, setEvery] = useState(2);
  const zs = project.zooms;
  const on = zs.filter((z) => z.enabled).length;
  const proposed = zs.filter((z) => z.proposed).length;
  const emphasized = project.words.filter((w) => w.emphasis).length;
  const run = (opts: Record<string, string | boolean>) => runJob(name, "zoom", { scale: String(scale), y: String(y), every: String(every), ...opts });
  return (
    <>
      <div className="section">
        <h4>زوم تلقائي</h4>
        <p className="muted" style={{ margin: 0 }}>
          {zs.length ? `${zs.length} زوم — ${on} شغّال${proposed ? `، ${proposed} مقترح` : ""}` : "ما فيه زوم بعد."} الكلمات المبرزة: {emphasized} (حدد كلمة واضغط E).
        </p>
        <Field label="التكبير"><Slider value={scale} min={1.05} max={1.6} onChange={setScale} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label="مركز الوجه Y"><Slider value={y} min={0.15} max={0.7} onChange={setY} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label="عند القصات"><Select value={String(every)} onChange={(v) => setEvery(+v)} options={[["2", "كل قصة ثانية"], ["3", "كل ثالث قصة"], ["1", "كل قصة"]]} /></Field>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="primary" disabled={busy || dirty} onClick={() => run({ emphasis: false, apply: true })} title="تكبير مباشر يتبدّل عند القصات">
            زوم عند القصات
          </button>
          <button disabled={busy || dirty || !emphasized} onClick={() => run({ cuts: false, apply: true })} title="دخول ناعم على كل كلمة مبرزة">
            زوم على المبرزة
          </button>
        </div>
        {dirty ? <p className="muted" style={{ margin: 0 }}>…يحفظ التعديلات أول</p> : null}
      </div>
      <div className="section">
        <h4>كل الزوم</h4>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button disabled={!proposed} onClick={() => upd("قبول الزوم المقترح", (p) => p.zooms.forEach((z) => z.proposed && ((z.enabled = true), (z.proposed = false))))}>اقبل المقترح ({proposed})</button>
          <button disabled={!zs.length} onClick={() => upd(on ? "إطفاء كل الزوم" : "تشغيل كل الزوم", (p) => p.zooms.forEach((z) => ((z.enabled = !on), (z.proposed = false))))}>{on ? "اطفِ الكل" : "شغّل الكل"}</button>
          <button className="danger" disabled={!zs.length} onClick={() => upd("حذف كل الزوم", (p) => void (p.zooms = []))}>احذف الكل</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>على التايملاين: اسحب في مسار «الزوم» لإضافة زوم، واسحب الأطراف لتغيير المدة، وكلك مرتين على زوم لإطفائه.</p>
      </div>
    </>
  );
}
