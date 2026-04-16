import path from "node:path";
import { fileURLToPath } from "node:url";

let filename: string;

if (typeof __filename !== "undefined") {
  // CJS (Jest)
  filename = __filename;
} else {
  // ESM (runtime)
  const metaUrl = (new Function("return import.meta.url"))();
  filename = fileURLToPath(metaUrl);
}

const dirname = path.dirname(filename);