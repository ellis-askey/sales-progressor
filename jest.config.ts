import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Resolve @/ path alias to project root
    "^@/(.*)$": "<rootDir>/$1",
    // The real server-only package is a poison pill that throws under jest
    // (Next.js aliases it at build time; jest must too).
    "^server-only$": "<rootDir>/test-utils/server-only-stub.js",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.claude/"],
  resetModules: false,
};

export default config;
