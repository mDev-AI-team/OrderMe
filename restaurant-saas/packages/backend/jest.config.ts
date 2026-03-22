import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@restaurant-saas/shared$': '<rootDir>/../shared/src',
  },
  testTimeout: 15000,
};

export default config;
