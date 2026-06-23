import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  transform: {
    "^.+\\.(ts|js)$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
        },
      },
    ],
  },

  transformIgnorePatterns: ["/node_modules/(?!(\\@octokit|@octokit)/)"],

  extensionsToTreatAsEsm: [],

  moduleFileExtensions: ["ts", "js"],

  roots: ["<rootDir>/packages", "<rootDir>/apps"],

  setupFilesAfterEnv: [
    "<rootDir>/packages/workflows/src/index/__tests__/setup.ts",
  ],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@prsense/(.*)$": "<rootDir>/packages/$1/src",
    "^@octokit/rest$": "<rootDir>/test/mocks/octokit-rest.ts",
  },

  testMatch: ["**/*.test.ts"],
};

export default config;
