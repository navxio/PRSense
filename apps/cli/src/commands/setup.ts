import { Command } from "commander";
import {
  dockerCapability,
  postgresCapability,
  pgVectorCapability,
} from "@prsense/capabilities";

import { DatabaseConfig } from "@prsense/capabilities";
import { runSetupWorkflow } from "@prsense/workflows";
import { loadEnvConfig } from "@prsense/config";

async function runSetupCommand() {
  //TODO: shouldn't load process.env on every invocation
  //TODO: internalise db mode to config
  const config = loadEnvConfig(process.env);
  const dbUrl: string = config.PRSENSE_DATABASE_URL
    ? config.PRSENSE_DATABASE_URL
    : "postgresql://prsense:prsense@localhost:10000/prsense_dev?sslmode=disable";

  let dbConfig: DatabaseConfig = {
    url: dbUrl,
    mode: config.PRSENSE_DATABASE_URL ? "external" : "bundled",
  };
  const ctx = {
    database: dbConfig,
  };

  const { results } = await runSetupWorkflow(
    // order matters
    [dockerCapability, postgresCapability, pgVectorCapability],
    ctx,
  );

  for (const r of results) {
    if (r.status === "applied") {
      console.log(`✔ ${r.id} applied`);
    } else if (r.status === "skipped") {
      console.log(`✓ ${r.id} already satisfied`);
    } else {
      console.error(`✖ ${r.id} failed`);
      console.error(`  ${r.error.message}`);
      process.exit(1);
    }
  }
}

export const setupCommand = new Command("setup")
  .description("Setup prsense for command line interface usage")
  .action(runSetupCommand);
