import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  treeshake: true,
  minify: false,
  dts: false,

  // Bundle these workspace packages into the CLI
  noExternal: [
    "@prsense/config",
    "@prsense/context",
    "@prsense/core",
    "@prsense/llm",
    "@prsense/logging",
    "@prsense/preflight",
    "@prsense/reporters",
    "@prsense/workflows",
  ],

  external: [
    // Logging — must stay external
    /^pino/,
    "thread-stream",
    "sonic-boom",
    "real-require",
    "on-exit-leak-free",
    "@pinojs/redact",
    "atomic-sleep",
    "quick-format-unescaped",

    // Large SDKs — externalize for size
    /^@octokit\//,
    /^@gitbeaker\//,
    "openai",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "got",
    "dotenv",
  ],
});
