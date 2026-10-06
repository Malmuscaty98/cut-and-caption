import { EditorLoader } from "@/components/EditorLoader";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <EditorLoader name={decodeURIComponent(name)} />;
}
