import fs from "fs";
import path from "path";
import os from "os";

export const CONFIG_DIR =
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");

export const PRSENSE_DIR = path.join(CONFIG_DIR, "prsense");
export const CONFIG_PATH = path.join(PRSENSE_DIR, "config.yml");

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}