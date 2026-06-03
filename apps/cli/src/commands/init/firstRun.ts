import fs from "fs";
import path from "path";
import os from "os";

export const CONFIG_DIR =
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");

export const DATA_DIR =
  process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");

export const PRSENSE_CONFIG_DIR = path.join(CONFIG_DIR, "prsense");
export const PRSENSE_DATA_DIR = path.join(DATA_DIR, "prsense");

export const CONFIG_PATH = path.join(PRSENSE_CONFIG_DIR, "config.yml");
export const DB_PATH = path.join(PRSENSE_DATA_DIR, "prsense.db");

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

