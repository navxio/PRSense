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

  // Bundle workspace packages
  noExternal: [
    "@prsense/config",
    "@prsense/context",
    "@prsense/core",
    "@prsense/logging",
    "@prsense/reporters",
    "@prsense/workflows",
  ],

  external: [
    // Fastify ecosystem — plugin-based, externalize the whole subtree
    "fastify",
    "fastify-plugin",
    "fastify-raw-body",
    /^@fastify\//,
    "avvio",
    "find-my-way",
    "light-my-request",
    "ajv",
    "ajv-formats",
    "fast-json-stringify",

    // Postgres
    /^pg(-|$)/,
    /^postgres-/,
    "pgpass",

    // Logging — same as CLI
    /^pino/,
    "thread-stream",
    "sonic-boom",
    "real-require",
    "on-exit-leak-free",
    "@pinojs/redact",
    "atomic-sleep",
    "quick-format-unescaped",

    // CJS with built-in requires (lesson learned from CLI)
    "dotenv",

    // SDKs (only if daemon actually imports them — check)
    /^@octokit\//,
    /^@gitbeaker\//,
    "openai",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "yaml",
    "ts-morph",
  ],

  banner: { js: "#!/usr/bin/env node" },
});
