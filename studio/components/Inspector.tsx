"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { AUTO_CONTRAST_DEFAULT, FONT_FAMILIES, FONT_FILES } from "@/lib/style";
import { fmtTime, useStore } from "@/lib/store";
import type { CaptionStyle, Project } from "@/lib/types";
import { Check, Color, Field, Num, Select, Slider } from "./fields";
import { useResolvedStyle, useTimeline } from "./hooks";
import { ExportPanel, runJob, useJob } from "./ExportPanel";
import { LineEditor } from "./LineEditor";
import { contentDir, MOD } from "@/lib/lang";

type Tab = "item" | "style" | "cuts" | "zoom" | "export";

export function Inspector() {
  const t = useT();
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
            ["item", t("inspector.tabItem")],
            ["style", t("inspector.tabStyle")],
            ["cuts", t("inspector.tabCuts")],
            ["zoom", t("inspector.tabZoom")],
            ["export", t("inspector.tabExport")],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
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
  const t = useT();
  const weights = FONT_FILES.filter((f) => f.family === s.fontFamily).map((f) => f.weight);
  return (
    <>
      <div className="section">
        <h4>{t("inspector.font")}</h4>
        <Field label={t("inspector.fontFamily")}>
          <Select value={s.fontFamily} onChange={(v) => set({ fontFamily: v, fontWeight: FONT_FILES.filter((f) => f.family === v).map((f) => f.weight).reduce((a, b) => (Math.abs(b - s.fontWeight) < Math.abs(a - s.fontWeight) ? b : a)) })} options={FONT_FAMILIES.map((f) => [f, f])} />
        </Field>
        <Field label={t("inspector.fontWeight")}>
          <Select value={String(s.fontWeight)} onChange={(v) => set({ fontWeight: +v })} options={weights.map((w) => [String(w), String(w)])} />
        </Field>
        <Field label={t("inspector.size")}>
          <Slider value={s.fontSize} min={28} max={130} step={1} onChange={(v) => set({ fontSize: v })} />
        </Field>
        <Field label={t("inspector.lineHeight")}>
          <Slider value={s.lineHeight} min={1} max={2} onChange={(v) => set({ lineHeight: v })} />
        </Field>
        <Field label={t("inspector.maxWidth")}>
          <Slider value={s.maxWidth} min={0.3} max={0.98} onChange={(v) => set({ maxWidth: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        </Field>
        <Field label={t("inspector.digits")}>
          <Select value={s.digits} onChange={(v) => set({ digits: v })} options={[["western", t("inspector.digitsWestern")], ["arabic-indic", t("inspector.digitsArabicIndic")]]} />
        </Field>
      </div>
      <div className="section">
        <h4>{t("inspector.colors")}</h4>
        <Field label={t("inspector.colorText")}><Color value={s.textColor} onChange={(v) => set({ textColor: v })} /></Field>
        <Field label={t("inspector.colorActive")}><Color value={s.activeColor} onChange={(v) => set({ activeColor: v })} /></Field>
        <Field label={t("inspector.colorEmphasis")}><Color value={s.emphasisColor} onChange={(v) => set({ emphasisColor: v })} /></Field>
        <Field label={t("inspector.emphasisScale")}><Slider value={s.emphasisScale} min={1} max={1.5} onChange={(v) => set({ emphasisScale: v })} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label={t("inspector.stroke")}>
          <Color value={s.strokeColor} onChange={(v) => set({ strokeColor: v })} />
          <Num value={s.strokeWidth} min={0} max={30} onChange={(v) => set({ strokeWidth: v })} suffix="px" />
        </Field>
        <Field label={t("inspector.shadow")}>
          <Check value={!!s.shadow} onChange={(on) => set({ shadow: on ? "0 3px 6px rgba(0,0,0,0.55), 0 6px 22px rgba(0,0,0,0.45)" : "" })} />
          <input type="text" dir="ltr" className="grow" value={s.shadow} onChange={(e) => set({ shadow: e.target.value })} />
        </Field>
        <AutoContrastFields s={s} set={set} />
        <Field label={t("inspector.box")}>
          <Check value={!!s.box} onChange={(on) => set({ box: on ? { color: "#000000", radius: 16, padding: 18, opacity: 0.7 } : null })} />
        </Field>
        {s.box ? (
          <>
            <Field label={t("inspector.boxColor")}><Color value={s.box.color} onChange={(v) => set({ box: { ...s.box!, color: v } })} /></Field>
            <Field label={t("inspector.opacity")}><Slider value={s.box.opacity} min={0} max={1} onChange={(v) => set({ box: { ...s.box!, opacity: v } })} /></Field>
            <Field label={t("inspector.radiusPadding")}>
              <Num value={s.box.radius} min={0} max={60} onChange={(v) => set({ box: { ...s.box!, radius: v } })} />
              <Num value={s.box.padding} min={0} max={60} onChange={(v) => set({ box: { ...s.box!, padding: v } })} />
            </Field>
          </>
        ) : null}
      </div>
      <div className="section">
        <h4>{t("inspector.positionAnimation")}</h4>
        <Field label={t("inspector.posX")}><Slider value={s.position.x} min={0.05} max={0.95} onChange={(v) => set({ position: { ...s.position, x: v } })} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label={t("inspector.posY")}><Slider value={s.position.y} min={0.05} max={0.95} onChange={(v) => set({ position: { ...s.position, y: v } })} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label={t("inspector.animation")}>
          <Select
            value={s.animation}
            onChange={(v) => set({ animation: v })}
            options={[
              ["none", t("inspector.animNone")],
              ["word-highlight", t("inspector.animWordHighlight")],
              ["word-pop", t("inspector.animWordPop")],
              ["line-fade", t("inspector.animLineFade")],
              ["box-follow", t("inspector.animBoxFollow")],
            ]}
          />
        </Field>
        <p className="muted" style={{ margin: 0 }}>{t("inspector.dragOnPreview")}</p>
      </div>
    </>
  );
}

// Dark text on light backgrounds, decided per shot (engine: cut-and-caption shots).
function AutoContrastFields({ s, set }: { s: CaptionStyle; set: (patch: Partial<CaptionStyle>) => void }) {
  const t = useT();
  const name = useStore((st) => st.name);
  const shots = useStore((st) => st.project?.shots);
  const job = useJob(name);
  const ac = s.autoContrast;
  return (
    <>
      <Field label={t("inspector.autoColor")}>
        <Check value={!!ac?.enabled} onChange={(on) => set({ autoContrast: { ...(ac ?? AUTO_CONTRAST_DEFAULT), enabled: on } })} />
        <span className="muted" style={{ fontSize: 11 }}>{t("inspector.autoColorHint")}</span>
      </Field>
      {ac?.enabled ? (
        <>
          <Field label={t("inspector.threshold")}><Slider value={ac.threshold} min={0.3} max={0.8} onChange={(v) => set({ autoContrast: { ...ac, threshold: v } })} fmt={(v) => v.toFixed(2)} /></Field>
          <Field label={t("inspector.darkText")}><Color value={ac.textColor} onChange={(v) => set({ autoContrast: { ...ac, textColor: v } })} /></Field>
          {shots?.length ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>{t("inspector.shotsMeasured", { n: shots.length })}</p>
          ) : (
            <button disabled={job?.status === "running"} onClick={() => runJob(name, "shots")}>{t("inspector.measureShots")}</button>
          )}
        </>
      ) : null}
    </>
  );
}

function StylePanel() {
  const t = useT();
  const lang = useStore((st) => st.lang);
  const project = useStore((s) => s.project)!;
  const presets = useStore((s) => s.presets);
  const style = useResolvedStyle()!;
  const upd = useStore.getState().update;
  const overridden = Object.keys(project.style.overrides).length;

  const savePreset = async () => {
    const label = prompt(t("inspector.newPresetPrompt"), t("inspector.newPresetDefault"));
    if (!label) return;
    // Always a new id: saving twice under the same (or the default) name must not overwrite a preset.
    const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "preset"}-${Date.now().toString(36)}`;
    const base = presets.find((p) => p.id === project.style.presetId);
    const r = await fetch("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: label, style, zoom: base?.zoom }) });
    useStore.setState({ presets: await r.json() });
    upd(t("inspector.undoNewPreset"), (p) => void (p.style = { presetId: id, overrides: {} }));
  };

  return (
    <>
      <div className="section">
        <h4>Preset</h4>
        <Select value={project.style.presetId} onChange={(v) => upd(t("inspector.undoChangePreset"), (p) => void (p.style = { presetId: v, overrides: {} }))} options={presets.map((p) => [p.id, (lang === "ar" && p.nameAr) || p.name])} />
        <p className="muted" dir="auto" style={{ margin: 0 }}>{(() => { const p = presets.find((x) => x.id === project.style.presetId); return (lang === "ar" && p?.descriptionAr) || p?.description; })()}</p>
        <div className="row">
          <button onClick={savePreset}>{t("inspector.savePreset")}</button>
          <button disabled={!overridden} onClick={() => upd(t("inspector.undoResetToPreset"), (p) => void (p.style.overrides = {}))}>
            {t("inspector.resetToPreset")} {overridden ? `(${overridden})` : ""}
          </button>
        </div>
      </div>
      <StyleFields s={style} set={(patch) => upd(t("inspector.undoStyle"), (p) => void (p.style.overrides = { ...p.style.overrides, ...patch }))} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function ItemPanel() {
  const t = useT();
  const selection = useStore((s) => s.selection);
  const project = useStore((s) => s.project)!;
  const style = useResolvedStyle()!;
  const upd = useStore.getState().update;

  if (!selection) return <p className="muted" style={{ padding: 12 }}>{t("inspector.nothingSelected")}</p>;

  if (selection.kind === "words") {
    const ws = project.words.filter((w) => selection.ids.includes(w.id));
    return (
      <div className="section">
        <h4>{t("inspector.wordCount", { n: ws.length })}</h4>
        <div dir={contentDir(project)} style={{ fontSize: 16 }}>{ws.map((w) => w.text).join(" ")}</div>
        {ws.length === 1 ? (
          <>
            <Field label={t("inspector.time")}>{fmtTime(ws[0].start)} – {fmtTime(ws[0].end)}</Field>
            <Field label={t("inspector.confidence")}>{ws[0].conf.toFixed(2)}</Field>
            {ws[0].orig ? <Field label={t("inspector.whisperHeard")}>{t("inspector.quoted", { text: ws[0].orig })}</Field> : null}
          </>
        ) : null}
        <p className="muted" style={{ margin: 0 }}>{t("inspector.wordsHint")}</p>
      </div>
    );
  }

  const sel = selection;
  if (sel.kind === "caption") {
    const i = project.captions.findIndex((c) => c.id === sel.id);
    const c = project.captions[i];
    if (!c) return null;
    const s = { ...style, ...(c.styleOverride ?? {}), position: c.position ?? style.position };
    const setC = (fn: (c: Project["captions"][number]) => void) => upd(t("inspector.undoLine"), (p) => fn(p.captions.find((x) => x.id === sel.id)!));
    return (
      <>
        <div className="section">
          <h4>{t("inspector.lineN", { n: i + 1 })}</h4>
          <LineEditor key={c.id} captionId={c.id} autoFocus={false} rows={2} />
          <p className="muted" style={{ margin: 0 }}>{t("inspector.lineEditHint")}</p>
          <Field label={t("inspector.start")}><Num value={c.start} step={0.04} onChange={(v) => setC((x) => void (x.start = v))} suffix={t("common.sec")} /></Field>
          <Field label={t("inspector.end")}><Num value={c.end} step={0.04} onChange={(v) => setC((x) => void (x.end = v))} suffix={t("common.sec")} /></Field>
          <div className="row">
            <button onClick={() => upd(t("inspector.undoMerge"), (p) => { const k = p.captions.findIndex((x) => x.id === sel.id); if (k < p.captions.length - 1) { p.captions[k].wordIds.push(...p.captions[k + 1].wordIds); p.captions[k].end = p.captions[k + 1].end; p.captions.splice(k + 1, 1); } })}>
              {t("inspector.mergeWithNext")} <span className="kbd">M</span>
            </button>
            <button disabled={!c.styleOverride && !c.position} onClick={() => setC((x) => { x.styleOverride = null; x.position = null; })}>
              {t("inspector.resetLineStyle")}
            </button>
          </div>
        </div>
        <div className="section">
          <h4>{t("inspector.lineStyle")}</h4>
          <Field label={t("inspector.size")}><Slider value={s.fontSize} min={28} max={130} step={1} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), fontSize: v }))} /></Field>
          <Field label={t("inspector.textColor")}><Color value={s.textColor} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), textColor: v }))} /></Field>
          <Field label={t("inspector.emphasisColor")}><Color value={s.emphasisColor} onChange={(v) => setC((x) => void (x.styleOverride = { ...(x.styleOverride ?? {}), emphasisColor: v }))} /></Field>
          <Field label={t("inspector.posY")}><Slider value={s.position.y} min={0.05} max={0.95} onChange={(v) => setC((x) => void (x.position = { x: s.position.x, y: v }))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
          <Field label={t("inspector.posX")}><Slider value={s.position.x} min={0.05} max={0.95} onChange={(v) => setC((x) => void (x.position = { x: v, y: s.position.y }))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        </div>
      </>
    );
  }

  if (sel.kind === "cut") {
    const c = project.cuts.find((x) => x.id === sel.id);
    if (!c) return null;
    const setK = (fn: (c: Project["cuts"][number]) => void) => upd(t("inspector.undoCut"), (p) => fn(p.cuts.find((x) => x.id === sel.id)!));
    const words = project.words.filter((w) => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 < c.end);
    return (
      <div className="section">
        <h4>{t(c.proposed ? "inspector.cutTitleProposed" : "inspector.cutTitle", { reason: t(`common.cut.${c.reason}`) })}</h4>
        {c.note ? <p dir="auto" style={{ margin: 0 }}>{c.note}</p> : null}
        {words.length ? <div className="muted">{t("inspector.cutRemoves", { words: words.map((w) => w.text).join(" ") })}</div> : null}
        <Field label={t("inspector.cutOn")}><Check value={c.enabled} onChange={(v) => setK((x) => { x.enabled = v; x.proposed = false; })} /></Field>
        <Field label={t("inspector.start")}><Num value={c.start} step={1 / project.output.fps} onChange={(v) => setK((x) => void (x.start = v))} suffix={t("common.sec")} /></Field>
        <Field label={t("inspector.end")}><Num value={c.end} step={1 / project.output.fps} onChange={(v) => setK((x) => void (x.end = v))} suffix={t("common.sec")} /></Field>
        <Field label={t("inspector.duration")}>{(c.end - c.start).toFixed(2)} {t("common.sec")}</Field>
        <Field label={t("inspector.reason")}>
          <Select value={c.reason} onChange={(v) => setK((x) => void (x.reason = v))} options={[["silence", t("common.cut.silence")], ["filler", t("common.cut.filler")], ["retake", t("common.cut.retake")], ["manual", t("common.cut.manual")]]} />
        </Field>
        <div className="row">
          <button className="danger" onClick={() => { upd(t("inspector.undoDeleteCut"), (p) => void (p.cuts = p.cuts.filter((x) => x.id !== sel.id))); useStore.getState().select(null); }}>
            {t("inspector.deleteCut")}
          </button>
        </div>
      </div>
    );
  }

  if (sel.kind === "zoom") {
    const z = project.zooms.find((x) => x.id === sel.id);
    if (!z) return null;
    const setZ = (fn: (z: Project["zooms"][number]) => void) => upd(t("inspector.undoZoom"), (p) => fn(p.zooms.find((x) => x.id === sel.id)!));
    return (
      <div className="section">
        <h4>{t("inspector.zoomTitle")}{z.proposed ? ` (${t("common.proposed")})` : ""}</h4>
        {z.reason ? <p className="muted" style={{ margin: 0 }}>{z.reason === "cut-zoom" ? t("inspector.zoomReasonCut") : z.reason === "manual" ? t("inspector.zoomReasonManual") : z.reason.replace(/^emphasis/, t("inspector.zoomReasonEmphasis"))}</p> : null}
        <Field label={t("common.on")}><Check value={z.enabled} onChange={(v) => setZ((x) => { x.enabled = v; x.proposed = false; })} /></Field>
        <Field label={t("inspector.scale")}><Slider value={z.scale} min={1} max={2} onChange={(v) => setZ((x) => void (x.scale = v))} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label={t("inspector.centerX")}><Slider value={z.x} min={0} max={1} onChange={(v) => setZ((x) => void (x.x = v))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label={t("inspector.centerY")}><Slider value={z.y} min={0} max={1} onChange={(v) => setZ((x) => void (x.y = v))} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label={t("inspector.zoomMode")}><Select value={z.mode} onChange={(v) => setZ((x) => void (x.mode = v))} options={[["cut", t("inspector.zoomModeCut")], ["smooth", t("inspector.zoomModeSmooth")]]} /></Field>
        <Field label={t("inspector.fromTo")}>
          <Num value={z.start} step={0.04} onChange={(v) => setZ((x) => void (x.start = v))} />
          <Num value={z.end} step={0.04} onChange={(v) => setZ((x) => void (x.end = v))} />
        </Field>
        <div className="row">
          <button className="danger" onClick={() => { upd(t("inspector.undoDeleteZoom"), (p) => void (p.zooms = p.zooms.filter((x) => x.id !== sel.id))); useStore.getState().select(null); }}>
            {t("inspector.deleteZoom")}
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

// A translated sentence with one key cap in it: "… press {key} to …".
function withKbd(text: string, key: string) {
  const [before, after] = text.split("{key}");
  return (
    <>
      {before}
      <span className="kbd">{key}</span>
      {after}
    </>
  );
}

// Feature 1 — silence cuts with detailed control. Recomputing never cuts a word (engine `cut-and-caption
// recut`); manual / filler / retake cuts are kept. Fine edits happen on the timeline.
function CutsPanel() {
  const t = useT();
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
        <h4>{t("inspector.silenceCuts")}</h4>
        <div className="muted">
          {silence.length ? t("inspector.silenceCount", { n: silence.length, on }) : t("inspector.noSilenceCuts")} · {t("inspector.durationChange", { from: fmtTime(project.source.duration), to: fmtTime(tl.durationInFrames / tl.fps) })}
        </div>
        <div className="row">
          <button onClick={() => setV(SILENCE_PRESETS.tight)}>{t("inspector.presetTight")}</button>
          <button onClick={() => setV(SILENCE_PRESETS.natural)}>{t("inspector.presetNatural")}</button>
        </div>
        <Field label={t("inspector.silenceThreshold")} hint={t("inspector.silenceThresholdHint")}>
          <Slider value={v.threshold} min={-60} max={-25} step={1} onChange={(x) => setV({ ...v, threshold: x })} fmt={(x) => `${x} dB`} />
        </Field>
        <Field label={t("inspector.minSilence")} hint={t("inspector.minSilenceHint")}>
          <Slider value={v.minSilence} min={0.1} max={1} step={0.05} onChange={(x) => setV({ ...v, minSilence: x })} fmt={(x) => `${x.toFixed(2)} ${t("common.sec")}`} />
        </Field>
        <Field label={t("inspector.padding")} hint={t("inspector.paddingHint")}>
          <Slider value={v.padding} min={0} max={0.25} step={0.01} onChange={(x) => setV({ ...v, padding: x })} fmt={(x) => `${x.toFixed(2)} ${t("common.sec")}`} />
        </Field>
        <Field label={t("inspector.minSpeech")} hint={t("inspector.minSpeechHint")}>
          <Slider value={v.minSpeech} min={0.1} max={0.6} step={0.05} onChange={(x) => setV({ ...v, minSpeech: x })} fmt={(x) => `${x.toFixed(2)} ${t("common.sec")}`} />
        </Field>
        <div className="row">
          <button
            className="primary"
            disabled={busy || dirty}
            title={dirty ? t("inspector.waitForSave") : ""}
            onClick={() => runJob(name, "recut", { threshold: String(v.threshold), "min-silence": String(v.minSilence), padding: String(v.padding), "min-speech": String(v.minSpeech) })}
          >
            {busy ? t("inspector.calculating") : t("inspector.calculateCuts")}
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>{t("inspector.recutNote", { key: `${MOD}Z` })}</p>
      </div>
      <div className="section">
        <h4>{t("inspector.quickControls")}</h4>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button disabled={!silence.length} onClick={() => upd(t("inspector.undoEnableSilence"), (p) => p.cuts.forEach((c) => c.reason === "silence" && ((c.enabled = true), (c.proposed = false))))}>{t("inspector.enableAll")}</button>
          <button disabled={!silence.length} onClick={() => upd(t("inspector.undoDisableSilence"), (p) => p.cuts.forEach((c) => c.reason === "silence" && (c.enabled = false)))}>{t("inspector.disableAll")}</button>
          <button disabled={!silence.length} onClick={() => upd(t("inspector.undoDeleteSilence"), (p) => void (p.cuts = p.cuts.filter((c) => c.reason !== "silence")))}>{t("inspector.deleteSilenceCuts")}</button>
        </div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.8 }}>
          {t("inspector.cutsTimelineHelp")}
          <br />
          {withKbd(t("inspector.cutsTranscriptHelp"), "C")}
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Feature 3 — punch-in zooms for the whole video (engine `cut-and-caption zoom`); single zooms are drawn and
// edited on the timeline's zoom track.
function ZoomPanel() {
  const t = useT();
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
        <h4>{t("inspector.autoZoom")}</h4>
        <p className="muted" style={{ margin: 0 }}>
          {zs.length ? t(proposed ? "inspector.zoomCountProposed" : "inspector.zoomCount", { n: zs.length, on, proposed }) : t("inspector.noZoomsYet")} {t("inspector.emphasizedWords", { n: emphasized })}
        </p>
        <Field label={t("inspector.scale")}><Slider value={scale} min={1.05} max={1.6} onChange={setScale} fmt={(v) => `${v.toFixed(2)}×`} /></Field>
        <Field label={t("inspector.faceCenterY")}><Slider value={y} min={0.15} max={0.7} onChange={setY} fmt={(v) => `${Math.round(v * 100)}%`} /></Field>
        <Field label={t("inspector.atCuts")}><Select value={String(every)} onChange={(v) => setEvery(+v)} options={[["2", t("inspector.everySecondCut")], ["3", t("inspector.everyThirdCut")], ["1", t("inspector.everyCut")]]} /></Field>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="primary" disabled={busy || dirty} onClick={() => run({ emphasis: false, apply: true })} title={t("inspector.zoomAtCutsTitle")}>
            {t("inspector.zoomAtCuts")}
          </button>
          <button disabled={busy || dirty || !emphasized} onClick={() => run({ cuts: false, apply: true })} title={t("inspector.zoomOnEmphasisTitle")}>
            {t("inspector.zoomOnEmphasis")}
          </button>
        </div>
        {dirty ? <p className="muted" style={{ margin: 0 }}>{t("inspector.savingFirst")}</p> : null}
      </div>
      <div className="section">
        <h4>{t("inspector.allZooms")}</h4>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button disabled={!proposed} onClick={() => upd(t("inspector.undoAcceptZooms"), (p) => p.zooms.forEach((z) => z.proposed && ((z.enabled = true), (z.proposed = false))))}>{t("inspector.acceptProposed", { n: proposed })}</button>
          <button disabled={!zs.length} onClick={() => upd(t(on ? "inspector.undoZoomsOff" : "inspector.undoZoomsOn"), (p) => p.zooms.forEach((z) => ((z.enabled = !on), (z.proposed = false))))}>{t(on ? "inspector.turnAllOff" : "inspector.turnAllOn")}</button>
          <button className="danger" disabled={!zs.length} onClick={() => upd(t("inspector.undoDeleteAllZooms"), (p) => void (p.zooms = []))}>{t("inspector.deleteAll")}</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>{t("inspector.zoomTimelineHelp")}</p>
      </div>
    </>
  );
}
