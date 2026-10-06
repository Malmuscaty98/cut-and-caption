"use client";
import type { ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field" title={hint}>
      <label>{label}</label>
      <div className="row">{children}</div>
    </div>
  );
}

export function Num({ value, onChange, step = 1, min, max, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <>
      <input
        type="number"
        value={Number.isFinite(value) ? +value.toFixed(3) : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
      {suffix ? <span className="muted">{suffix}</span> : null}
    </>
  );
}

export function Slider({ value, onChange, min, max, step = 0.01, fmt }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <>
      <input className="grow" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="muted" style={{ minWidth: 38, direction: "ltr" }}>{fmt ? fmt(value) : value}</span>
    </>
  );
}

export function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <input type="text" dir="ltr" value={value} style={{ width: 84 }} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value.toUpperCase())} />
    </>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="grow">
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Check({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="row">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
