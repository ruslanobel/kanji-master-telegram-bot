import { searchKanji } from "../src/search.js";
import { formatCaption, formatTitle } from "../src/format.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const byChar = searchKanji("水", 5);
assert(byChar[0]?.literal === "水", "search by literal failed");

const byKun = searchKanji("みず", 10);
assert(byKun.some((e) => e.literal === "水"), "search by kun failed");

const byOn = searchKanji("スイ", 10);
assert(byOn.some((e) => e.literal === "水"), "search by on failed");

const byRu = searchKanji("вода", 10);
assert(byRu.some((e) => e.literal === "水"), "search by Russian failed");

const caption = formatCaption(byChar[0]);
assert(caption.includes("水"), "caption missing literal");
assert(caption.length <= 1024, "caption too long");
console.log(formatTitle(byChar[0]));
console.log(caption);
console.log("smoke search OK");
