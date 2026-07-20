import { join } from "node:path";
import { generateKanjiMp4 } from "../src/lib/kanji-gif.js";

async function main() {
  const out = join("assets/mp4", "06c34.mp4");
  await generateKanjiMp4("水", out);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
