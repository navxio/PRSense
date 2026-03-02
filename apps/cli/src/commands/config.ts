import { Command } from "commander";
import {
  loadRepoConfig,
  loadGlobalConfig,
  loadEnvConfig,
  mergeUserConfigs,
} from "@prsense/config";
import { resolveConfig, buildCredentialContext } from "@prsense/runtime-config";

export const configCommand = new Command("config").description(
  "Inspect effective PRSense configuration",
);

configCommand
  .command("inspect")
  .description("Print merged configuration and credential status")
  .action(() => {
    const cwd = process.cwd();

    const globalConfig = loadGlobalConfig();
    const repoConfig = loadRepoConfig(cwd);
    const env = loadEnvConfig();

    const mergedUser = mergeUserConfigs(globalConfig, repoConfig);

    const resolved = resolveConfig({
      mode: "cli",
      repoRoot: cwd,
      repoProvider: "filesystem",
      user: mergedUser,
      env,
    });

    const credentials = buildCredentialContext(env);

    console.log("\n=== Global Config ===");
    console.log(JSON.stringify(globalConfig, null, 2));

    console.log("\n=== Repo Config ===");
    console.log(JSON.stringify(repoConfig, null, 2));

    console.log("\n=== Effective User Config ===");
    console.log(JSON.stringify(mergedUser, null, 2));

    console.log("\n=== Resolved Runtime Config ===");
    console.log(JSON.stringify(resolved, null, 2));

    console.log("\n=== Credential Availability ===");
    console.log(
      JSON.stringify(
        {
          openai: credentials.openai?.available ?? false,
          gemini: credentials.gemini?.available ?? false,
          claude: credentials.claude?.available ?? false,
          github: credentials.github?.available ?? false,
          gitlab: credentials.gitlab?.available ?? false,
          slack: credentials.slack?.available ?? false,
        },
        null,
        2,
      ),
    );

    console.log("");
  });
