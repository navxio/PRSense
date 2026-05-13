import path from "node:path";
import { spawn } from "node:child_process";

const CLI_ENTRY = path.resolve(__dirname, "../../src/index.ts");

type RunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function runPRSense(
  args: string[],
  env: Record<string, string> = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--import", "tsx", CLI_ENTRY, ...args], {
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}

describe("prsense review --ci", () => {
  it("runs successfully in CI mode", async () => {
    const result = await runPRSense(["review", ".", "--ci"], {
      CI: "true",
    });
    console.log(result.stderr);
    console.log(result.stdout);
    expect(result.stderr).toContain("--ci");
  });
});
