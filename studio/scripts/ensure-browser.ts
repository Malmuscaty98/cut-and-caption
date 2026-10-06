// cut-and-caption setup — download the headless browser Remotion renders with (once, ~100 MB).
import { ensureBrowser } from "@remotion/renderer";

ensureBrowser({ logLevel: "error" })
  .then(() => console.log(JSON.stringify({ msg: "✓ render browser ready", done: true })))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
