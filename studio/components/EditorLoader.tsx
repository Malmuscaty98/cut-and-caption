"use client";
import dynamic from "next/dynamic";

// The Remotion Player and the editor are browser-only.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div style={{ padding: 40 }}>…جاري التحميل</div>,
});

export function EditorLoader({ name }: { name: string }) {
  return <Editor name={name} />;
}
