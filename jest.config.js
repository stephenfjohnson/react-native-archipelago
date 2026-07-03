/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  watchman: false,
  roots: ["<rootDir>/utils"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
};
