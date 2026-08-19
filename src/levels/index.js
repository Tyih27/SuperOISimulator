import chapter11 from "./chapter-1-1.js";
import chapter12 from "./chapter-1-2.js";
import chapter13 from "./chapter-1-3.js";
import chapter14 from "./chapter-1-4.js";

// Keep campaign order explicit so adding a file cannot silently change progression order.
export const LEVEL_DEFINITIONS = [chapter11, chapter12, chapter13, chapter14];
