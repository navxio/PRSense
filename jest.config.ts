export default {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 30000,
  roots: ["<rootDir>/packages"],
  moduleNameMapper: {
    "^@prsense/(.*)$": "<rootDir>/packages/$1/src",
  },
};