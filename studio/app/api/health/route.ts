import pkg from "../../../package.json";

export const dynamic = "force-dynamic";

// `qass studio` checks this before starting a second copy of the editor.
export function GET() {
  return Response.json({ app: "qass", version: pkg.version, build: process.env.NEXT_PUBLIC_QASS_BUILD });
}
