/**
 * Jest Configuration for E2E Tests
 * 
 * Comprehensive Jest setup for Detox E2E testing with
 * custom matchers, reporters, and mobile-specific configurations
 */

module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: '<rootDir>/e2e/globalSetup.js',
  globalTeardown: '<rootDir>/e2e/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  testEnvironment: '<rootDir>/e2e/environment.js',
  verbose: true,
  bail: false,
  collectCoverage: false,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './e2e/reports',
        filename: 'e2e-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'BloodLink Africa E2E Test Report',
        logoImgPath: './assets/logo.png'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './e2e/reports',
        outputName: 'e2e-results.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ],
    [
      './e2e/reporters/detoxReporter.js',
      {
        outputPath: './e2e/reports/detox-report.json'
      }
    ]
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-.*|@react-navigation|react-navigation|detox)/)'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@e2e/(.*)$': '<rootDir>/e2e/$1'
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/artifacts/',
    '<rootDir>/e2e/reports/'
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/e2e/artifacts/',
    '<rootDir>/e2e/reports/'
  ],
  // Custom test environment variables
  globals: {
    __DEV__: true,
    __TEST__: true,
    __E2E__: true
  },
  // Test retry configuration
  retry: process.env.CI ? 2 : 0,
  // Parallel test execution
  maxConcurrency: 1,
  // Test result processor
  testResultsProcessor: '<rootDir>/e2e/processors/testResultsProcessor.js',
  // Coverage configuration (disabled for E2E tests)
  collectCoverageFrom: [],
  coveragePathIgnorePatterns: ['.*'],
  // Custom matchers and utilities
  snapshotSerializers: [
    '<rootDir>/e2e/serializers/elementSerializer.js'
  ],
  // Test data and fixtures
  moduleDirectories: [
    'node_modules',
    '<rootDir>/e2e/fixtures',
    '<rootDir>/e2e/utils'
  ]
}
