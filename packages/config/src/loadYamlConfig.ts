import yaml from "yaml";
import fs from "node:fs";

export function loadYamlConfig(path: string): any {
  if (!fs.existsSync(path)) return {};
  return yaml.parse(fs.readFileSync(path, "utf8")) ?? {};
}
