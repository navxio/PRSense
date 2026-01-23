import type { CapabilityContext, DatabaseConfig } from "../types.js";
import { loadEnvConfig } from "@prsense/config";

export async function buildCapabilityContext(): Promise<CapabilityContext> {
  const config = loadEnvConfig(process.env);
  const dbUrl: string = config.PRSENSE_DATABASE_URL
    ? config.PRSENSE_DATABASE_URL
    : "postgresql://prsense:prsense@localhost:10000/prsense_dev?sslmode=disable";

  let dbConfig: DatabaseConfig = {
    url: dbUrl,
    mode: config.PRSENSE_DATABASE_URL ? "external" : "bundled",
  };

  return {
    database: dbConfig,
  };
}
