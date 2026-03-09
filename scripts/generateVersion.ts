import fs from "node:fs";
import path from "node:path";

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const version = rootPkg.version;

const target = path.join("packages/core/src/generated/version.ts");

fs.mkdirSync(path.dirname(target), { recursive: true });

fs.writeFileSync(target, `export const PRSENSE_VERSION = "${version}";\n`);
