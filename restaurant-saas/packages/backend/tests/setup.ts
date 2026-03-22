// Global test setup — runs before all test suites
// Ensures test database exists and is clean
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Override for test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
