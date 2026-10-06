import pkg from "../../../package.json";

export const dynamic = "force-dynamic";

// `cut-and-caption studio` checks this before starting a second copy of the editor.
export function GET() {
  return Response.json({ app: "cut-and-caption", version: pkg.version, build: process.env.NEXT_PUBLIC_CUTCAPTION_BUILD });
}
