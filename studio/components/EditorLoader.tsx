"use client";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n";

function Loading() {
  const t = useT();
  return <div style={{ padding: 40 }}>{t("shell.loading")}</div>;
}

// The Remotion Player and the editor are browser-only.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <Loading />,
});

export function EditorLoader({ name }: { name: string }) {
  return <Editor name={name} />;
}
