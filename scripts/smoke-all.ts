import { existsSync } from "node:fs";
import { ensureMp4File } from "../src/gif.js";
import { searchKanji } from "../src/search.js";
import { formatCaption } from "../src/format.js";

async function main() {
  const entry = searchKanji("水", 1)[0];
  if (!entry) throw new Error("missing 水");

  const path = await ensureMp4File(entry.literal);
  if (!path || !existsSync(path)) throw new Error("MP4 missing");

  const caption = formatCaption(entry);
  if (!caption.includes("水") || caption.length > 1024) {
    throw new Error("caption malformed");
  }

  console.log("mp4:", path);
  console.log("caption length:", caption.length);
  console.log("smoke mp4+search OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
